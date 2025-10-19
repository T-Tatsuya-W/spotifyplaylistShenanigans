# 🎵 Spotify Music Tools

A collection of powerful tools for managing and analyzing your Spotify music data, featuring playlist processing and interactive music analysis with advanced filtering capabilities.

## 📋 Applications Overview

### 1. **Playlist Processor** (`playlist_processor.py`)

- **Purpose**: Enriches CSV music data with Spotify metadata and audio features
- **Features**: Fetches track details, audio features (energy, valence, tempo), and generates Spotify URIs
- **Output**: Enhanced CSV database ready for analysis

### 2. **Music Analyzer** (`music_analyzer.html` + `music_server.py`)

- **Purpose**: Interactive web-based music analysis and playlist creation tool
- **Features**: 
  - 🎛️ Advanced audio feature filtering (Energy, Valence, Tempo, etc.)
  - 📊 Interactive scatter plot visualization (Valence vs Energy)
  - 🎯 Box/lasso selection tools for precise song selection
  - 📈 Real-time histograms showing data distribution
  - 🎵 **Spotify playlist creation** (requires authentication)
  - 📁 JSON playlist download (no authentication needed)
  - 📱 Responsive design that fits perfectly in viewport
- Tracks which playlist each song came from

## 🚀 Quick Start

### Prerequisites

```bash
pip install requests pandas python-dotenv
```

### 1. Setup (One Time Only)

```bash
# Install dependencies
pip install beautifulsoup4 pandas spotipy python-dotenv

# Set up Spotify API credentials (create .env file)
cp .env.template .env

# Edit .env and add your Spotify Client ID
# 1. Go to https://developer.spotify.com/dashboard
# 2. Create an app, get Client ID and Secret
# 3. Add to .env file (already configured)
```

### 2. Process Your Playlist Data

```bash
# Enrich your CSV with Spotify metadata
python3 playlist_processor.py
```

**That's it!** Just save your playlist as "Sort Your Music.html" and run the script.

### 3. Launch Music Analyzer

```bash
# Start the web application
python3 music_server.py

# Or use the launcher (auto-opens browser)
python3 launch_analyzer.py
```

**Access**: Open http://localhost:8000/music_analyzer.html

## 📁 Output Files

| File | Description |
|------|-------------|
| `spotify_master_database.csv` | **Main database** - All your music with Spotify IDs |
| Individual HTML files | Keep these organized by playlist name |

### Master Database Columns

**Original Data:** Order, Title, Artist, Release, BPM, Energy, Dance, Loud, Valence, Length, Acoustic, Popularity, Artist_Separation, Random

**Spotify Data:** Spotify_Track_ID, Spotify_URI, Spotify_Track_Name, Spotify_Artists, Spotify_Album, Spotify_Release_Date, Spotify_Popularity, Preview_URL, Spotify_URL, Match_Confidence

**Metadata:** Source_HTML, Processed_Date

## 🎯 Key Features

### ✅ Duplicate Prevention

- Uses Spotify Track IDs to detect duplicates
- Safely process the same playlist multiple times
- Build database from overlapping playlists

### 📈 Database Growth

Playlist 1: 30 songs  → Database: 30 songs  
Playlist 2: 25 songs  → Database: 45 songs (15 new)  
Playlist 3: 40 songs  → Database: 70 songs (25 new)

### 🎯 High Match Rate

- ~95-100% Spotify match success rate
- Intelligent search with fallback strategies
- Confidence ratings for each match

## 💡 Use Cases

### 🎵 Playlist Creation

```python
import pandas as pd

df = pd.read_csv('spotify_master_database.csv')
uris = df['Spotify_URI'].tolist()

# Create playlists with Spotify Web API
```

### 📊 Music Analysis

```python
# Analyze your music taste across multiple playlists
high_energy = df[df['Energy'].astype(int) > 80]
chill_vibes = df[df['Valence'].astype(int) > 70]
workout_songs = df[df['BPM'].astype(int) > 120]
```

### 🔍 Smart Filtering

```python
# Find songs by attributes
recent_releases = df[df['Spotify_Release_Date'] > '2023-01-01']
popular_tracks = df[df['Spotify_Popularity'].astype(int) > 50]
acoustic_songs = df[df['Acoustic'].astype(int) > 60]
```

### Adding New Playlists

1. **Go to Sort Your Music website**
2. **Login with Spotify and select playlist**
3. **Save page as HTML** (`Ctrl+S` → "Sort Your Music.html")
4. **Run processor:** `python playlist_processor.py`
5. **Watch database grow!** (auto-cleanup included)

### Database Management

- **No cleanup needed** - duplicates handled automatically
- **Keep HTML files** for reference and re-processing
- **Database grows incrementally** with each new playlist

### Batch Processing

```bash
# Process multiple playlists at once
for playlist in *.html; do
    python playlist_processor.py "$playlist"
done
```

### Custom Analysis

