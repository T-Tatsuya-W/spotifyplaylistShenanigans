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

### Setup

1. Clone or download this project
2. Place your CSV file next to `index.html`:
   ```
   spotifyplaylistShenanigans/
   ├── index.html
   ├── songs.csv          (or your CSV filename)
   └── README.md
   ```
3. Open `index.html` in your browser
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
