const CLIENT_ID = "2a1b848324a04242b06d3a1d0e5c16d9";
const SCOPES = "playlist-modify-public playlist-modify-private user-read-private";
const REDIRECT_URI = window.location.origin + window.location.pathname;

const numericFields = ["BPM", "Energy", "Dance", "Valence", "Acoustic", "Popularity"];
const scatterFields = { x: "Valence", y: "Energy" };
const CLUSTER_COUNT = 6;
const clusterColors = ["#ef4444", "#f97316", "#facc15", "#10b981", "#3b82f6", "#8b5cf6"];

const dom = {
  log: document.getElementById("log"),
  authStatus: document.getElementById("authStatus"),
  selectedCount: document.getElementById("selectedCount"),
  playlistName: document.getElementById("playlistName"),
  createPlaylistBtn: document.getElementById("createPlaylistBtn"),
  loginBtn: document.getElementById("loginBtn"),
  csvPath: document.getElementById("csvPath"),
  loadCsvBtn: document.getElementById("loadCsvBtn"),
  filterInput: document.getElementById("filterInput"),
  selectAll: document.getElementById("selectAll"),
  deselectAllBtn: document.getElementById("deselectAllBtn"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  csvBody: document.getElementById("csvBody"),
  tableHead: document.querySelector("#csvTable thead"),
  filtersContainer: document.getElementById("filtersContainer"),
  knnK: document.getElementById("knnK"),
  knnDimContainer: document.getElementById("knnDimContainer"),
  scatter: document.getElementById("scatterPlot"),
  scatterTooltip: document.getElementById("scatterTooltip"),
  scatterKnnBtn: document.getElementById("scatterKnnBtn"),
  scatterSelectionLabel: document.getElementById("scatterSelectionLabel"),
  runClustersBtn: document.getElementById("runClustersBtn"),
  clusterStatus: document.getElementById("clusterStatus"),
  clusterLegend: document.getElementById("clusterLegend"),
  createClusterPlaylistsBtn: document.getElementById("createClusterPlaylistsBtn")
};

const state = {
  rows: [],
  view: [],
  search: "",
  sort: { key: "Title", dir: "asc" },
  filters: {},
  knn: {
    k: 5,
    dimensions: {
      BPM: true,
      Energy: true,
      Dance: true,
      Valence: true,
      Acoustic: false,
      Popularity: false
    }
  },
  selected: new Set(),
  scatter: {
    points: [],
    dirty: true,
    hoverId: null,
    lastActivatedId: null,
    lastTapId: null,
    lastTapTime: 0,
    skipNextDblClick: false
  },
  clusters: {
    ready: false,
    counts: Array(CLUSTER_COUNT).fill(0),
    sampleSize: 0,
    actualK: 0,
    skipped: 0,
    descriptions: Array(CLUSTER_COUNT).fill("")
  }
};

function updateScatterKnnUi() {
  if (!dom.scatterKnnBtn || !dom.scatterSelectionLabel) return;
  const rowId = state.scatter.lastActivatedId;
  const isVisible = rowId !== null && state.view.some(row => row._idx === rowId);
  if (!isVisible) {
    dom.scatterKnnBtn.disabled = true;
    dom.scatterSelectionLabel.textContent = "Tap a point to enable neighbour search.";
    return;
  }
  const row = state.rows[rowId];
  if (!row) {
    dom.scatterKnnBtn.disabled = true;
    dom.scatterSelectionLabel.textContent = "Tap a point to enable neighbour search.";
    return;
  }
  dom.scatterKnnBtn.disabled = false;
  dom.scatterSelectionLabel.textContent = `${row.Title || "Unknown track"} — ready for neighbours.`;
}

function setScatterFocus(rowId) {
  state.scatter.lastActivatedId = rowId;
  updateScatterKnnUi();
  scheduleScatterRender();
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
  if (resp.status === 401) throw new Error("Unauthorized (token expired?)");
  const text = await resp.text();
  try { return { ok: resp.ok, status: resp.status, json: JSON.parse(text) }; }
  catch { return { ok: resp.ok, status: resp.status, json: text }; }
}

function getNumericValue(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(String(val).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function debounce(fn, wait = 160) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

let viewRefreshQueued = false;
function scheduleViewRefresh() {
  if (viewRefreshQueued) return;
  viewRefreshQueued = true;
  requestAnimationFrame(() => {
    viewRefreshQueued = false;
    refreshView();
  });
}

let scatterRefreshQueued = false;
function scheduleScatterRender(recompute = false) {
  if (recompute) state.scatter.dirty = true;
  if (scatterRefreshQueued) return;
  scatterRefreshQueued = true;
  requestAnimationFrame(() => {
    scatterRefreshQueued = false;
    renderScatter();
  });
}

function refreshView() {
  if (!state.rows.length) {
    dom.csvBody.innerHTML = "";
    state.view = [];
    state.scatter.lastActivatedId = null;
    updateScatterKnnUi();
    scheduleScatterRender(true);
    updateSelectedCount();
    return;
  }

  const q = state.search;
  const filters = state.filters;
  const filtered = [];

  for (const row of state.rows) {
    if (q && !row._haystack.includes(q)) continue;
    let passed = true;
    for (const field of numericFields) {
      const val = row._values[field];
      if (val === null) continue;
      const range = filters[field];
      if (val < range.min || val > range.max) {
        passed = false;
        break;
      }
    }
    if (passed) filtered.push(row);
  }

  const { key, dir } = state.sort;
  filtered.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const an = getNumericValue(av);
    const bn = getNumericValue(bv);
    let cmp;
    if (an !== null && bn !== null) cmp = an - bn;
    else cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return dir === "asc" ? cmp : -cmp;
  });

  state.view = filtered;
  if (state.scatter.lastActivatedId !== null && !filtered.some(row => row._idx === state.scatter.lastActivatedId)) {
    state.scatter.lastActivatedId = null;
  }
  renderTable();
  scheduleScatterRender(true);
  updateScatterKnnUi();
  updateSelectedCount();
}

function renderTable() {
  const rows = state.view;
  if (!rows.length) {
    dom.csvBody.innerHTML = `<tr><td colspan="11" class="muted">No rows match the current filters.</td></tr>`;
    updateSortIndicators();
    updateSelectAllState();
    return;
  }

  const html = rows.map(row => {
    const spotifyUrl = row.Spotify_URL || (row.Spotify_Track_ID ? `https://open.spotify.com/track/${row.Spotify_Track_ID}` : "");
    const checked = state.selected.has(row._idx) ? "checked" : "";
    return `<tr data-row-id="${row._idx}">
      <td><input type="checkbox" class="rowCheckbox" data-row-id="${row._idx}" ${checked} /></td>
      <td><button type="button" class="knn-btn" title="Find similar tracks">🔍</button> ${escapeHTML(row.Title)}</td>
      <td>${escapeHTML(row.Artist || row.Spotify_Artists)}</td>
      <td>${escapeHTML(row.Release || row.Spotify_Release_Date)}</td>
      <td class="right">${escapeHTML(row.BPM)}</td>
      <td class="right">${escapeHTML(row.Energy)}</td>
      <td class="right">${escapeHTML(row.Dance)}</td>
      <td class="right">${escapeHTML(row.Valence)}</td>
      <td class="right">${escapeHTML(row.Acoustic)}</td>
      <td class="right">${escapeHTML(row.Popularity)}</td>
      <td>${spotifyUrl ? `<a class="link" href="${escapeHTML(spotifyUrl)}" target="_blank" rel="noopener">Open</a>` : ""}</td>
    </tr>`;
  }).join("");

  dom.csvBody.innerHTML = html;
  updateSortIndicators();
  updateSelectAllState();
}

function updateSortIndicators() {
  dom.tableHead.querySelectorAll("th[data-key]").forEach(th => {
    const key = th.dataset.key;
    th.dataset.sort = key === state.sort.key ? (state.sort.dir === "asc" ? "▲" : "▼") : "";
  });
}

function updateSelectAllState() {
  if (!state.view.length) {
    dom.selectAll.checked = false;
    dom.selectAll.indeterminate = false;
    return;
  }
  let checkedCount = 0;
  for (const row of state.view) {
    if (state.selected.has(row._idx)) checkedCount++;
  }
  if (checkedCount === 0) {
    dom.selectAll.checked = false;
    dom.selectAll.indeterminate = false;
  } else if (checkedCount === state.view.length) {
    dom.selectAll.checked = true;
    dom.selectAll.indeterminate = false;
  } else {
    dom.selectAll.checked = false;
    dom.selectAll.indeterminate = true;
  }
}

function updateSelectedCount() {
  const count = state.selected.size;
  dom.selectedCount.textContent = count ? `${count} track${count === 1 ? "" : "s"} selected` : "No tracks selected";
  if (count && localStorage.getItem("access_token")) {
    dom.createPlaylistBtn.disabled = false;
  } else if (!count) {
    dom.createPlaylistBtn.disabled = true;
  }
  state.scatter.points.forEach(point => {
    point.selected = state.selected.has(point.rowId);
  });
  scheduleScatterRender();
}

function updateClusterControls() {
  if (dom.runClustersBtn) {
    dom.runClustersBtn.disabled = !state.rows.length;
  }
  if (dom.createClusterPlaylistsBtn) {
    const hasToken = Boolean(localStorage.getItem("access_token"));
    dom.createClusterPlaylistsBtn.disabled = !(state.clusters.ready && hasToken);
  }
}

function updateClusterUi() {
  if (dom.clusterStatus) {
    if (!state.clusters.ready) {
      dom.clusterStatus.textContent = "No clusters yet.";
    } else {
      const { actualK, sampleSize, skipped } = state.clusters;
      const parts = [
        `${actualK} cluster${actualK === 1 ? "" : "s"}`,
        `${sampleSize} track${sampleSize === 1 ? "" : "s"}`
      ];
      if (skipped) parts.push(`${skipped} skipped`);
      dom.clusterStatus.textContent = `K-means: ${parts.join(" • ")}`;
    }
  }
  if (dom.clusterLegend) {
    if (!state.clusters.ready) {
      dom.clusterLegend.classList.add("cluster-legend--empty");
      dom.clusterLegend.textContent = "Run K-means to colour the scatter plot.";
    } else {
      dom.clusterLegend.classList.remove("cluster-legend--empty");
      dom.clusterLegend.innerHTML = clusterColors.map((color, idx) => {
        const count = state.clusters.counts[idx] || 0;
        return `<div class="cluster-chip"><span class="chip-swatch" style="background:${color}"></span>Cluster ${idx + 1}<span class="chip-count">${count}</span></div>`;
      }).join("");
    }
  }
  updateClusterControls();
}

function resetClusterState() {
  state.rows.forEach(row => {
    row._cluster = null;
  });
  state.clusters.ready = false;
  state.clusters.counts = Array(CLUSTER_COUNT).fill(0);
  state.clusters.sampleSize = 0;
  state.clusters.actualK = 0;
  state.clusters.skipped = 0;
  state.clusters.descriptions = Array(CLUSTER_COUNT).fill("");
  state.scatter.dirty = true;
  updateClusterUi();
  scheduleScatterRender(true);
}

function runKMeansClustering() {
  if (!state.rows.length) {
    log("Load a CSV before running clustering.", "err");
    return;
  }
  if (dom.runClustersBtn) dom.runClustersBtn.disabled = true;

  try {
    const activeDims = numericFields.filter(field => state.knn.dimensions[field]);
    if (!activeDims.length) {
      log("Enable at least one dimension before running clustering.", "err");
      resetClusterState();
      return;
    }

    const dims = activeDims.length;
    const completeRows = [];
    const dimMins = new Array(dims).fill(Infinity);
    const dimMaxs = new Array(dims).fill(-Infinity);
    let skipped = 0;
    state.rows.forEach(row => {
      const vector = [];
      let hasNull = false;
      for (let d = 0; d < dims; d++) {
        const field = activeDims[d];
        const val = row._values[field];
        if (val === null) {
          hasNull = true;
          break;
        }
        vector.push(val);
      }
      if (hasNull) {
        row._cluster = null;
        skipped++;
        return;
      }
      for (let d = 0; d < dims; d++) {
        const val = vector[d];
        if (val < dimMins[d]) dimMins[d] = val;
        if (val > dimMaxs[d]) dimMaxs[d] = val;
      }
      completeRows.push({ row, vector });
    });

    if (!completeRows.length) {
      resetClusterState();
      log("No tracks have complete data for the selected dimensions.", "err");
      return;
    }
    const means = new Array(dims).fill(0);
    completeRows.forEach(item => {
      for (let d = 0; d < dims; d++) means[d] += item.vector[d];
    });
    for (let d = 0; d < dims; d++) means[d] /= completeRows.length;

    const stds = new Array(dims).fill(0);
    completeRows.forEach(item => {
      for (let d = 0; d < dims; d++) {
        const diff = item.vector[d] - means[d];
        stds[d] += diff * diff;
      }
    });
    for (let d = 0; d < dims; d++) stds[d] = Math.sqrt(stds[d] / completeRows.length) || 1;

    const normalized = completeRows.map(item => item.vector.map((val, d) => (val - means[d]) / stds[d]));
    const actualK = Math.min(CLUSTER_COUNT, normalized.length);

    const indices = normalized.map((_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const centroids = [];
    for (let i = 0; i < actualK; i++) {
      const idx = indices[i % indices.length];
      centroids.push([...normalized[idx]]);
    }

    const assignments = new Array(normalized.length).fill(0);
    let changed = true;
    let iter = 0;
    const maxIter = 100;
    while (changed && iter < maxIter) {
      changed = false;
      iter++;
      for (let i = 0; i < normalized.length; i++) {
        const vector = normalized[i];
        let bestCluster = assignments[i];
        let bestDist = Infinity;
        for (let c = 0; c < actualK; c++) {
          const centroid = centroids[c];
          let dist = 0;
          for (let d = 0; d < dims; d++) {
            const diff = vector[d] - centroid[d];
            dist += diff * diff;
          }
          if (dist < bestDist) {
            bestDist = dist;
            bestCluster = c;
          }
        }
        if (assignments[i] !== bestCluster) {
          assignments[i] = bestCluster;
          changed = true;
        }
      }

      const sums = Array.from({ length: actualK }, () => new Array(dims).fill(0));
      const counts = new Array(actualK).fill(0);
      for (let i = 0; i < normalized.length; i++) {
        const cluster = assignments[i];
        const vector = normalized[i];
        counts[cluster]++;
        for (let d = 0; d < dims; d++) {
          sums[cluster][d] += vector[d];
        }
      }
      for (let c = 0; c < actualK; c++) {
        if (counts[c] === 0) {
          const idx = Math.floor(Math.random() * normalized.length);
          centroids[c] = [...normalized[idx]];
          changed = true;
        } else {
          for (let d = 0; d < dims; d++) {
            centroids[c][d] = sums[c][d] / counts[c];
          }
        }
      }
    }

    const counts = Array(CLUSTER_COUNT).fill(0);
    const clusterSums = Array.from({ length: actualK }, () => new Array(dims).fill(0));
    const clusterCounts = new Array(actualK).fill(0);
    state.rows.forEach(row => {
      row._cluster = null;
    });
    completeRows.forEach((item, idx) => {
      const cluster = assignments[idx];
      item.row._cluster = cluster;
      counts[cluster]++;
      clusterCounts[cluster]++;
      for (let d = 0; d < dims; d++) {
        clusterSums[cluster][d] += item.vector[d];
      }
    });

    const dimensionThresholds = activeDims.map((field, dimIdx) => {
      const min = dimMins[dimIdx];
      const max = dimMaxs[dimIdx];
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { field, min, max, lower: NaN, upper: NaN };
      }
      const range = max - min;
      if (range <= 0) {
        return { field, min, max, lower: min, upper: max };
      }
      const lower = min + range / 3;
      const upper = min + (2 * range) / 3;
      return { field, min, max, lower, upper };
    });

    const describeLevel = (value, stats) => {
      if (!Number.isFinite(value) || !Number.isFinite(stats.lower) || !Number.isFinite(stats.upper) || stats.max === stats.min) {
        return "Medium";
      }
      if (value <= stats.lower) return "Low";
      if (value >= stats.upper) return "High";
      return "Medium";
    };

    const formatField = (field) => field.replace(/_/g, " ").toLowerCase();

    const clusterDescriptions = Array(CLUSTER_COUNT).fill("");
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      if (c >= actualK) {
        clusterDescriptions[c] = "Cluster was not generated for the current sample.";
        continue;
      }
      if (clusterCounts[c] === 0) {
        clusterDescriptions[c] = "No tracks assigned to this cluster.";
        continue;
      }
      const phrases = activeDims.map((field, dimIdx) => {
        const average = clusterSums[c][dimIdx] / clusterCounts[c];
        const stats = dimensionThresholds[dimIdx];
        const level = describeLevel(average, stats);
        return `${level} ${formatField(field)}`;
      });
      clusterDescriptions[c] = `${phrases.join(", ")}.`;
    }

    state.clusters.ready = true;
    state.clusters.counts = counts;
    state.clusters.sampleSize = completeRows.length;
    state.clusters.actualK = actualK;
    state.clusters.skipped = skipped;
    state.clusters.descriptions = clusterDescriptions;
    state.scatter.dirty = true;
    updateClusterUi();
    scheduleScatterRender(true);

    const dimensionSummary = activeDims.join(", ");
    const summary = `K-means assigned ${actualK} cluster${actualK === 1 ? "" : "s"} to ${completeRows.length} track${completeRows.length === 1 ? "" : "s"}` +
      (skipped ? ` (${skipped} skipped)` : "") +
      ` using ${dims} dimension${dims === 1 ? "" : "s"} (${dimensionSummary}).`;
    log(summary, "ok");
  } catch (err) {
    console.error(err);
    log(`Clustering failed: ${err.message}`, "err");
  } finally {
    updateClusterControls();
  }
}

let filterListenersAttached = false;
function buildFilters() {
  dom.filtersContainer.innerHTML = "";
  numericFields.forEach(field => {
    const range = state.filters[field];
    const wrapper = document.createElement("div");
    wrapper.className = "filter-card";
    wrapper.dataset.field = field;
    wrapper.innerHTML = `
      <div class="filter-label">${field}</div>
      <div class="range-values"><span data-role="min">${range.min}</span><span data-role="max">${range.max}</span></div>
      <input type="range" class="filter-slider" data-field="${field}" data-bound="min" min="${range.absoluteMin}" max="${range.absoluteMax}" value="${range.min}" step="1" />
      <input type="range" class="filter-slider" data-field="${field}" data-bound="max" min="${range.absoluteMin}" max="${range.absoluteMax}" value="${range.max}" step="1" />
    `;
    dom.filtersContainer.appendChild(wrapper);
  });
}

function attachFilterListeners() {
  if (filterListenersAttached) return;
  dom.filtersContainer.addEventListener("input", (event) => {
    const target = event.target;
    if (!target.classList.contains("filter-slider")) return;
    const field = target.dataset.field;
    const bound = target.dataset.bound;
    const value = Number(target.value);
    const range = state.filters[field];
    if (bound === "min") {
      range.min = Math.min(value, range.max);
    } else {
      range.max = Math.max(value, range.min);
    }
    updateFilterLabels(field);
    scheduleViewRefresh();
  });
  filterListenersAttached = true;
}

function updateFilterLabels(field) {
  const range = state.filters[field];
  const wrapper = dom.filtersContainer.querySelector(`.filter-card[data-field="${field}"]`);
  if (!wrapper) return;
  const minEl = wrapper.querySelector('[data-role="min"]');
  const maxEl = wrapper.querySelector('[data-role="max"]');
  if (minEl) minEl.textContent = range.min;
  if (maxEl) maxEl.textContent = range.max;
  wrapper.querySelectorAll(".filter-slider").forEach(slider => {
    const bound = slider.dataset.bound;
    slider.value = range[bound];
  });
}

function buildKnnControls() {
  dom.knnDimContainer.innerHTML = "";
  numericFields.forEach(field => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `knn-dim-btn${state.knn.dimensions[field] ? " active" : ""}`;
    button.dataset.dim = field;
    button.textContent = field;
    button.setAttribute("aria-pressed", state.knn.dimensions[field] ? "true" : "false");
    dom.knnDimContainer.appendChild(button);
  });
}