```python
# Your own analysis scripts
import pandas as pd

df = pd.read_csv('spotify_master_database.csv')

# Most common artists
top_artists = df['Artist'].value_counts().head(10)

# Audio feature analysis
avg_energy = df['Energy'].astype(int).mean()
avg_bpm = df['BPM'].astype(int).mean()

# Playlist source analysis
playlist_sizes = df['Source_HTML'].value_counts()
```

## 🔧 Configuration

### Spotify API Setup

1. **Get Spotify Credentials**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Copy your **Client ID**

2. **Configure Redirect URI** (for playlist creation):
   - Add `http://127.0.0.1:8000/` to your app's redirect URIs

3. **Set Environment Variables**:
   ```bash
   # Copy template and edit
   cp .env.template .env

   # Add your Client ID to .env
   SPOTIFY_CLIENT_ID=your_client_id_here
   ```

### CSV Data Format

Your input CSV should contain columns like:
- `Track`: Song title
- `Artist`: Artist name  
- `Album`: Album name
- `Spotify_Release_Date`: Release date (YYYY-MM-DD format)

The processor will add:
- `BPM`, `Energy`, `Dance`, `Loud`, `Valence`, `Acoustic`, `Spotify_Popularity`
- `Length`, `Spotify_Track_ID`, `Spotify_URI`
- `Release_Year` (extracted from release date)

## 🎨 Interface Features

### 🎛️ **Filter Controls**

- **Audio Features**: Energy, Valence, Tempo, Danceability, Loudness, Acousticness
- **Metadata**: Release Year, Spotify Popularity, Song Length
- **Real-time Updates**: Visualization updates as you adjust filters

### 📊 **Visualization**

- **Main Plot**: Valence vs Energy scatter plot with genre-based coloring
- **Selection Feedback**: Selected songs highlighted in Spotify green
- **Interactive Tools**: Zoom, pan, box select, lasso select
- **Statistics Panel**: Live counts and selection info

### 🎵 **Playlist Management**

- **Spotify Mode**: Creates actual playlists (requires login)
- **Download Mode**: Exports JSON files (no login needed)
- **Smart Naming**: Auto-generates descriptive playlist names with timestamps
- **Progress Feedback**: Real-time status updates during creation

## 📊 Current Status

Run `python usage_guide.py` to see:
- Total tracks in database
- Playlists processed
- Top artists and audio features
- Spotify match success rate
- Last updated timestamp

## ⚡ Pro Tips

1. **Name HTML files descriptively:** "Chill Sunday Vibes.html" not "Sort Your Music.html"
2. **Process regularly:** Add new playlists as you discover music
3. **No duplicates:** Safe to reprocess same playlists
4. **Use the data:** Create smart playlists, analyze your taste, export to other platforms
5. **Keep backups:** The CSV file is your music database treasure!

## 🛠️ Troubleshooting

### Common Issues

**"No music data found"**
- Ensure `spotify_master_database.csv` exists
- Run `playlist_processor.py` first to generate the database

**"Spotify authentication failed"**
- Check your Client ID in `.env`
- Verify redirect URI is `http://127.0.0.1:8000/` in your Spotify app settings
- Clear browser cache and try again

**"Port already in use"**
- Close other applications using port 8000
- Or specify a different port: `python3 music_server.py 3001`

### Performance Tips
- Filter your data before making large selections
- Use box/lasso selection for efficient multi-song selection
- Large datasets (>1000 songs) may have slower visualization updates

## 📚 Technical Details

### Architecture
- **Frontend**: Vanilla HTML/CSS/JavaScript with Plotly.js for visualizations
- **Backend**: Python HTTP server with Spotify Web API integration  
- **Authentication**: OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- **Layout**: CSS Grid with viewport-constrained design (100vh)

### Security
- Secure OAuth flow with PKCE challenge/verifier pairs
- No client secrets stored (public client pattern)
- Session-based token storage with automatic cleanup

---

# Spotify Playlist Fetcher

A simple web app to fetch and display your Spotify playlists and their tracks.

## Features
- Login with Spotify
- Fetch and display playlists
- View tracks in a selected playlist

## Setup

### Hosting Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/your-github-username/spotifyplaylistShenanigans.git
   cd spotifyplaylistShenanigans
   ```
2. Start a local HTTP server:
   - On Python 3:
     ```bash
     python -m http.server 8000
     ```
   - On Node.js:
     ```bash
     npx http-server -p 8000
     ```
3. Open `http://localhost:8000` in your browser.

### Hosting on GitHub Pages
1. Push the repository to GitHub.
2. Go to the repository settings and enable GitHub Pages.
3. Set the branch to `main` (or `master`) and the folder to `/root`.
4. Access your app at `https://your-github-username.github.io/spotifyplaylistShenanigans/`.

## Notes
- Update the `CLIENT_ID` in `index.html` with your Spotify app's client ID.
- Ensure the redirect URI in your Spotify app matches the hosting URL.

---

## 🎉 Enjoy Your Music Analysis!

These tools provide a complete workflow from raw music data to intelligent playlist creation. The interactive analyzer makes it easy to discover musical patterns and create playlists based on mood, energy, and other audio characteristics.

**Happy Music Exploring! 🎵**