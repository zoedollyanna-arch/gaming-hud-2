// Tic Tac Toe MOAP HUD
// - Loads an external HTML game UI into a prim face using Media-On-A-Prim (MOAP)
// - Passes avatar UUID + username in URL query params so the HTML can call the backend API
// - Also performs a lightweight backend stats GET via llHTTPRequest for logging/debugging.
//
// Notes / Second Life limitations:
// - LSL cannot reliably parse JSON deeply without helper code.
// - The HTML/JS frontend is responsible for fetching + rendering stats and posting game results.
// - This script keeps LSL code focused on identity + MOAP setup + debugging logs.

string  FACE_MEDIA = "0"; // prim face index as string in PRIM_MEDIA params
integer FACE = 0;

// Backend base URL (Render service URL). You MUST update this before use.
// Examples:
//   "https://your-render-service.onrender.com"
//   "http://localhost:3000" for local testing
string BACKEND_BASE_URL = "https://REPLACE_ME_WITH_YOUR_RENDER_URL";

// Media page URL (HTML frontend). We serve the UI at "/".
// If you change the frontend route, update this string.
string PAGE_URL_SUFFIX = "/";

// If you want to show a “ready” message in-world:
string HUD_TEXT_PREFIX = "TTT MOAP";

// Simple cache-buster to ensure reloads after we change identity/menu
integer _nonce = 0;

// Cached identity
key     gAvatarKey = NULL_KEY;
string  gUsername = "";

// ---- Utility: URL encode (minimal) ----
string urlEncode(string s) {
    // LSL does not have a full encoder; this minimal approach covers spaces and a few characters.
    s = llStringReplace(s, " ", "%20");
    s = llStringReplace(s, "\n", "%0A");
    s = llStringReplace(s, "\r", "");
    s = llStringReplace(s, "\"", "%22");
    s = llStringReplace(s, "'", "%27");
    return s;
}

// ---- Build the MOAP page URL with query parameters ----
string buildPageUrl() {
    string base = BACKEND_BASE_URL;
    if (llStringEndsWith(base, "/")) base = llDeleteSubString(base, llStringLength(base)-1, llStringLength(base)-1);

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

// ---- Load MOAP into prim face ----
void loadMoap() {
    if (gAvatarKey == NULL_KEY || gUsername == "" ) return;

    string url = buildPageUrl();

    // Ensure prim-media is configured on the face:
    // Using llSetPrimMediaParams:
    //   PRIM_MEDIA_CURRENT_URL, url,
    //   PRIM_MEDIA_AUTO_PLAY, TRUE,
    //   PRIM_MEDIA_AUTO_SCALE, TRUE (some viewers use this), PRIM_MEDIA_AUTO_ZOOM, TRUE,
    //   PRIM_MEDIA_PERMS_INTERACT, TRUE, PRIM_MEDIA_PERM_ANYONE, TRUE
    //
    // Exact flags can vary by viewer; these are common defaults for interactive shared media.
    llSetPrimMediaParams(
        FACE,
        [
            // turn on / set url
            1, url, // PRIM_MEDIA_CURRENT_URL (typically 1)
            // autoplay / presentation
            3, TRUE, // PRIM_MEDIA_AUTO_PLAY
            9, TRUE, // PRIM_MEDIA_AUTO_ZOOM
            // permissions for interaction
            15, TRUE, // PRIM_MEDIA_PERMS_INTERACT
            16, 2,    // PRIM_MEDIA_PERM_ANYONE (commonly encoded as 2 for anyone; viewers may ignore)
        ]
    );

    // Some viewers require HOME_URL too; harmless if ignored.
    llSetPrimMediaParams(
        FACE,
        [
            2, url // PRIM_MEDIA_HOME_URL (typically 2)
        ]
    );

    // Update in-world text for quick confirmation
    llSetText(HUD_TEXT_PREFIX + "\nLoading: " + gUsername, <1,1,1>, 1.0);
}

// ---- Lightweight stats GET for debugging logs ----
void debugFetchStats() {
    if (gAvatarKey == NULL_KEY || gUsername == "") return;

    string base = BACKEND_BASE_URL;
    if (llStringEndsWith(base, "/")) base = llDeleteSubString(base, llStringLength(base)-1, llStringLength(base)-1);

    string url = base
        + "/api/player/stats?avatarUuid=" + (string)gAvatarKey
        + "&username=" + urlEncode(gUsername);

    llHTTPRequest(url, [], "" );
}

// ---- Lifecycle ----
default
{
    state_entry() {
        // If worn, llGetOwner() typically returns the wearer.
        // If not worn yet, we’ll update on CHANGED_OWNER.
        llOwnerSay("TTT MOAP HUD ready. Wear the HUD to load the game.");
    }

    changed(integer change) {
        if (change & CHANGED_OWNER) {
            gAvatarKey = llGetOwner();
            gUsername = llGetDisplayName(gAvatarKey);
            _nonce++;
            loadMoap();
            debugFetchStats();
        }
        if (change & CHANGED_LINK) {
            // ignore
        }
    }

    touch_start(integer total_number) {
        // Touch => reload page (bust cache)
        _nonce++;
        loadMoap();
        debugFetchStats();
    }

    http_response(key request_id, integer status, list metadata, string body) {
        // Log stats response for debugging.
        // Frontend will also fetch stats and render them; this is just for HUD visibility.
        if (status >= 200 && status < 300) {
            llOwnerSay("Stats OK: " + body);
        } else {
            llOwnerSay("Stats error (" + (string)status + "): " + body);
        }
    }
}