function calculateDistance(rowA, rowB) {
  let sumSquares = 0;
  let activeCount = 0;
  for (const field of numericFields) {
    if (!state.knn.dimensions[field]) continue;
    const a = rowA._values[field];
    const b = rowB._values[field];
    if (a === null || b === null) continue;
    const { absoluteMin: min, absoluteMax: max } = state.filters[field];
    const span = max - min || 1;
    const normA = (a - min) / span;
    const normB = (b - min) / span;
    sumSquares += (normA - normB) ** 2;
    activeCount++;
  }
  return activeCount === 0 ? Infinity : Math.sqrt(sumSquares);
}

function findNearestNeighbors(rowId, exclude = new Set()) {
  const targetRow = state.rows[rowId];
  if (!targetRow) return [];
  const distances = state.rows.map((row, idx) => ({
    idx,
    distance: idx === rowId ? Infinity : calculateDistance(targetRow, row)
  }));
  const filtered = distances.filter(item => !exclude.has(item.idx));
  filtered.sort((a, b) => a.distance - b.distance);
  return filtered.slice(0, state.knn.k).map(item => item.idx);
}

function selectNeighbors(rowId) {
  const alreadySelected = new Set(state.selected);
  alreadySelected.add(rowId);
  const neighbors = findNearestNeighbors(rowId, alreadySelected);
  state.selected.add(rowId);
  let added = 0;
  neighbors.forEach(id => {
    if (!state.selected.has(id)) added++;
    state.selected.add(id);
  });
  updateSelectionCheckboxes();
  updateSelectedCount();
  log(`Added ${added} neighbouring track${added === 1 ? "" : "s"}.`, "ok");
}

