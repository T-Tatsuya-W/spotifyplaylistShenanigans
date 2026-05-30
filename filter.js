const CLIENT_ID = "2a1b848324a04242b06d3a1d0e5c16d9";
const SCOPES = "playlist-modify-public playlist-modify-private playlist-read-private user-read-private";
const REDIRECT_URI = window.location.origin + window.location.pathname;

const dom = {
  authStatus: document.getElementById("authStatus"),
  loginBtn: document.getElementById("loginBtn"),
  playlistStatus: document.getElementById("playlistStatus"),
  refreshPlaylistsBtn: document.getElementById("refreshPlaylistsBtn"),
  filterBtn: document.getElementById("filterBtn"),
  playlistList: document.getElementById("playlistList"),
  resultStatus: document.getElementById("resultStatus"),
  resultsList: document.getElementById("resultsList"),
  log: document.getElementById("log")
};

const state = {
  me: null,
  playlists: [],
  selected: new Set(),
  groups: [],
  hasRunFilter: false
};

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function log(msg, cls = "") {
  dom.log.style.display = "grid";
  const el = document.createElement("div");
  if (cls) el.className = cls;
  el.textContent = msg;
  dom.log.appendChild(el);
  dom.log.scrollTop = dom.log.scrollHeight;
}

function setAuthStatus(msg) {
  dom.authStatus.textContent = msg;
}

function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => possible[v % possible.length]).join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(bytes) {
  const str = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function beginLogin() {
  const codeVerifier = generateRandomString(64);
  localStorage.setItem("code_verifier", codeVerifier);
  const codeChallenge = base64urlencode(await sha256(codeVerifier));
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
    state: generateRandomString(16)
  }).toString();
  window.location.href = authUrl.toString();
}

async function exchangeCodeForToken(code) {
  const codeVerifier = localStorage.getItem("code_verifier");
  if (!codeVerifier) throw new Error("Missing code_verifier.");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data && data.error_description) || resp.statusText);
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token || "");
  return data.access_token;
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("No access token.");
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (resp.status === 401) throw new Error("Unauthorized (token expired?). Log in again.");
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); }
  catch { json = text; }
  if (!resp.ok) {
    const message = json && (json.error?.message || json.error_description) || resp.statusText;
    throw new Error(message);
  }
  return json;
}

async function fetchAllPages(path) {
  const items = [];
  let nextPath = path;
  while (nextPath) {
    const page = await apiFetch(nextPath);
    items.push(...(page.items || []));
    nextPath = page.next ? new URL(page.next).pathname.replace("/v1", "") + new URL(page.next).search : null;
  }
  return items;
}

function updateControls() {
  const hasToken = Boolean(localStorage.getItem("access_token"));
  dom.refreshPlaylistsBtn.disabled = !hasToken;
  dom.filterBtn.disabled = state.selected.size < 2;
  const count = state.selected.size;
  dom.playlistStatus.textContent = state.playlists.length
    ? `${state.playlists.length} public playlist${state.playlists.length === 1 ? "" : "s"} loaded • ${count} selected`
    : "No playlists loaded";
}

function renderPlaylists() {
  if (!state.playlists.length) {
    dom.playlistList.innerHTML = '<div class="empty-state muted">No public playlists found for this account.</div>';
    updateControls();
    return;
  }

  dom.playlistList.innerHTML = state.playlists.map(playlist => {
    const checked = state.selected.has(playlist.id) ? "checked" : "";
    return `<label class="playlist-card">
      <input type="checkbox" class="playlist-checkbox" value="${escapeHTML(playlist.id)}" ${checked} />
      <span class="playlist-name">${escapeHTML(playlist.name)}</span>
    </label>`;
  }).join("");
  updateControls();
}

