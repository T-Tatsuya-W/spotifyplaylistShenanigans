# Spotify CSV Browser

A lightweight, static HTML application for browsing and filtering Spotify track data from CSV files. Features PKCE authentication, live search, sorting, and direct links to Spotify tracks.

## Features

- **CSV Upload**: Load track data from local CSV files
- **Live Filtering**: Search by title, artist, album, or any field
- **Sortable Columns**: Click headers to sort by any field (numeric or text)
- **Spotify Integration**: Direct links to open tracks in Spotify
- **Checkbox Selection**: Select multiple tracks with checkboxes
- **PKCE Auth**: Secure Spotify authentication (OAuth 2.0 with PKCE)
- **Responsive Design**: Clean, modern UI that works on desktop and mobile

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Your CSV file in the same directory as `index.html` (or adjust the path)

### Local Testing with Python

To test the app locally without authentication issues:

```bash
cd c:\Users\Toby T Watkinson\SPOT\spotifyplaylistShenanigans
python3 -m http.server 8000
```

Then open your browser to `http://localhost:8000`. All CSV features work without login, making this ideal for testing data loading, filtering, sorting, and selection.

### Setup

1. Clone or download this project
2. Place your CSV file next to `index.html`:
   ```
   spotifyplaylistShenanigans/
   ├── index.html
   ├── songs.csv          (or your CSV filename)
   └── README.md
   ```
3. Open `index.html` in your browser (or use the Python server above)
4. Enter your CSV path (default: `songs.csv`) and click **Load CSV**

### CSV Format

Your CSV should include columns like:
- `Title` — Track name
- `Artist` — Artist name
- `Release` — Release date or album name
- `BPM` — Beats per minute (numeric)
- `Energy` — Energy level (numeric)
- `Dance` — Danceability (numeric)
- `Valence` — Valence/mood (numeric)
- `Spotify_URL` or `Spotify_Track_ID` — Link to Spotify

Additional columns are preserved and searchable.

## Usage

### Loading Data
1. Enter the path to your CSV file (default: `songs.csv`)
2. Click **Load CSV**
3. Rows appear in the table below

### Filtering
Type in the search box to filter by title, artist, album, or any content. Filtering happens live as you type.

### Sorting
Click any column header (with ▲ or ▼) to sort ascending/descending. Numeric columns are sorted numerically.

### Opening in Spotify
If your CSV includes a `Spotify_URL` or `Spotify_Track_ID` column, an **Open** link appears. Click it to open the track in Spotify.

### Selecting Tracks
Use the checkbox in each row to select tracks, or click **Select All** at the top to select all visible rows.

## Spotify Authentication (Optional)

This app includes PKCE OAuth 2.0 support for future Spotify API features. To enable:

1. Create a Spotify Developer app at [developer.spotify.com](https://developer.spotify.com)
2. Replace `CLIENT_ID` in `index.html` with your app's Client ID
3. Set your redirect URI to your hosting URL
4. Click **Log in** to authenticate

Currently, authentication is optional—the CSV browser works without it.

## Technical Details

- **Papa Parse**: Robust CSV parsing (handles quoted fields, commas, etc.)
- **PKCE Auth**: Secure, no backend required
- **Vanilla JavaScript**: No frameworks or build tools
- **Static HTML**: Single file, no server needed

## Browser Compatibility

- Chrome/Edge: ✓
- Firefox: ✓
- Safari: ✓
- Mobile browsers: ✓ (responsive)

## License

MIT

## Notes

- CSV files are loaded from the same directory as `index.html` or a relative path you specify
- Large CSV files (>100k rows) may be slow to filter/sort
- Spotify links require a Spotify account to open

# Spotify Playlist Database Builder

A small utility to extract playlist data exported from "Sort Your Music", enrich tracks with Spotify metadata, and maintain a cumulative CSV master database without duplicates.

---

## What this script does (high-level)

1. Prompts you to open Sort Your Music in your browser and asks you to save/export the playlist as `Sort Your Music.htm` in the script folder.
2. Parses the Sort Your Music HTML file and extracts rows from the table with id `song-table`.
3. Automatically detects a Spotify playlist link in the exported HTML (the <a id="playlist-title" href="..."> link inside the `single-playlist` div). If found, the script fetches the playlist's tracks via the Spotify Web API and uses those track entries to attach Spotify metadata/URIs directly to your exported rows.
4. If no playlist link is found in the HTML, the script will prompt you to optionally paste a Spotify playlist URL. If you skip that, the script falls back to per-track Spotify search for any tracks that are not matched from a playlist.
5. Merges Spotify metadata with the original row data.
6. Filters out tracks already present in the master CSV (deduplicated by Spotify Track ID).
7. Appends new tracks to the master CSV and writes the updated CSV to disk.
8. Prints a processing summary and removes expected clutter files.

---

## New: Playlist auto-detection & playlist-first matching (what changed)

- The exporter HTML (Sort Your Music.htm) includes a link to the playlist in the single-playlist header:
  - <a id="playlist-title" href="spotify:playlist:...">Playlist Name</a>
- The script now:
  - Reads that href automatically while parsing the HTML.
  - Extracts the playlist ID and fetches all tracks (paginated) from Spotify using the app's client credentials.
  - Builds an in-memory mapping of playlist tracks (normalized title + primary artist → Spotify metadata).
  - For each exported row, the script tries to match against that playlist map first — if matched, the Spotify metadata is attached directly and per-track searches are skipped for that row.
  - If no playlist match is found for a row, the script falls back to the previous behavior of searching the Spotify API by artist+title.

Benefits:
- Much faster and more accurate when you exported the same playlist: no need to search Spotify track-by-track.
- Preserves fallback behavior to keep robustness when the playlist link isn't present or is missing tracks.

---

## Processing steps (detailed)

1. Open Sort Your Music and export/save your playlist as `Sort Your Music.htm` into this folder.
2. Run `python playlist_processor.py`.
3. Script reads `Sort Your Music.htm`, locates `<table id="song-table">`, and extracts rows into dictionaries (normalizes some header names: `#` → `Order`, `Pop.` → `Popularity`, `A.Sep` → `Artist_Separation`, `Rnd` → `Random`).
4. While parsing, the script also looks for the playlist link: `<a id="playlist-title" href="...">`.
   - If found, it automatically fetches the playlist tracks from Spotify and attempts playlist-based matching.
   - If not found, the script prompts you to paste a Spotify playlist URL (optional). If you skip, per-track search is used.
5. Matching priority:
   - 1) Playlist-based match (normalized title + primary artist) → Match_Confidence = `playlist`
   - 2) Exact artist+track Spotify search → Match_Confidence = `high` / `medium` / `low`
   - 3) Not found → Match_Confidence = `not_found`
6. Matched Spotify metadata is merged into the row and appended to the master CSV if not a duplicate.

---

## Data fields and sources

- From Sort Your Music HTML table (export):
  - `Order`, `Artist`, `Title`, `Release`, `BPM`, `Energy`, `Dance`, `Loud`, `Valence`, `Length`, `Acoustic`, `Popularity`, `Artist_Separation`, `Random`, etc. (preserved as-is)
- Script-generated:
  - `Source_HTML` — filename of the export (e.g. `Sort Your Music.htm`)
  - `Processed_Date` — timestamp when processed
  - `Match_Confidence` — `playlist`, `high`, `medium`, `low`, or `not_found`
- From Spotify Web API (added when a match is found — either from the playlist or by search):
  - `Spotify_Track_ID`, `Spotify_URI`, `Spotify_Track_Name`, `Spotify_Artists`, `Spotify_Album`, `Spotify_Release_Date`, `Spotify_Popularity`, `Preview_URL`, `Spotify_URL`

---

## Deduplication logic

- Duplicates are detected using `Spotify_Track_ID` present in the master CSV.
- Only non-empty Spotify IDs are considered for duplication checks.
- Tracks matched from the playlist will provide Spotify IDs and be deduplicated as usual.

---

## Usage

1. Save your playlist from Sort Your Music as `Sort Your Music.htm` in this project folder.
2. Run:

```
python playlist_processor.py
```

3. The script will:
   - Attempt to open the Sort Your Music site for convenience.
   - Parse the exported HTML and auto-detect a playlist URL (no manual paste required).
   - If the HTML contains a playlist link, the script fetches that playlist and matches tracks directly.
   - If the HTML does not contain a playlist link, you can paste one when prompted or press Enter to skip and allow per-track searching.
4. The master CSV (default `spotify_master_database.csv`) is updated with new unique tracks.

---

## Requirements

- Python 3.7+
- Install dependencies:
  - pandas
  - spotipy
  - beautifulsoup4
  - python-dotenv

Example:
```
pip install pandas spotipy beautifulsoup4 python-dotenv
```

---

## Environment (.env)

Create a `.env` file with your Spotify API credentials:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

The script uses the Spotify client credentials flow to fetch playlist tracks and perform searches.

---

## Notes & Troubleshooting

- If the script reports "Spotify credentials not found", ensure the `.env` file is present and correct.
- If the HTML parsing fails, ensure the file is exported from Sort Your Music and contains `<table id="song-table">` and (optionally) `<a id="playlist-title" ...>`.