function updateSelectionCheckboxes() {
  dom.csvBody.querySelectorAll(".rowCheckbox").forEach(cb => {
    const rowId = Number(cb.dataset.rowId);
    cb.checked = state.selected.has(rowId);
  });
  updateSelectAllState();
}

function toggleSelection(rowId) {
  if (state.selected.has(rowId)) state.selected.delete(rowId);
  else state.selected.add(rowId);
  updateSelectionCheckboxes();
  updateSelectedCount();
}
function computeScatterPoints() {
  const canvas = dom.scatter;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth || 520;
  const size = Math.min(width, 720);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padding = 42;
  const plotSize = size - padding * 2;
  const rangeX = state.filters[scatterFields.x] || { absoluteMin: 0, absoluteMax: 100 };
  const rangeY = state.filters[scatterFields.y] || { absoluteMin: 0, absoluteMax: 100 };
  const spanX = rangeX.absoluteMax - rangeX.absoluteMin || 1;
  const spanY = rangeY.absoluteMax - rangeY.absoluteMin || 1;

  const points = [];
  state.view.forEach((row, idx) => {
    const xVal = row._values[scatterFields.x];
    const yVal = row._values[scatterFields.y];
    if (xVal === null || yVal === null) return;
    const x = padding + ((xVal - rangeX.absoluteMin) / spanX) * plotSize;
    const y = size - padding - ((yVal - rangeY.absoluteMin) / spanY) * plotSize;
    const cluster = Number.isInteger(row._cluster) && row._cluster >= 0 && row._cluster < CLUSTER_COUNT ? row._cluster : null;
    const clusterColor = cluster !== null ? clusterColors[cluster] : null;
    points.push({
      x,
      y,
      rowId: row._idx,
      label: `${row.Title} • ${row.Artist || row.Spotify_Artists || "Unknown"}`,
      selected: state.selected.has(row._idx),
      idx,
      cluster,
      clusterColor
    });
  });

  state.scatter.points = points;
  state.scatter.dirty = false;
  return { ctx, size, padding };
}

