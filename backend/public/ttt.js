/* Tic Tac Toe MOAP Frontend
 * - Mobile responsive
 * - Loads player stats from backend
 * - Plays vs a simple “smart random” robot (win/block/center/corners/random)
 * - Posts game results back to backend
 * - Includes loading/error states + lightweight sound feedback
 */

(() => {
  "use strict";

  const els = {
    board: document.getElementById("board"),
    username: document.getElementById("username"),
    wins: document.getElementById("wins"),
    losses: document.getElementById("losses"),
    gamesPlayed: document.getElementById("gamesPlayed"),
    appStatus: document.getElementById("appStatus"),
    statsStatus: document.getElementById("statsStatus"),
    gameMsg: document.getElementById("gameMsg"),
    turn: document.getElementById("turn"),
    newGameBtn: document.getElementById("newGameBtn"),
    refreshStatsBtn: document.getElementById("refreshStatsBtn"),
  };

  const GAME = {
    playerMark: "X", // user
    robotMark: "O", // AI
    empty: "",
    board: Array(9).fill(""),
    turn: "X",
    locked: false,
    over: false,
    audioReady: false,
  };

  const UI = {
    setStatus(el, text, kind) {
      if (!el) return;
      el.classList.remove("msg--error", "msg--ok", "msg--loading");
      if (kind === "error") el.classList.add("msg--error");
      if (kind === "ok") el.classList.add("msg--ok");
      if (kind === "loading") el.classList.add("msg--loading");
      el.textContent = text;
    },
    setAppStatus(text, kind) {
      UI.setStatus(els.appStatus, text, kind);
    },
    setGameMsg(text, kind) {
      els.gameMsg.textContent = text;
      els.gameMsg.classList.remove("msg--error", "msg--ok", "msg--loading");
      if (kind === "error") els.gameMsg.classList.add("msg--error");
      if (kind === "ok") els.gameMsg.classList.add("msg--ok");
      if (kind === "loading") els.gameMsg.classList.add("msg--loading");
    },
    setTurn(text) {
      els.turn.textContent = text;
    },
    setButtonsDisabled(disabled) {
      els.newGameBtn.disabled = disabled;
      els.refreshStatsBtn.disabled = disabled;
    },
    setBoardDisabled(disabled) {
      for (const btn of UI.getCellButtons()) btn.disabled = disabled;
    },
    getCellButtons() {
      return Array.from(els.board.querySelectorAll("[data-idx]"));
    },
    clearBoard() {
      els.board.innerHTML = "";
    },
  };

  function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      avatarUuid: params.get("avatarUuid") || "",
      username: params.get("username") || "",
      // Optional: override API base for local testing or MOAP setups.
      apiBase: params.get("apiBase") || "",
    };
  }

  const query = parseQuery();
  const avatarUuid = query.avatarUuid;
  const username = query.username;

  function requireIdentity() {
    if (!avatarUuid) throw new Error("Missing avatarUuid in URL query (?avatarUuid=...)");
    if (!username) throw new Error("Missing username in URL query (?username=...)");
  }

  // ---- Sound (WebAudio)
  let audioCtx = null;

  function ensureAudio() {
    if (GAME.audioReady) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      GAME.audioReady = true;
    } catch (_e) {
      // Ignore sound failures (some environments block WebAudio)
      GAME.audioReady = false;
    }
  }

  async function resumeAudio() {
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
      } catch (_e) {
        // ignore
      }
    }
  }

  function playTone({ freq = 440, durationMs = 90, type = "square", gain = 0.06 } = {}) {
    if (!GAME.audioReady || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    g.gain.value = gain;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);

    osc.connect(g);
    g.connect(audioCtx.destination);

    osc.start(t0);
    osc.stop(t0 + durationMs / 1000);
  }

  function playSfxClick() {
    playTone({ freq: 330, durationMs: 60, type: "square" });
  }
  function playSfxPlaceX() {
    playTone({ freq: 440, durationMs: 70, type: "square" });
  }
  function playSfxPlaceO() {
    playTone({ freq: 392, durationMs: 70, type: "square" });
  }
  function playSfxWin() {
    playTone({ freq: 660, durationMs: 120, type: "square", gain: 0.08 });
    setTimeout(() => playTone({ freq: 880, durationMs: 120, type: "square", gain: 0.08 }), 120);
  }
  function playSfxLoss() {
    playTone({ freq: 180, durationMs: 120, type: "square", gain: 0.08 });
    setTimeout(() => playTone({ freq: 130, durationMs: 120, type: "square", gain: 0.08 }), 120);
  }
  function playSfxTie() {
    playTone({ freq: 520, durationMs: 90, type: "triangle", gain: 0.08 });
    setTimeout(() => playTone({ freq: 520, durationMs: 90, type: "triangle", gain: 0.08 }), 110);
  }

  // ---- Game rules
  function checkWinner(board) {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      const v = board[a];
      if (v && v === board[b] && v === board[c]) {
        return { winner: v, line: [a, b, c] };
      }
    }
    if (board.every((x) => x !== "")) return { winner: null, tie: true };
    return { winner: null, tie: false };
  }

  function getAvailableIndices(board) {
    const out = [];
    for (let i = 0; i < board.length; i++) if (board[i] === "") out.push(i);
    return out;
  }

  function findWinningMove(board, mark) {
    // Return index that makes "mark" win in 1 move, else null
    const avail = getAvailableIndices(board);
    for (const idx of avail) {
      const test = board.slice();
      test[idx] = mark;
      const w = checkWinner(test);
      if (w.winner === mark) return idx;
    }
    return null;
  }

  function pickRobotMove(board) {
    const robot = GAME.robotMark;
    const user = GAME.playerMark;

    // 1) Win if possible
    const winIdx = findWinningMove(board, robot);
    if (winIdx !== null) return winIdx;

    // 2) Block user's win
    const blockIdx = findWinningMove(board, user);
    if (blockIdx !== null) return blockIdx;

    // 3) Prefer center
    if (board[4] === "") return 4;

    // 4) Prefer corners
    const corners = [0, 2, 6, 8].filter((i) => board[i] === "");
    if (corners.length > 0) {
      // slight randomness so it doesn't feel scripted
      return corners[Math.floor(Math.random() * corners.length)];
    }

    // 5) Otherwise random among remaining
    const avail = getAvailableIndices(board);
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function setCell(idx, mark) {
    const btn = els.board.querySelector(`[data-idx="${idx}"]`);
    if (!btn) return;
    btn.textContent = mark;
    btn.disabled = true;
    btn.classList.remove("cell--x", "cell--o");
    btn.classList.add(mark === "X" ? "cell--x" : "cell--o");
  }

  function highlightWin(line, winner) {
    for (const idx of line) {
      const btn = els.board.querySelector(`[data-idx="${idx}"]`);
      if (!btn) continue;
      btn.classList.add(winner === "X" ? "cell--win-x" : "cell--win-o");
    }
  }

  function setTurnUI() {
    if (GAME.over) return;
    const who = GAME.turn === GAME.playerMark ? "You" : "Robot";
    const mark = GAME.turn;
    UI.setTurn(`Turn: ${who} (${mark})`);
  }

  async function postResult(outcome) {
    // outcome: win | loss | tie from user's perspective
    const apiBase = query.apiBase || window.location.origin;
    const url = `${apiBase}/api/game/results`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avatarUuid,
        username,
        outcome,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to post results (${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json();
    return data?.player || null;
  }

  async function refreshStats() {
    UI.setButtonsDisabled(true);
    UI.setBoardDisabled(true);
    UI.setAppStatus("Loading stats…", "loading");
    UI.setGameMsg("");

    const apiBase = query.apiBase || window.location.origin;
    const url = `${apiBase}/api/player/stats?avatarUuid=${encodeURIComponent(avatarUuid)}&username=${encodeURIComponent(username)}`;

    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`Stats fetch failed (${res.status})`);

      const data = await res.json();
      const player = data?.player;

      if (!player) throw new Error("Stats response missing player");

      els.username.textContent = player.username ?? username;
      els.wins.textContent = String(player.wins ?? 0);
      els.losses.textContent = String(player.losses ?? 0);
      els.gamesPlayed.textContent = String(player.games_played ?? player.gamesPlayed ?? 0);

      UI.setAppStatus("Ready.", "ok");
      setStatusLine("stats ok");
      playSfxClick();
    } catch (err) {
      console.error(err);
      UI.setAppStatus("Stats error. Try again.", "error");
      setStatusLine("stats failed");
      UI.setGameMsg("Couldn’t load stats. Check connection.", "error");
    } finally {
      UI.setButtonsDisabled(false);
      UI.setBoardDisabled(false);
    }
  }

  function setStatusLine(text) {
    if (!els.statsStatus) return;
    els.statsStatus.textContent = text;
  }

  function disableBoardOnOver() {
    for (const btn of UI.getCellButtons()) btn.disabled = true;
  }

  async function robotTurn() {
    GAME.locked = true;
    setTurnUI();
    UI.setGameMsg("Robot thinking…", "loading");
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 250));

    const idx = pickRobotMove(GAME.board);
    if (idx === undefined || idx === null) return;

    if (GAME.board[idx] !== "") return;

    GAME.board[idx] = GAME.robotMark;
    setCell(idx, GAME.robotMark);
    playSfxPlaceO();

    const result = checkWinner(GAME.board);
    if (result.winner || result.tie) {
      await finishGame(result);
      return;
    }

    GAME.turn = GAME.playerMark;
    GAME.locked = false;
    UI.setGameMsg("");
    setTurnUI();
  }

  async function finishGame(result) {
    GAME.over = true;
    GAME.locked = true;
    disableBoardOnOver();

    const { winner, tie, line } = result;
    UI.setGameMsg("");

    if (winner === GAME.playerMark) {
      UI.setAppStatus("You win!", "ok");
      UI.setGameMsg("Victory. Posting result…", "loading");
      playSfxWin();
      try {
        await postResult("win");
        await refreshStats();
      } catch (e) {
        console.error(e);
        UI.setGameMsg("Posted win failed (will retry next refresh).", "error");
      }
      return;
    }

    if (winner === GAME.robotMark) {
      UI.setAppStatus("You lose.", "error");
      UI.setGameMsg("Defeat. Posting result…", "loading");
      playSfxLoss();
      try {
        await postResult("loss");
        await refreshStats();
      } catch (e) {
        console.error(e);
        UI.setGameMsg("Posted loss failed (will retry next refresh).", "error");
      }
      return;
    }

    if (tie) {
      UI.setAppStatus("Tie.", "loading");
      UI.setGameMsg("Draw. Posting result…", "loading");
      playSfxTie();
      try {
        await postResult("tie");
        await refreshStats();
      } catch (e) {
        console.error(e);
        UI.setGameMsg("Posted tie failed (will retry next refresh).", "error");
      }
      return;
    }

    // Should never reach here
    UI.setAppStatus("Game ended.", "ok");
  }

  function resetBoard() {
    GAME.board = Array(9).fill("");
    GAME.turn = GAME.playerMark;
    GAME.locked = false;
    GAME.over = false;

    UI.clearBoard();
    for (let i = 0; i < 9; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.setAttribute("data-idx", String(i));
      btn.setAttribute("aria-label", `Cell ${i + 1}`);
      btn.addEventListener("click", () => onCellClick(i));
      els.board.appendChild(btn);
    }

    // Reset UI
    UI.setGameMsg("");
    els.board.style.opacity = "1";
    UI.setTurnUI?.();
    setTurnUI();
    UI.setAppStatus("New round. Your move.", "ok");
  }

  function onCellClick(idx) {
    // Audio must be triggered by a user gesture, so do it first.
    resumeAudio().catch(() => undefined);

    if (GAME.locked || GAME.over) return;
    if (GAME.turn !== GAME.playerMark) return;

    if (GAME.board[idx] !== "") return;

    GAME.board[idx] = GAME.playerMark;
    setCell(idx, GAME.playerMark);
    playSfxPlaceX();

    const result = checkWinner(GAME.board);
    if (result.winner || result.tie) {
      finishGame(result);
      return;
    }

    GAME.turn = GAME.robotMark;
    GAME.locked = false;
    setTurnUI();
    // Start robot asynchronously
    robotTurn().catch((e) => {
      console.error(e);
      UI.setGameMsg("Robot error. Refresh and try again.", "error");
      UI.setAppStatus("Robot error.", "error");
    });
  }

  // ---- Init + wire events
  async function init() {
    UI.setAppStatus("Starting…", "loading");
    UI.setGameMsg("", "loading");

    try {
      requireIdentity();
    } catch (e) {
      console.error(e);
      UI.setAppStatus("Missing identity. HUD needs avatarUuid + username.", "error");
      UI.setGameMsg(String(e.message || e), "error");
      UI.setButtonsDisabled(true);
      UI.setBoardDisabled(true);
      return;
    }

    // Ensure audio context created lazily on first interaction; we still wire a gesture resume.
    document.addEventListener("touchstart", () => resumeAudio().catch(() => undefined), { once: true });
    document.addEventListener("click", () => resumeAudio().catch(() => undefined), { once: true });

    els.refreshStatsBtn.addEventListener("click", () => {
      playSfxClick();
      refreshStats().catch((e) => console.error(e));
    });

    els.newGameBtn.addEventListener("click", async () => {
      playSfxClick();
      resetBoard();
    });

    resetBoard();
    await refreshStats();
  }

  init().catch((e) => {
    console.error(e);
    UI.setAppStatus("Init error.", "error");
    UI.setGameMsg("Check console for details.", "error");
  });
})();
