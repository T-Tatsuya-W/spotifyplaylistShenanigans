# 🎵 Spotify Music Tools# 🎵 Spotify Music Tools



A collection of powerful tools for managing and analyzing your Spotify music data, featuring playlist processing and interactive music analysis with advanced filtering capabilities.A collection of powerful tools for managing and analyzing your Spotify music data, featuring playlist processing and interactive music analysis with advanced filtering capabilities.



## 📋 Applications Overview## 📋 Applications Overview



### 1. **Playlist Processor** (`playlist_processor.py`)### 1. **Playlist Processor** (`playlist_processor.py`)

- **Purpose**: Enriches CSV music data with Spotify metadata and audio features- **Purpose**: Enriches CSV music data with Spotify metadata and audio features

- **Features**: Fetches track details, audio features (energy, valence, tempo), and generates Spotify URIs- **Features**: Fetches track details, audio features (energy, valence, tempo), and generates Spotify URIs

- **Output**: Enhanced CSV database ready for analysis- **Output**: Enhanced CSV database ready for analysis



### 2. **Music Analyzer** (`music_analyzer.html` + `music_server.py`)### 2. **Music Analyzer** (`music_analyzer.html` + `music_server.py`)

- **Purpose**: Interactive web-based music analysis and playlist creation tool- **Purpose**: Interactive web-based music analysis and playlist creation tool

- **Features**: - **Features**: 

  - 🎛️ Advanced audio feature filtering (Energy, Valence, Tempo, etc.)  - 🎛️ Advanced audio feature filtering (Energy, Valence, Tempo, etc.)

  - 📊 Interactive scatter plot visualization (Valence vs Energy)  - 📊 Interactive scatter plot visualization (Valence vs Energy)

  - 🎯 Box/lasso selection tools for precise song selection  - 🎯 Box/lasso selection tools for precise song selection

  - 📈 Real-time histograms showing data distribution  - 📈 Real-time histograms showing data distribution

  - 🎵 **Spotify playlist creation** (requires authentication)  - 🎵 **Spotify playlist creation** (requires authentication)

  - 📁 JSON playlist download (no authentication needed)  - 📁 JSON playlist download (no authentication needed)

  - 📱 Responsive design that fits perfectly in viewport  - 📱 Responsive design that fits perfectly in viewport

- Tracks which playlist each song came from

## 🚀 Quick Start

## 🏃‍♂️ Quick Start

### Prerequisites

```bash### 1. Setup (One Time Only)

# Install Python dependencies```bash

pip install requests pandas python-dotenv# Install dependencies (already done)

pip install beautifulsoup4 pandas spotipy python-dotenv

# Set up Spotify API credentials (create .env file)

cp .env.template .env# Get Spotify API credentials

# Edit .env and add your Spotify Client ID# 1. Go to https://developer.spotify.com/dashboard

```# 2. Create an app, get Client ID and Secret

# 3. Add to .env file (already configured)

### 1. Process Your Playlist Data```

```bash

# Enrich your CSV with Spotify metadata### 2. Process Any Playlist

python3 playlist_processor.py```bash

python playlist_processor.py

# This will:```

# - Read your music CSV data

# - Fetch Spotify track details and audio features**That's it!** Just save your playlist as "Sort Your Music.html" and run the script.

# - Generate spotify_master_database.csv

```## � Workflow



### 2. Launch Music Analyzer```bash