function renderScatter() {
  if (!dom.scatter) return;
  let ctx, size, padding;
  if (state.scatter.dirty) {
    ({ ctx, size, padding } = computeScatterPoints());
  } else {
    const dpr = window.devicePixelRatio || 1;
    size = dom.scatter.height / dpr || dom.scatter.clientWidth || 520;
    padding = 42;
    ctx = dom.scatter.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const points = state.scatter.points;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#e5e9ef";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, size - padding);
  ctx.lineTo(size - padding, size - padding);
  ctx.stroke();

  ctx.strokeStyle = "#f1f3f6";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  const gridSpan = size - padding * 2;
  for (let i = 0; i <= 100; i += 20) {
    const x = padding + (i / 100) * gridSpan;
    ctx.beginPath();
    ctx.moveTo(x, size - padding);
    ctx.lineTo(x, padding);
    ctx.stroke();
    ctx.fillText(i, x, size - padding + 16);
  }
  ctx.save();
  ctx.translate(12, size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Energy", 0, 0);
  ctx.restore();
  ctx.fillText("Valence", size / 2, size - 12);

  points.forEach(point => {
    const isHover = point.rowId === state.scatter.hoverId;
    const isFocused = point.rowId === state.scatter.lastActivatedId;
    const radius = isFocused ? 9 : isHover ? 8 : 6;
    const baseColor = point.clusterColor || (point.selected ? "#1db954" : "rgba(16,18,26,0.65)");

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = isHover || isFocused ? 1 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (point.selected) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 1, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(17,23,41,0.85)";
      ctx.stroke();
    }
    if (isFocused) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = point.clusterColor || "#111827";
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

function findPointAt(x, y) {
  let best = null;
  let minDist = 10;
  for (const point of state.scatter.points) {
    const dist = Math.hypot(point.x - x, point.y - y);
    if (dist < minDist) {
      minDist = dist;
      best = point;
    }
  }
  return best;
}

function handleScatterMove(event) {
  const rect = dom.scatter.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const point = findPointAt(mx, my);
  const tooltip = dom.scatterTooltip;

  if (point) {
    if (state.scatter.hoverId !== point.rowId) {
      state.scatter.hoverId = point.rowId;
      scheduleScatterRender();
    }
    tooltip.textContent = `${point.label} — double-tap or press the button to add neighbours`;
    tooltip.style.display = "block";
    const width = tooltip.offsetWidth || 240;
    const offsetX = Math.min(event.clientX + 14, window.innerWidth - width - 12);
    const offsetY = Math.max(event.clientY - 24, 12);
    tooltip.style.left = `${offsetX}px`;
    tooltip.style.top = `${offsetY}px`;
  } else {
    if (state.scatter.hoverId !== null) {
      state.scatter.hoverId = null;
      scheduleScatterRender();
    }
    tooltip.style.display = "none";
  }
}

const DOUBLE_TAP_MS = 350;

function handleScatterClick(event) {
  const rect = dom.scatter.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const point = findPointAt(mx, my);
  if (!point) return;
  const now = Date.now();
  const isDoubleTap = state.scatter.lastTapId === point.rowId && (now - state.scatter.lastTapTime) <= DOUBLE_TAP_MS;
  state.scatter.lastTapId = point.rowId;
  state.scatter.lastTapTime = now;
  setScatterFocus(point.rowId);
  if (isDoubleTap) {
    state.scatter.skipNextDblClick = true;
    selectNeighbors(point.rowId);
    return;
  }
  toggleSelection(point.rowId);
}

function handleScatterDblClick(event) {
  if (state.scatter.skipNextDblClick) {
    state.scatter.skipNextDblClick = false;
    return;
  }
  const rect = dom.scatter.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const point = findPointAt(mx, my);
  if (!point) return;
  setScatterFocus(point.rowId);
  selectNeighbors(point.rowId);
}

async function loadCsv(path) {
  return new Promise((resolve, reject) => {
    if (!window.Papa) return reject(new Error("Papa Parse failed to load."));
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err)
    });
  });
}

function normalizeHeaders(obj) {
  const map = {};
  Object.keys(obj).forEach(k => {
    const nk = k.replace(/\s+/g, "_");
    map[nk] = obj[k];
  });
  return map;
}

function bootstrapFilters() {
  numericFields.forEach(field => {
    const values = state.rows.map(row => row._values[field]).filter(val => val !== null);
    const absoluteMin = values.length ? Math.floor(Math.min(...values)) : 0;
    const absoluteMax = values.length ? Math.ceil(Math.max(...values)) : 100;
    state.filters[field] = {
      absoluteMin,
      absoluteMax,
      min: absoluteMin,
      max: absoluteMax
    };
  });
  buildFilters();
  attachFilterListeners();
}

async function addTracksInChunks(playlistId, uris, logPrefix = "") {
  if (!uris.length) return;
  const chunkSize = 100;
  let addedCount = 0;
  for (let i = 0; i < uris.length; i += chunkSize) {
    const batch = uris.slice(i, i + chunkSize);
    const addResp = await apiFetch(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: batch })
    });
    if (!addResp.ok) throw new Error(JSON.stringify(addResp.json));
    addedCount += batch.length;
    const prefix = logPrefix ? `${logPrefix} ` : "";
    log(`${prefix}Added ${addedCount}/${uris.length} track(s)…`, "ok");
  }
}

