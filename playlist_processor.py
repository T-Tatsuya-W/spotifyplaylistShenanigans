#!/usr/bin/env python3
"""
Spotify Playlist Database Builder

All-in-one script that:
1. Extracts data from Sort Your Music HTML files
2. Enriches with Spotify track IDs and metadata
3. Builds a cumulative database without duplicates
4. Maintains a master CSV with all your playlist data

Usage:
    python playlist_processor.py <html_file>
    python playlist_processor.py "My New Playlist.html"
"""

import os
import sys
import csv
import re
import json
import time
import shutil
from typing import List, Dict, Optional, Set, Tuple
import pandas as pd
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import webbrowser  # added import

# Load environment variables
load_dotenv()

class PlaylistDatabaseBuilder:
    def __init__(self, master_csv_path: str = "spotify_master_database.csv"):
        """
        Initialize the playlist database builder
        
        Args:
            master_csv_path (str): Path to the master database CSV file
        """
        self.master_csv_path = master_csv_path
        self.temp_csv_path = "temp_playlist_data.csv"
        
        # Initialize Spotify API
        self.setup_spotify_api()
        
        # Track processing stats
        self.stats = {
            'new_tracks': 0,
            'duplicate_tracks': 0,
            'failed_matches': 0,
            'total_processed': 0
        }
    
    def setup_spotify_api(self):
        """Setup Spotify API client"""
        client_id = os.getenv('SPOTIFY_CLIENT_ID')
        client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            print("❌ Spotify credentials not found in .env file!")
            print("Please make sure your .env file contains:")
            print("SPOTIFY_CLIENT_ID=your_client_id")
            print("SPOTIFY_CLIENT_SECRET=your_client_secret")
            sys.exit(1)
        
        try:
            client_credentials_manager = SpotifyClientCredentials(
                client_id=client_id,
                client_secret=client_secret
            )
            self.sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)
            print("✅ Connected to Spotify API")
        except Exception as e:
            print(f"❌ Failed to connect to Spotify API: {e}")
            sys.exit(1)
    
    def extract_html_data(self, html_file_path: str) -> Tuple[List[Dict], Optional[str]]:
        """
        Extract song data from Sort Your Music HTML file
        
        Args:
            html_file_path (str): Path to HTML file
            
        Returns:
            (List[Dict], Optional[str]): List of song dictionaries and detected playlist URL (if any)
        """
        print(f"📄 Extracting data from: {html_file_path}")
        
        if not os.path.exists(html_file_path):
            raise FileNotFoundError(f"HTML file not found: {html_file_path}")
        
        with open(html_file_path, 'r', encoding='utf-8') as file:
            html_content = file.read()
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Try to find a Spotify playlist link inside the single-playlist area
        playlist_url = None
        playlist_link = soup.find('a', id='playlist-title')
        if playlist_link and playlist_link.get('href'):
            playlist_url = playlist_link.get('href').strip()
            print(f"   🔗 Detected playlist URL in HTML: {playlist_url}")
        
        # Find the song table
        table = soup.find('table', {'id': 'song-table'})
        if not table:
            raise ValueError("Could not find song-table in HTML file")
        
        # Get headers
        headers = []
        thead = table.find('thead')
        if thead:
            header_row = thead.find('tr')
            for th in header_row.find_all('th'):
                header_text = th.get_text(strip=True)
                headers.append(header_text)
        
        # Extract songs
        songs = []
        tbody = table.find('tbody')
        if tbody:
            for row in tbody.find_all('tr'):
                cells = row.find_all('td')
                if len(cells) >= len(headers):
                    song_data = {}
                    for i, cell in enumerate(cells[:len(headers)]):
                        if i < len(headers):
                            # Clean header names
                            header = headers[i].strip()
                            if header == '#':
                                header = 'Order'
                            elif header == 'Pop.':
                                header = 'Popularity'
                            elif header == 'A.Sep':
                                header = 'Artist_Separation'
                            elif header == 'Rnd':
                                header = 'Random'
                            
                            song_data[header] = cell.get_text(strip=True)
                    
                    # Add source file info
                    song_data['Source_HTML'] = os.path.basename(html_file_path)
                    song_data['Processed_Date'] = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
                    
                    songs.append(song_data)
        
        print(f"   📊 Extracted {len(songs)} tracks (playlist_url={'found' if playlist_url else 'not found'})")
        return songs, playlist_url
    
    def clean_search_query(self, artist: str, title: str) -> str:
        """Clean artist and title for better Spotify search results"""
        def clean_text(text):
            text = re.sub(r'[^\w\s\-\']', ' ', text)
            text = ' '.join(text.split())
            text = re.sub(r'\s*-\s*(feat|ft|featuring).*$', '', text, flags=re.IGNORECASE)
            text = re.sub(r'\s*\(.*\)$', '', text)
            return text.strip()
        
        clean_artist = clean_text(artist)
        clean_title = clean_text(title)
        
        query = f'artist:"{clean_artist}" track:"{clean_title}"'
        return query
    
    def search_spotify_track(self, artist: str, title: str) -> Optional[Dict]:
        """Search for track on Spotify and return metadata"""
        try:
            # Try exact search first
            query = self.clean_search_query(artist, title)
            results = self.sp.search(q=query, type='track', limit=10)
            
            if results['tracks']['items']:
                # Look for best match
                for track in results['tracks']['items']:
                    track_artists = [a['name'].lower() for a in track['artists']]
                    if artist.lower() in track_artists:
                        return {
                            'Spotify_Track_ID': track['id'],
                            'Spotify_URI': track['uri'],
                            'Spotify_Track_Name': track['name'],
                            'Spotify_Artists': ', '.join([a['name'] for a in track['artists']]),
                            'Spotify_Album': track['album']['name'],
                            'Spotify_Release_Date': track['album']['release_date'],
                            'Spotify_Popularity': track['popularity'],
                            'Preview_URL': track['preview_url'] or '',
                            'Spotify_URL': track['external_urls']['spotify'],
                            'Match_Confidence': 'high'
                        }
                
                # Return first result with medium confidence
                first_track = results['tracks']['items'][0]
                return {
                    'Spotify_Track_ID': first_track['id'],
                    'Spotify_URI': first_track['uri'],
                    'Spotify_Track_Name': first_track['name'],
                    'Spotify_Artists': ', '.join([a['name'] for a in first_track['artists']]),
                    'Spotify_Album': first_track['album']['name'],
                    'Spotify_Release_Date': first_track['album']['release_date'],
                    'Spotify_Popularity': first_track['popularity'],
                    'Preview_URL': first_track['preview_url'] or '',
                    'Spotify_URL': first_track['external_urls']['spotify'],
                    'Match_Confidence': 'medium'
                }
            
            # Try simpler search
            simple_query = f"{artist} {title}"
            results = self.sp.search(q=simple_query, type='track', limit=5)
            
            if results['tracks']['items']:
                first_track = results['tracks']['items'][0]
                return {
                    'Spotify_Track_ID': first_track['id'],
                    'Spotify_URI': first_track['uri'],
                    'Spotify_Track_Name': first_track['name'],
                    'Spotify_Artists': ', '.join([a['name'] for a in first_track['artists']]),
                    'Spotify_Album': first_track['album']['name'],
                    'Spotify_Release_Date': first_track['album']['release_date'],
                    'Spotify_Popularity': first_track['popularity'],
                    'Preview_URL': first_track['preview_url'] or '',
                    'Spotify_URL': first_track['external_urls']['spotify'],
                    'Match_Confidence': 'low'
                }
                
        except Exception as e:
            print(f"   ❌ Error searching for {artist} - {title}: {e}")
            
        return None
    
    # NEW: helper to extract playlist id from various spotify URLs/URIs
    def extract_playlist_id(self, playlist_url: str) -> Optional[str]:
        """
        Extract playlist ID from a Spotify playlist URL or URI.
        Examples:
            https://open.spotify.com/playlist/<id>
            spotify:playlist:<id>
        """
        if not playlist_url:
            return None
        # spotify URI
        m = re.search(r'spotify:playlist:([A-Za-z0-9]+)', playlist_url)
        if m:
            return m.group(1)
        # HTTP URL
        m = re.search(r'open\.spotify\.com/playlist/([A-Za-z0-9]+)', playlist_url)
        if m:
            return m.group(1)
        # Query param variant
        m = re.search(r'playlist\/([A-Za-z0-9]+)\?', playlist_url)
        if m:
            return m.group(1)
        # fallback: last path segment if looks like id
        m = re.search(r'([A-Za-z0-9]{22,})$', playlist_url)
        if m:
            return m.group(1)
        return None

    # NEW: fetch all tracks for a given playlist using Spotify API (no per-track search)
    def fetch_playlist_tracks(self, playlist_url: str) -> List[Dict]:
        """
        Fetch all tracks from a Spotify playlist and return a list of simplified track metadata.
        """
        playlist_id = self.extract_playlist_id(playlist_url)
        if not playlist_id:
            print(f"   ⚠️  Could not parse playlist ID from URL: {playlist_url}")
            return []

        print(f"🔗 Fetching tracks from playlist: {playlist_url}")
        tracks = []
        try:
            # use pagination
            limit = 100
            offset = 0
            while True:
                results = self.sp.playlist_items(playlist_id, offset=offset, limit=limit, fields="items.track(id,name,artists,album(name,release_date),popularity,preview_url,uri,external_urls),next")
                items = results.get('items', [])
                for item in items:
                    track = item.get('track')
                    if not track:
                        continue
                    tracks.append({
                        'Spotify_Track_ID': track.get('id', ''),
                        'Spotify_URI': track.get('uri', ''),
                        'Spotify_Track_Name': track.get('name', ''),
                        'Spotify_Artists': ', '.join([a.get('name', '') for a in track.get('artists', [])]),
                        'Spotify_Album': track.get('album', {}).get('name', ''),
                        'Spotify_Release_Date': track.get('album', {}).get('release_date', ''),
                        'Spotify_Popularity': track.get('popularity', ''),
                        'Preview_URL': track.get('preview_url') or '',
                        'Spotify_URL': (track.get('external_urls') or {}).get('spotify', '')
                    })
                if not results.get('next'):
                    break
                offset += limit
            print(f"   ✅ Found {len(tracks)} tracks in playlist")
        except Exception as e:
            print(f"   ❌ Error fetching playlist tracks: {e}")
        return tracks

    # NEW: normalize helper used for matching
    def _normalize(self, text: str) -> str:
        if not text:
            return ''
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s*\(.*\)$', '', text)
        text = re.sub(r'\s*-\s*(feat|ft|featuring).*$', '', text)
        return ' '.join(text.split()).strip()

    def enrich_with_spotify_data(self, songs: List[Dict], playlist_tracks: Optional[List[Dict]] = None) -> List[Dict]:
        """Enrich song data with Spotify information"""
        print(f"🔍 Enriching {len(songs)} tracks with Spotify data...")
        
        enriched_songs = []
        
        # Build playlist map for quick matching if provided
        playlist_map = {}
        if playlist_tracks:
            for t in playlist_tracks:
                n_title = self._normalize(t.get('Spotify_Track_Name', ''))
                first_artist = (t.get('Spotify_Artists') or '').split(',')[0].strip()
                n_artist = self._normalize(first_artist)
                key = f"{n_title}||{n_artist}"
                playlist_map.setdefault(key, []).append(t)
        
        for i, song in enumerate(songs):
            artist = song.get('Artist', '') or song.get('Artists', '')
            title = song.get('Title', '') or song.get('Track') or song.get('Name', '')
            
            print(f"   🎵 {i+1:2d}/{len(songs)}: {artist} - {title}")
            
            # Try playlist match first
            spotify_data = None
            if playlist_map:
                n_title = self._normalize(title)
                n_artist = self._normalize((artist or '').split(',')[0].strip())
                key = f"{n_title}||{n_artist}"
                candidates = playlist_map.get(key, [])
                # looser match: title-only where artist appears in artists string
                if not candidates:
                    for t in playlist_tracks:
                        if self._normalize(t.get('Spotify_Track_Name', '')) == n_title:
                            track_artists = self._normalize(t.get('Spotify_Artists', ''))
                            if n_artist and n_artist in track_artists:
                                candidates.append(t)
                if candidates:
                    spotify_data = candidates[0].copy()
                    spotify_data['Match_Confidence'] = 'playlist'
                    print(f"      🔗 Matched from playlist: {spotify_data.get('Spotify_Track_Name')}")
            
            # Fallback to search if no playlist match
            if not spotify_data:
                spotify_data = self.search_spotify_track(artist, title)
                if spotify_data:
                    conf_icon = "🎯" if spotify_data.get('Match_Confidence') == 'high' else "🔍" if spotify_data.get('Match_Confidence') == 'medium' else "❓"
                    print(f"      {conf_icon} Found: {spotify_data.get('Spotify_Track_Name')}")
                else:
                    spotify_data = {
                        'Spotify_Track_ID': '',
                        'Spotify_URI': '',
                        'Spotify_Track_Name': '',
                        'Spotify_Artists': '',
                        'Spotify_Album': '',
                        'Spotify_Release_Date': '',
                        'Spotify_Popularity': '',
                        'Preview_URL': '',
                        'Spotify_URL': '',
                        'Match_Confidence': 'not_found'
                    }
                    print(f"      ❌ Not found")
                    self.stats['failed_matches'] += 1
            
            # Merge original song data with Spotify data
            enriched_song = {**song, **spotify_data}
            enriched_songs.append(enriched_song)
            
            # Rate limiting
            time.sleep(0.1)
        
        return enriched_songs
    
    def load_existing_database(self) -> pd.DataFrame:
        """Load existing master database or create empty one"""
        if os.path.exists(self.master_csv_path):
            print(f"📊 Loading existing database: {self.master_csv_path}")
            df = pd.read_csv(self.master_csv_path)
            print(f"   📈 Current database size: {len(df)} tracks")
            return df
        else:
            print(f"📊 Creating new database: {self.master_csv_path}")
            return pd.DataFrame()
    
    def get_existing_track_ids(self, df: pd.DataFrame) -> Set[str]:
        """Get set of existing Spotify track IDs to check for duplicates"""
        if 'Spotify_Track_ID' in df.columns:
            existing_ids = set(df[df['Spotify_Track_ID'] != '']['Spotify_Track_ID'].tolist())
            print(f"   🔍 Found {len(existing_ids)} existing Spotify track IDs")
            return existing_ids
        return set()
    
    def filter_new_tracks(self, new_songs: List[Dict], existing_ids: Set[str]) -> List[Dict]:
        """Filter out tracks that already exist in the database"""
        unique_songs = []
        
        for song in new_songs:
            spotify_id = song.get('Spotify_Track_ID', '')
            
            if spotify_id and spotify_id in existing_ids:
                self.stats['duplicate_tracks'] += 1
                print(f"   🔄 Duplicate: {song.get('Artist', '')} - {song.get('Title', '')} (ID: {spotify_id})")
            else:
                unique_songs.append(song)
                if spotify_id:  # Only count as new if we have a Spotify ID
                    self.stats['new_tracks'] += 1
        
        return unique_songs
    
    def update_master_database(self, new_songs: List[Dict]):
        """Add new songs to master database"""
        print(f"💾 Updating master database...")
        
        # Load existing database
        existing_df = self.load_existing_database()
        existing_ids = self.get_existing_track_ids(existing_df)
        
        # Filter out duplicates
        unique_songs = self.filter_new_tracks(new_songs, existing_ids)
        
        if not unique_songs:
            print(f"   ℹ️  No new tracks to add (all were duplicates)")
            return
        
        # Create new DataFrame
        new_df = pd.DataFrame(unique_songs)
        
        # Combine with existing data
        if not existing_df.empty:
            # Ensure columns match
            all_columns = set(existing_df.columns) | set(new_df.columns)
            
            # Add missing columns with empty values
            for col in all_columns:
                if col not in existing_df.columns:
                    existing_df[col] = ''
                if col not in new_df.columns:
                    new_df[col] = ''
            
            # Reorder columns to match
            column_order = list(existing_df.columns)
            for col in new_df.columns:
                if col not in column_order:
                    column_order.append(col)
            
            existing_df = existing_df[column_order]
            new_df = new_df[column_order]
            
            # Combine DataFrames
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        else:
            combined_df = new_df
        
        # Save updated database
        combined_df.to_csv(self.master_csv_path, index=False)
        
        print(f"   ✅ Added {len(unique_songs)} new tracks")
        print(f"   📈 Total database size: {len(combined_df)} tracks")
    
    def generate_summary_report(self, html_file: str):
        """Generate processing summary report"""
        print(f"\n📊 PROCESSING SUMMARY")
        print(f"=" * 50)
        print(f"📁 Source file: {html_file}")
        print(f"📊 Total tracks processed: {self.stats['total_processed']}")
        print(f"✅ New tracks added: {self.stats['new_tracks']}")
        print(f"🔄 Duplicate tracks skipped: {self.stats['duplicate_tracks']}")
        print(f"❌ Failed Spotify matches: {self.stats['failed_matches']}")
        
        if self.stats['total_processed'] > 0:
            success_rate = (self.stats['total_processed'] - self.stats['failed_matches']) / self.stats['total_processed'] * 100
            print(f"🎯 Spotify match success rate: {success_rate:.1f}%")
        
        print(f"💾 Master database: {self.master_csv_path}")
        
        if os.path.exists(self.master_csv_path):
            df = pd.read_csv(self.master_csv_path)
            print(f"📈 Total tracks in database: {len(df)}")
            if 'Source_HTML' in df.columns:
                sources = df['Source_HTML'].value_counts()
                print(f"📁 Sources in database:")
                for source, count in sources.head(5).items():
                    print(f"   • {source}: {count} tracks")
                if len(sources) > 5:
                    print(f"   ... and {len(sources) - 5} more sources")
    
    def cleanup_files(self):
        """Clean up clutter files after processing"""
        files_to_cleanup = [
            "Sort Your Music_files",
            "html_files/Sort Your Music_files",
            "Sort Your Music.htm",     # remove exported HTML file
            "Sort Your Music.html"     # also handle .html variant
        ]
        
        for file_path in files_to_cleanup:
            if os.path.exists(file_path):
                if os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                    print(f"   🗑️  Cleaned up: {file_path}/")
                else:
                    os.remove(file_path)
                    print(f"   🗑️  Cleaned up: {file_path}")

    def process_playlist(self):
        """
        Main processing function: HTML -> Spotify data -> Database update
        Always processes 'Sort Your Music.html' from current directory
        """
        html_file_path = "Sort Your Music.htm"
        
        try:
            print(f"🚀 Processing latest playlist from Sort Your Music")
            print(f"=" * 60)
            
            # Check if file exists
            if not os.path.exists(html_file_path):
                print(f"❌ File not found: {html_file_path}")
                print(f"Please save your playlist as 'Sort Your Music.html' in the current directory")
                sys.exit(1)
            
            # Step 1: Extract data from HTML (now also returns detected playlist URL)
            songs, detected_playlist_url = self.extract_html_data(html_file_path)
            self.stats['total_processed'] = len(songs)
            
            # If HTML contained a playlist link, fetch its tracks automatically.
            playlist_tracks = []
            if detected_playlist_url:
                playlist_tracks = self.fetch_playlist_tracks(detected_playlist_url)
            else:
                # Fallback: allow user to optionally enter a playlist URL
                playlist_url = input("Enter a Spotify playlist URL to match tracks directly (press Enter to skip): ").strip()
                if playlist_url:
                    playlist_tracks = self.fetch_playlist_tracks(playlist_url)
            
            # Step 2: Enrich with Spotify data (use playlist_tracks if available)
            enriched_songs = self.enrich_with_spotify_data(songs, playlist_tracks=playlist_tracks)
            
            # Step 3: Update master database
            self.update_master_database(enriched_songs)
            
            # Step 4: Clean up clutter files
            print(f"\n🧹 Cleaning up...")
            self.cleanup_files()
            
            # Step 5: Generate summary
            self.generate_summary_report(html_file_path)
            
            print(f"\n🎉 Processing complete!")
            
        except Exception as e:
            print(f"❌ Error processing playlist: {e}")
            sys.exit(1)