```bash# 1. Save your playlist as "Sort Your Music.html"

# Start the web application# 2. Process it

python3 music_server.pypython playlist_processor.py



# Or use the launcher (auto-opens browser)# 3. Check your growing database

python3 launch_analyzer.pypython usage_guide.py

``````



**Access**: Open http://localhost:8000/music_analyzer.html## 📁 Output Files



## 🎛️ Music Analyzer Usage| File | Description |

|------|-------------|

### **Basic Workflow**| `spotify_master_database.csv` | **Main database** - All your music with Spotify IDs |

1. **Filter Music**: Use sliders to narrow down songs by audio features| Individual HTML files | Keep these organized by playlist name |

2. **Visualize**: Explore the Valence vs Energy scatter plot

3. **Select Songs**: ### Master Database Columns

   - Click individual points to select/deselect**Original Data:** Order, Title, Artist, Release, BPM, Energy, Dance, Loud, Valence, Length, Acoustic, Popularity, Artist_Separation, Random

   - Use box selection tool to select regions

   - Use lasso tool for custom shapes**Spotify Data:** Spotify_Track_ID, Spotify_URI, Spotify_Track_Name, Spotify_Artists, Spotify_Album, Spotify_Release_Date, Spotify_Popularity, Preview_URL, Spotify_URL, Match_Confidence

4. **Create Playlist**: 

   - **With Spotify**: Login and create actual playlists**Metadata:** Source_HTML, Processed_Date

   - **Without Spotify**: Download JSON file

## 🎯 Key Features

### **Advanced Features**

### ✅ Duplicate Prevention

#### 🎯 **Selection Tools**- Uses Spotify Track IDs to detect duplicates

- **Point Selection**: Click scatter plot points to toggle selection- Safely process the same playlist multiple times

- **Box Selection**: Draw rectangles to select song groups  - Build database from overlapping playlists

- **Lasso Selection**: Draw custom shapes for precise selection

- **Deselect All**: Clear all selections with one click### 📈 Database Growth

```

#### 📊 **Data Visualization**Playlist 1: 30 songs  → Database: 30 songs

- **Scatter Plot**: Valence (happiness) vs Energy with color-coded genresPlaylist 2: 25 songs  → Database: 45 songs (15 new)

- **Histograms**: Real-time distribution charts for all audio featuresPlaylist 3: 40 songs  → Database: 70 songs (25 new)

- **Song Statistics**: Live counts of filtered and selected songs```



#### 🎵 **Spotify Integration**### 🎯 High Match Rate

- **Authentication**: Secure OAuth 2.0 with PKCE flow- ~95-100% Spotify match success rate

- **Playlist Creation**: Creates playlists directly in your Spotify account- Intelligent search with fallback strategies

- **User Context**: Shows your Spotify username after login- Confidence ratings for each match



## 📁 File Structure## 💡 Use Cases



```### 🎵 Playlist Creation

📦 datasaves/```python

├── 🎵 Core Applications# Use the Spotify URIs for programmatic playlist creation

│   ├── playlist_processor.py     # Spotify data enrichment toolimport pandas as pd

│   ├── music_analyzer.html       # Interactive web interfacedf = pd.read_csv('spotify_master_database.csv')

│   ├── music_server.py          # HTTP server for web appuris = df['Spotify_URI'].tolist()

│   └── launch_analyzer.py       # Quick launcher with auto-open# Create playlists with Spotify Web API

├── 📊 Data Files  ```

│   └── spotify_master_database.csv  # Enriched music database

├── ⚙️ Configuration### 📊 Music Analysis

│   ├── .env                     # Spotify API credentials (create from template)```python

│   └── .env.template           # Template for environment variables# Analyze your music taste across multiple playlists

└── 📖 Documentationhigh_energy = df[df['Energy'].astype(int) > 80]

    └── README.md               # This filechill_vibes = df[df['Valence'].astype(int) > 70]

```workout_songs = df[df['BPM'].astype(int) > 120]

```

## 🔧 Configuration

### 🔍 Smart Filtering

### Spotify API Setup```python

# Find songs by attributes

1. **Get Spotify Credentials**:recent_releases = df[df['Spotify_Release_Date'] > '2023-01-01']

   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)popular_tracks = df[df['Spotify_Popularity'].astype(int) > 50]

   - Create a new appacoustic_songs = df[df['Acoustic'].astype(int) > 60]

   - Copy your **Client ID**```



2. **Configure Redirect URI** (for playlist creation):## 🛠️ Workflow

   - Add `http://127.0.0.1:8000/` to your app's redirect URIs

### Adding New Playlists