async function createPlaylistAndAddTracks() {
  try {
    const playlistName = dom.playlistName.value.trim() || "PKCE Demo Playlist";
    const selectedUris = Array.from(state.selected)
      .map(id => state.rows[id]?.Spotify_URI)
      .filter(uri => uri && uri.length > 0);
    if (!selectedUris.length) {
      log("No tracks selected.", "err");
      return;
    }
    log("Fetching your profile (/me)…");
    const me = await apiFetch("/me");
    if (!me.ok) throw new Error(JSON.stringify(me.json));
    const userId = me.json.id;
    log(`Hello ${me.json.display_name || userId}!`, "ok");
    log(`Creating playlist "${playlistName}"…`);
    const newPl = await apiFetch(`/users/${encodeURIComponent(userId)}/playlists`, {
      method: "POST",
      body: JSON.stringify({
        name: playlistName,
        description: "Created by Spotify CSV Browser",
        public: false
      })
    });
    if (!newPl.ok) throw new Error(JSON.stringify(newPl.json));
    const playlistId = newPl.json.id;
    log(`Created: ${newPl.json.name}`, "ok");
    log(`Adding ${selectedUris.length} track(s) to playlist…`);
    await addTracksInChunks(playlistId, selectedUris);
    log(`Added ${selectedUris.length} track(s) successfully!`, "ok");
  } catch (err) {
    log(`Error: ${err.message}`, "err");
    console.error(err);
  }
}