async function loadPlaylists() {
  dom.playlistList.innerHTML = '<div class="empty-state muted">Loading playlists…</div>';
  state.selected.clear();
  state.groups = [];
  state.hasRunFilter = false;
  renderResults();
  updateControls();
  try {
    state.me = await apiFetch("/me");
    const playlists = await fetchAllPages("/me/playlists?limit=50");
    state.playlists = playlists
      .filter(playlist => playlist && playlist.public === true)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
    renderPlaylists();
    log(`Loaded ${state.playlists.length} public playlist${state.playlists.length === 1 ? "" : "s"}.`, "ok");
  } catch (err) {
    dom.playlistList.innerHTML = `<div class="empty-state muted">Could not load playlists: ${escapeHTML(err.message)}</div>`;
    log(`Could not load playlists: ${err.message}`, "err");
  } finally {
    updateControls();
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(feat|ft|featuring|with|prod|remaster(?:ed)?|radio edit|single version|mono|stereo|explicit|clean|deluxe|bonus track)\b/g, " ")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|and|or|of|to|in|for)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? previous
        : Math.min(previous + 1, dp[j] + 1, dp[j - 1] + 1);
      previous = temp;
    }
  }
  return dp[b.length];
}

function stringSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  return 1 - (distance / Math.max(left.length, right.length));
}

function artistSimilarity(leftArtists, rightArtists) {
  const left = new Set(leftArtists.flatMap(artist => Array.from(tokens(artist))));
  const right = new Set(rightArtists.flatMap(artist => Array.from(tokens(artist))));
  return jaccard(left, right);
}

function trackFromItem(item, playlist) {
  const track = item.track;
  if (!track || track.type !== "track" || track.is_local) return null;
  const artists = (track.artists || []).map(artist => artist.name).filter(Boolean);
  return {
    id: track.id,
    uri: track.uri,
    name: track.name || "Unknown track",
    artists,
    album: track.album?.name || "",
    url: track.external_urls?.spotify || "",
    playlistId: playlist.id,
    playlistName: playlist.name
  };
}

async function fetchPlaylistTracks(playlist) {
  const fields = "items(track(id,uri,type,is_local,name,artists(name),album(name),external_urls(spotify))),next";
  const items = await fetchAllPages(`/playlists/${encodeURIComponent(playlist.id)}/tracks?limit=50&fields=${encodeURIComponent(fields)}`);
  return items.map(item => trackFromItem(item, playlist)).filter(Boolean);
}

function tracksSeemSame(a, b) {
  if (a.id && b.id && a.id === b.id) return true;
  const titleScore = Math.max(stringSimilarity(a.name, b.name), jaccard(tokens(a.name), tokens(b.name)));
  const artistsScore = artistSimilarity(a.artists, b.artists);
  return titleScore >= 0.82 && artistsScore >= 0.5;
}

function buildDuplicateGroups(tracks) {
  const parent = Array.from({ length: tracks.length }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const byId = new Map();
  tracks.forEach((track, index) => {
    if (!track.id) return;
    if (byId.has(track.id)) unite(byId.get(track.id), index);
    else byId.set(track.id, index);
  });

  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      if (tracks[i].playlistId === tracks[j].playlistId) continue;
      if (tracksSeemSame(tracks[i], tracks[j])) unite(i, j);
    }
  }

  const groups = new Map();
  tracks.forEach((track, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push({ ...track, occurrenceId: `${track.playlistId}:${track.uri || track.id || index}` });
  });

  return Array.from(groups.values())
    .map(items => ({
      id: items.map(item => item.occurrenceId).sort().join("|"),
      ignored: new Set(),
      items
    }))
    .filter(group => new Set(group.items.map(item => item.playlistId)).size > 1)
    .sort((a, b) => b.items.length - a.items.length || a.items[0].name.localeCompare(b.items[0].name));
}

function getVisibleGroupItems(group) {
  return group.items.filter(item => !group.ignored.has(item.occurrenceId));
}

