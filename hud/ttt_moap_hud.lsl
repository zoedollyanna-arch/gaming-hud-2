// Tic Tac Toe MOAP HUD
// - Loads an external HTML game UI into a prim face using Media-On-A-Prim (MOAP)
// - Passes avatar UUID + username in URL query params so the HTML can call the backend API
// - Also performs a lightweight backend stats GET via llHTTPRequest for logging/debugging.
//
// Notes / Second Life limitations:
// - LSL cannot reliably parse JSON deeply without helper code.
// - The HTML/JS frontend is responsible for fetching + rendering stats and posting game results.
// - This script keeps LSL code focused on identity + MOAP setup + debugging logs.

// ========= Link setup (your requirement) =========
// Link 1: decorative frame ONLY (no media / no media texture updates)
// Link 2: MOAP screen/display surface (ALL media/HTML rendering targets here)
integer LINK_FRAME  = 1;
integer LINK_SCREEN = 2;

// Prim face index on the MOAP screen where media is applied
string  FACE_MEDIA = "2"; // (informational only) prim face index as string in PRIM_MEDIA params
integer FACE = 2;

// Backend base URL (Render service URL). You MUST update this before use.
// Examples:
//   "https://your-render-service.onrender.com"
//   "http://localhost:3000" for local testing
string BACKEND_BASE_URL = "https://gaming-hud-2.onrender.com";

// Media page URL (HTML frontend). We serve the UI at "/".
// If you change the frontend route, update this string.
string PAGE_URL_SUFFIX = "/";

// If you want to show a “ready” message in-world:
string HUD_TEXT_PREFIX = "TTT MOAP";

// Simple cache-buster to ensure reloads after we change identity/menu
integer _nonce = 0;
integer DEBUG_MODE = 0;

// Cached identity
key     gAvatarKey = NULL_KEY;
string  gUsername = "";

// ---- Utility: URL encode (minimal) ----
string urlEncode(string input) {
    // Second Life LSL provides llEscapeURL for URL encoding.
    return llEscapeURL(input);
}

// Check whether a string ends with "/"
integer endsWithSlash(string s) {
    integer len = llStringLength(s);
    if (len <= 0) return FALSE;
    return llGetSubString(s, len - 1, len - 1) == "/";
}

integer linksOk() {
    integer total = llGetNumberOfPrims();
    // llGetNumberOfPrims returns the number of linked prims INCLUDING the root prim as link 1.
    if (total < LINK_SCREEN) {
        llOwnerSay("HUD ERROR: Not enough linked prims. Have=" + (string)total + " need link " + (string)LINK_SCREEN + ".");
        return FALSE;
    }
    if (LINK_FRAME != 1) {
        // Your requirement is explicit: link 1 = frame. We keep this for clarity.
        llOwnerSay("HUD WARNING: LINK_FRAME expected to be 1 by requirement; current LINK_FRAME=" + (string)LINK_FRAME + ".");
    }
    return TRUE;
}

// ---- Build the MOAP page URL with query parameters ----
string buildPageUrl() {
    string base = BACKEND_BASE_URL;
    integer baseHasSlash = endsWithSlash(base);
    if (baseHasSlash) {
        integer len = llStringLength(base);
        base = llDeleteSubString(base, len - 1, len - 1);
    }

    string page = base + PAGE_URL_SUFFIX;

    // The frontend reads:
    //   ?avatarUuid=...&username=...&apiBase=...
    // apiBase is set to backend base so fetch() can call /api/*
    string url = page
        + "?avatarUuid=" + (string)gAvatarKey
        + "&username=" + urlEncode(gUsername)
        + "&apiBase=" + urlEncode(base)
        + "&_n=" + (string)_nonce;

    return url;
}

// ---- Load MOAP into prim face (TARGET: link 2 only) ----
loadMoap() {
    if (!linksOk()) return;
    if (gAvatarKey == NULL_KEY || gUsername == "" ) return;

    string url = buildPageUrl();

    // Configure media on the LINK_SCREEN prim face.
    // Minimal + type-safe parameter set.
    llSetLinkMedia(
        LINK_SCREEN,
        FACE,
        [
            PRIM_MEDIA_CURRENT_URL, url,
            PRIM_MEDIA_HOME_URL, url,
            PRIM_MEDIA_AUTO_PLAY, TRUE,
            // Permissions mask for who can interact with the media
            PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE
        ]
    );

    // Update in-world text for quick confirmation.
    // This updates the script prim specifically. If your script is on a non-screen prim,
    // consider moving the script to the screen prim or replacing this with a link-targeted text call.
    llSetText(HUD_TEXT_PREFIX + "\nLoading: " + gUsername, <1,1,1>, 1.0);
}