3. **Set Environment Variables**:1. **Go to Sort Your Music website**

   ```bash2. **Login with Spotify and select playlist**

   # Copy template and edit3. **Save page as HTML** (`Ctrl+S` → "Sort Your Music.html")

   cp .env.template .env4. **Run processor:** `python playlist_processor.py`

   5. **Watch database grow!** (auto-cleanup included)

   # Add your Client ID to .env

   SPOTIFY_CLIENT_ID=your_client_id_here### Database Management

   ```- **No cleanup needed** - duplicates handled automatically

- **Keep HTML files** for reference and re-processing

### CSV Data Format- **Database grows incrementally** with each new playlist



Your input CSV should contain columns like:## 🔧 Advanced Usage

- `Track`: Song title

- `Artist`: Artist name  ### Batch Processing

- `Album`: Album name```bash

- `Spotify_Release_Date`: Release date (YYYY-MM-DD format)# Process multiple playlists at once

for playlist in *.html; do

The processor will add:    python playlist_processor.py "$playlist"

- `BPM`, `Energy`, `Dance`, `Loud`, `Valence`, `Acoustic`, `Spotify_Popularity`done

- `Length`, `Spotify_Track_ID`, `Spotify_URI````

- `Release_Year` (extracted from release date)

### Custom Analysis

## 🎨 Interface Features```python

# Your own analysis scripts

### 🎛️ **Filter Controls**import pandas as pd

- **Audio Features**: Energy, Valence, Tempo, Danceability, Loudness, Acousticness

- **Metadata**: Release Year, Spotify Popularity, Song Lengthdf = pd.read_csv('spotify_master_database.csv')

- **Real-time Updates**: Visualization updates as you adjust filters

# Most common artists

### 📊 **Visualization**top_artists = df['Artist'].value_counts().head(10)

- **Main Plot**: Valence vs Energy scatter plot with genre-based coloring

- **Selection Feedback**: Selected songs highlighted in Spotify green# Audio feature analysis

- **Interactive Tools**: Zoom, pan, box select, lasso selectavg_energy = df['Energy'].astype(int).mean()

- **Statistics Panel**: Live counts and selection infoavg_bpm = df['BPM'].astype(int).mean()



### 🎵 **Playlist Management**# Playlist source analysis

- **Spotify Mode**: Creates actual playlists (requires login)playlist_sizes = df['Source_HTML'].value_counts()

- **Download Mode**: Exports JSON files (no login needed)```

- **Smart Naming**: Auto-generates descriptive playlist names with timestamps

- **Progress Feedback**: Real-time status updates during creation## 📊 Current Status



## 🚀 Advanced UsageRun `python usage_guide.py` to see:

- Total tracks in database

### Custom Data Sources- Playlists processed

Replace `spotify_master_database.csv` with your own music data following the expected column format.- Top artists and audio features

- Spotify match success rate

### Server Configuration- Last updated timestamp

```bash

# Run on different port## ⚡ Pro Tips

python3 music_server.py 3000

1. **Name HTML files descriptively:** "Chill Sunday Vibes.html" not "Sort Your Music.html"

# Access at http://localhost:30002. **Process regularly:** Add new playlists as you discover music

```3. **No duplicates:** Safe to reprocess same playlists

4. **Use the data:** Create smart playlists, analyze your taste, export to other platforms

### Bulk Processing5. **Keep backups:** The CSV file is your music database treasure!

The playlist processor can handle large datasets efficiently with automatic rate limiting and error recovery.

---

## 🛠️ Troubleshooting

**🎉 You now have a powerful music database with Spotify integration!**

### Common Issues

Use it for playlist creation, music analysis, or building music apps. Each new playlist adds only unique tracks, so your database grows smarter over time.
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

## 🎉 Enjoy Your Music Analysis!

These tools provide a complete workflow from raw music data to intelligent playlist creation. The interactive analyzer makes it easy to discover musical patterns and create playlists based on mood, energy, and other audio characteristics.

**Happy Music Exploring! 🎵**