async function createClusterPlaylists() {
  if (!state.clusters.ready) {
    log("Run K-means before creating cluster playlists.", "err");
    return;
  }
  if (dom.createClusterPlaylistsBtn) dom.createClusterPlaylistsBtn.disabled = true;

  try {
    const baseName = dom.playlistName.value.trim() || "PKCE Demo Playlist";
    const clusterUris = Array.from({ length: CLUSTER_COUNT }, () => []);
    let missingUris = 0;
    state.rows.forEach(row => {
      const cluster = row._cluster;
      if (!Number.isInteger(cluster) || cluster < 0 || cluster >= CLUSTER_COUNT) return;
      const uri = row.Spotify_URI;
      if (uri && uri.length > 0) clusterUris[cluster].push(uri);
      else missingUris++;
    });

    const totalTracks = clusterUris.reduce((sum, group) => sum + group.length, 0);
    if (!totalTracks) {
      log("No clustered tracks with Spotify URIs are available.", "err");
      return;
    }

    log("Fetching your profile (/me)…");
    const me = await apiFetch("/me");
    if (!me.ok) throw new Error(JSON.stringify(me.json));
    const userId = me.json.id;
    log(`Hello ${me.json.display_name || userId}!`, "ok");

    const clusterDescriptions = state.clusters.descriptions || [];
    for (let i = 0; i < CLUSTER_COUNT; i++) {
      const uris = clusterUris[i];
      const playlistName = `${baseName} #${i + 1}`;
      log(`Creating playlist "${playlistName}" for cluster ${i + 1} (${uris.length} track${uris.length === 1 ? "" : "s"})…`);
      const description = clusterDescriptions[i] && clusterDescriptions[i].trim().length
        ? clusterDescriptions[i]
        : `Cluster ${i + 1} generated by Spotify CSV Browser`;
      const newPl = await apiFetch(`/users/${encodeURIComponent(userId)}/playlists`, {
        method: "POST",
        body: JSON.stringify({
          name: playlistName,
          description,
          public: false
        })
      });
      if (!newPl.ok) throw new Error(JSON.stringify(newPl.json));
      const playlistId = newPl.json.id;
      if (uris.length) {
        await addTracksInChunks(playlistId, uris, `Cluster ${i + 1}:`);
        log(`Cluster ${i + 1}: added ${uris.length} track(s) successfully!`, "ok");
      } else {
        log(`Cluster ${i + 1}: playlist created with no tracks.`, "");
      }
    }

    if (missingUris) {
      log(`${missingUris} track${missingUris === 1 ? "" : "s"} lacked Spotify URIs and were skipped.`, "err");
    }
  } catch (err) {
    log(`Cluster playlist creation failed: ${err.message}`, "err");
    console.error(err);
  } finally {
    updateClusterControls();
  }
}