def main():
    """Main function - processes 'Sort Your Music.html' automatically"""
    
    print("🎵 SPOTIFY PLAYLIST DATABASE BUILDER")
    print("=" * 50)
    print("📄 Looking for 'Sort Your Music.html'...")
    
    # Open Sort Your Music page in the default browser and wait for the user
    url = "http://sortyourmusic.playlistmachinery.com/"
    print(f"\n🌐 Opening Sort Your Music in your browser: {url}")
    try:
        webbrowser.open(url, new=2)
    except Exception:
        # If opening the browser fails, just continue — user can open manually
        print("   ⚠️  Could not automatically open the browser. Please open the URL manually.")
    
    input("When you're ready (after saving/exporting the playlist as 'Sort Your Music.htm' in this folder), press Enter to continue...")
    
    # Prompt user for master CSV filename (default if Enter)
    csv_input = input("Enter master CSV filename (press Enter for 'spotify_master_database.csv'): ").strip()
    if not csv_input:
        master_csv = "spotify_master_database.csv"
    else:
        master_csv = csv_input if csv_input.lower().endswith('.csv') else f"{csv_input}.csv"
    print(f"Using master CSV: {master_csv}")
    
    # Initialize processor with chosen master CSV
    processor = PlaylistDatabaseBuilder(master_csv_path=master_csv)
    
    # Process the playlist (no parameters needed)
    processor.process_playlist()

if __name__ == "__main__":
    main()