function renderResults() {
  const visibleGroups = state.groups
    .map(group => ({ group, items: getVisibleGroupItems(group) }))
    .filter(({ items }) => new Set(items.map(item => item.playlistId)).size > 1);

  if (!visibleGroups.length) {
    dom.resultStatus.textContent = state.groups.length ? "All matches ignored." : (state.hasRunFilter ? "No matches found." : "No filter run yet.");
    dom.resultsList.innerHTML = state.hasRunFilter
      ? '<div class="empty-state muted">No songs currently appear in multiple selected playlists.</div>'
      : '<div class="empty-state muted">Select playlists and run FILTER to see songs that appear in multiple playlists.</div>';
    return;
  }

  dom.resultStatus.textContent = `${visibleGroups.length} matched song${visibleGroups.length === 1 ? "" : "s"}`;
  dom.resultsList.innerHTML = visibleGroups.map(({ group, items }, groupIndex) => {
    const first = items[0];
    const artistLine = first.artists.join(", ") || "Unknown artist";
    const playlistCount = new Set(items.map(item => item.playlistId)).size;
    const occurrences = items.map(item => `<li>
      <span>
        <strong>${escapeHTML(item.playlistName)}</strong>
        <span class="muted small-text">${escapeHTML(item.name)} — ${escapeHTML(item.artists.join(", ") || "Unknown artist")}</span>
      </span>
      <button type="button" class="ghost-button ignore-match-btn" data-group-id="${escapeHTML(group.id)}" data-occurrence-id="${escapeHTML(item.occurrenceId)}">Ignore</button>
    </li>`).join("");
    return `<article class="result-card">
      <div class="result-card-header">
        <div>
          <h3>${escapeHTML(first.name)}</h3>
          <p class="muted">${escapeHTML(artistLine)} • found in ${playlistCount} playlists</p>
        </div>
        ${first.url ? `<a class="link" href="${escapeHTML(first.url)}" target="_blank" rel="noopener">Open in Spotify</a>` : `<span class="muted small-text">Match ${groupIndex + 1}</span>`}
      </div>
      <ul class="match-playlists">${occurrences}</ul>
    </article>`;
  }).join("");
}

async function runFilter() {
  const playlists = state.playlists.filter(playlist => state.selected.has(playlist.id));
  if (playlists.length < 2) return;

  dom.filterBtn.disabled = true;
  dom.resultStatus.textContent = "Fetching tracks…";
  dom.resultsList.innerHTML = '<div class="empty-state muted">Fetching tracks and comparing fuzzy matches…</div>';
  try {
    const allTracks = [];
    for (const playlist of playlists) {
      log(`Fetching ${playlist.name}…`);
      const tracks = await fetchPlaylistTracks(playlist);
      allTracks.push(...tracks);
      log(`Fetched ${tracks.length} track${tracks.length === 1 ? "" : "s"} from ${playlist.name}.`, "ok");
    }
    state.groups = buildDuplicateGroups(allTracks);
    state.hasRunFilter = true;
    renderResults();
    log(`Filter complete: ${state.groups.length} possible duplicate song${state.groups.length === 1 ? "" : "s"} found.`, "ok");
  } catch (err) {
    dom.resultStatus.textContent = "Filter failed.";
    dom.resultsList.innerHTML = `<div class="empty-state muted">Filter failed: ${escapeHTML(err.message)}</div>`;
    log(`Filter failed: ${err.message}`, "err");
  } finally {
    updateControls();
  }
}

function setupEvents() {
  dom.loginBtn.addEventListener("click", beginLogin);
  dom.refreshPlaylistsBtn.addEventListener("click", loadPlaylists);
  dom.filterBtn.addEventListener("click", runFilter);

  dom.playlistList.addEventListener("change", event => {
    if (!event.target.classList.contains("playlist-checkbox")) return;
    if (event.target.checked) state.selected.add(event.target.value);
    else state.selected.delete(event.target.value);
    updateControls();
  });

  dom.resultsList.addEventListener("click", event => {
    const button = event.target.closest(".ignore-match-btn");
    if (!button) return;
    const group = state.groups.find(item => item.id === button.dataset.groupId);
    if (!group) return;
    group.ignored.add(button.dataset.occurrenceId);
    renderResults();
  });
}

async function initAuth() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (error) log(`Auth error: ${error}`, "err");

  if (code) {
    try {
      log("Exchanging authorization code for access token…");
      await exchangeCodeForToken(code);
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthStatus("✓ Logged in");
      log("Logged in successfully!", "ok");
      await loadPlaylists();
    } catch (err) {
      log(`Token exchange failed: ${err.message}`, "err");
    }
  } else if (localStorage.getItem("access_token")) {
    setAuthStatus("✓ Logged in");
    log("Token present.", "ok");
    await loadPlaylists();
  } else {
    setAuthStatus("Not logged in");
    log("Log in with Spotify to load public playlists.");
  }
  updateControls();
}

setupEvents();
initAuth();