function resetFilters() {
  numericFields.forEach(field => {
    const range = state.filters[field];
    if (!range) return;
    range.min = range.absoluteMin;
    range.max = range.absoluteMax;
    updateFilterLabels(field);
  });
  scheduleViewRefresh();
}

function setupEvents() {
  dom.loginBtn.addEventListener("click", beginLogin);
  dom.createPlaylistBtn.addEventListener("click", createPlaylistAndAddTracks);
  if (dom.createClusterPlaylistsBtn) {
    dom.createClusterPlaylistsBtn.addEventListener("click", createClusterPlaylists);
  }
  if (dom.runClustersBtn) {
    dom.runClustersBtn.addEventListener("click", runKMeansClustering);
  }

  dom.loadCsvBtn.addEventListener("click", async () => {
    const path = dom.csvPath.value.trim() || "songs.csv";
    try {
      log(`Loading ${path}…`);
      const data = await loadCsv(path);
      state.rows = data.map((row, idx) => {
        const normalized = normalizeHeaders(row);
        normalized._idx = idx;
        normalized._values = {};
        numericFields.forEach(field => {
          normalized._values[field] = getNumericValue(normalized[field]);
        });
        normalized._cluster = null;
        normalized._haystack = [normalized.Title, normalized.Artist, normalized.Release, normalized.Spotify_Artists]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return normalized;
      });
      resetClusterState();
      state.selected.clear();
      state.search = dom.filterInput.value.trim().toLowerCase();
      state.scatter.dirty = true;
      bootstrapFilters();
      refreshView();
      log(`Loaded ${state.rows.length} rows.`, "ok");
    } catch (err) {
      console.error(err);
      log(`Failed to load CSV: ${err.message}`, "err");
    }
  });

  dom.filterInput.addEventListener("input", debounce(event => {
    state.search = event.target.value.trim().toLowerCase();
    scheduleViewRefresh();
  }, 180));

  dom.selectAll.addEventListener("change", event => {
    if (event.target.checked) {
      state.view.forEach(row => state.selected.add(row._idx));
    } else {
      state.view.forEach(row => state.selected.delete(row._idx));
    }
    updateSelectionCheckboxes();
    updateSelectedCount();
  });

  dom.deselectAllBtn.addEventListener("click", () => {
    state.selected.clear();
    updateSelectionCheckboxes();
    updateSelectedCount();
  });

  dom.knnK.addEventListener("change", event => {
    const value = Number(event.target.value);
    if (Number.isFinite(value) && value >= 1 && value <= 50) {
      state.knn.k = value;
      log(`KNN k set to ${value}`, "ok");
    } else {
      event.target.value = state.knn.k;
    }
  });

  dom.knnDimContainer.addEventListener("click", event => {
    const button = event.target.closest(".knn-dim-btn");
    if (!button) return;
    const field = button.dataset.dim;
    const nextState = !state.knn.dimensions[field];
    if (!nextState && Object.values(state.knn.dimensions).filter(Boolean).length === 1) {
      log("At least one dimension must remain enabled.", "err");
      return;
    }
    state.knn.dimensions[field] = nextState;
    button.classList.toggle("active", nextState);
    button.setAttribute("aria-pressed", nextState ? "true" : "false");
    log(`${field} ${nextState ? "enabled" : "disabled"}.`, "ok");
    if (state.clusters.ready) {
      resetClusterState();
      log("Cleared existing clusters after dimension change. Re-run K-means to update.", "ok");
    }
    scheduleScatterRender(true);
  });

  dom.tableHead.addEventListener("click", event => {
    const th = event.target.closest("th[data-key]");
    if (!th) return;
    const key = th.dataset.key;
    if (!key) return;
    if (state.sort.key === key) {
      state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
    } else {
      state.sort.key = key;
      state.sort.dir = "asc";
    }
    refreshView();
  });

  dom.csvBody.addEventListener("change", event => {
    if (!event.target.classList.contains("rowCheckbox")) return;
    const rowId = Number(event.target.dataset.rowId);
    if (event.target.checked) state.selected.add(rowId);
    else state.selected.delete(rowId);
    updateSelectAllState();
    updateSelectedCount();
  });

  dom.csvBody.addEventListener("click", event => {
    const button = event.target.closest(".knn-btn");
    if (button) {
      const row = button.closest("tr[data-row-id]");
      if (row) selectNeighbors(Number(row.dataset.rowId));
      return;
    }
    if (event.target.closest("a")) return;
    if (event.target.classList.contains("rowCheckbox")) return;
    const row = event.target.closest("tr[data-row-id]");
    if (!row) return;
    toggleSelection(Number(row.dataset.rowId));
  });

  dom.csvBody.addEventListener("dblclick", event => {
    if (event.target.closest("a")) return;
    const row = event.target.closest("tr[data-row-id]");
    if (!row) return;
    selectNeighbors(Number(row.dataset.rowId));
  });

  if (dom.scatter) {
    dom.scatter.addEventListener("click", handleScatterClick);
    dom.scatter.addEventListener("dblclick", handleScatterDblClick);
    dom.scatter.addEventListener("mousemove", handleScatterMove);
    dom.scatter.addEventListener("mouseleave", () => {
      state.scatter.hoverId = null;
      dom.scatterTooltip.style.display = "none";
      scheduleScatterRender();
    });
  }

  if (dom.scatterKnnBtn) {
    dom.scatterKnnBtn.addEventListener("click", () => {
      const rowId = state.scatter.lastActivatedId;
      if (rowId === null) return;
      selectNeighbors(rowId);
    });
  }

  dom.resetFiltersBtn.addEventListener("click", resetFilters);
  window.addEventListener("resize", () => scheduleScatterRender(true));
  updateScatterKnnUi();
}

async function initAuth() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (error) {
    log(`Auth error: ${error}`, "err");
  }

  if (code) {
    try {
      log("Exchanging authorization code for access token…");
      await exchangeCodeForToken(code);
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthStatus("✓ Logged in");
      dom.createPlaylistBtn.disabled = state.selected.size === 0;
      log("Logged in successfully!", "ok");
    } catch (err) {
      log(`Token exchange failed: ${err.message}`, "err");
    }
  } else if (localStorage.getItem("access_token")) {
    setAuthStatus("✓ Logged in");
    dom.createPlaylistBtn.disabled = state.selected.size === 0;
    log("Token present.", "ok");
  } else {
    setAuthStatus("Not logged in");
    log("CSV features work without login. Log in to create playlists.", "");
  }
  updateClusterControls();
}

buildKnnControls();
attachFilterListeners();
updateClusterUi();
setupEvents();
initAuth();
updateSelectedCount();
scheduleScatterRender(true);