// ---- Lightweight stats GET for debugging logs (no link targeting needed) ----
debugFetchStats() {
    if (gAvatarKey == NULL_KEY || gUsername == "") return;

    string base = BACKEND_BASE_URL;
    integer baseHasSlash = endsWithSlash(base);
    if (baseHasSlash) {
        integer len = llStringLength(base);
        base = llDeleteSubString(base, len - 1, len - 1);
    }

    string url = base
        + "/api/player/stats?avatarUuid=" + (string)gAvatarKey
        + "&username=" + urlEncode(gUsername);

    llHTTPRequest(url, [], "" );
}

// ---- Lifecycle ----
integer refreshIdentityAndLoad(integer bumpNonce) {
    // Called when attaching/wearing so MOAP shows immediately (no touch required).
    key owner = llGetOwner();
    if (owner == NULL_KEY) return FALSE;

    string name = llGetDisplayName(owner);
    if (name == "") return FALSE;

    gAvatarKey = owner;
    gUsername = name;

    if (bumpNonce) _nonce++;

    loadMoap();
    debugFetchStats();
    return TRUE;
}

default
{
    state_entry() {
        llOwnerSay("TTT MOAP HUD ready. Wear/attach the HUD to load the game.");

        // If already attached/worn when script starts, load immediately.
        refreshIdentityAndLoad(FALSE);
    }

    attach(key id) {
        // Attach event is the most reliable way to load on "attach" (not only CHANGED_OWNER).
        // id == NULL_KEY means detached.
        if (id != NULL_KEY) {
            if (DEBUG_MODE) llOwnerSay("HUD DEBUG: attach() id present, loading MOAP instantly.");
            refreshIdentityAndLoad(TRUE);
        }
    }

    changed(integer change) {
        if (change & CHANGED_OWNER) {
            if (DEBUG_MODE) llOwnerSay("HUD DEBUG: CHANGED_OWNER received, loading MOAP.");
            refreshIdentityAndLoad(TRUE);
        }
        // CHANGED_LINK just indicates linking changes; we don’t need to handle it beyond validation.
        if (change & CHANGED_LINK) {
            // no-op; next touch/owner-change will re-validate + reload
        }
    }

    touch_start(integer total_number) {
        // Touch => reload page (bust cache)
        // Requirement: interaction logic targets link 2 specifically.

        integer ok = linksOk();
        if (!ok) {
            if (DEBUG_MODE) llOwnerSay("HUD DEBUG: linksOk()=FALSE; total=" + (string)total_number + " LINK_SCREEN=" + (string)LINK_SCREEN);
            return;
        }

        // DEBUG: report which link(s) were touched so we can verify LINK_SCREEN mapping
        if (DEBUG_MODE) llOwnerSay("HUD DEBUG: touch_start total=" + (string)total_number + " LINK_SCREEN=" + (string)LINK_SCREEN);

        integer i;
        for (i = 0; i < total_number; i++) {
            integer touchedLink = llDetectedLinkNumber(i);
            if (DEBUG_MODE) llOwnerSay("HUD DEBUG: touched link=" + (string)touchedLink + " (i=" + (string)i + ")");

            // Filter touches so only LINK_SCREEN triggers reload.
            if (touchedLink == LINK_SCREEN) {
                _nonce++;
                loadMoap();
                debugFetchStats();
                if (DEBUG_MODE) llOwnerSay("HUD DEBUG: reloaded (touched LINK_SCREEN). nonce=" + (string)_nonce);
                // Only reload once per touch_start even if multiple points are hit.
                return;
            }
        }

        // If we get here, user touched but not link 2.
        if (DEBUG_MODE) llOwnerSay("HUD DEBUG: touch did not include LINK_SCREEN; no reload.");
    }

    http_response(key request_id, integer status, list metadata, string body) {
        // Avoid nearby chat spam: only show errors by default.
        // The HTML frontend also fetches + renders stats; this is just HUD-side logging.

        if (status >= 200 && status < 300) {
            if (DEBUG_MODE) llOwnerSay("Stats OK");
            return;
        }

        // Errors: show (optionally you can gate this behind DEBUG_MODE too)
        llOwnerSay("Stats error (" + (string)status + "): " + body);
    }
}
