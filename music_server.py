#!/usr/bin/env python3
"""
🎵 Spotify Music Analyzer Server
Simple HTTP server to serve the music analyzer web app and CSV data
"""

import http.server
import socketserver
import json
import csv
import os
import webbrowser
from urllib.parse import parse_qs, urlparse

class MusicAnalyzerHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/music-data':
            self.serve_music_data()
        elif parsed_path.path == '/api/spotify-config':
            self.serve_spotify_config()
        elif parsed_path.path == '/spotify-callback':
            self.serve_spotify_callback()
        elif parsed_path.path == '/':
            self.path = '/music_analyzer.html'
            return super().do_GET()
        else:
            return super().do_GET()
    
    def serve_music_data(self):
        """Serve the CSV data as JSON"""
        try:
            csv_path = 'spotify_master_database.csv'
            
            if not os.path.exists(csv_path):
                self.send_error(404, "CSV database not found")
                return
            
            music_data = []
            
            with open(csv_path, 'r', encoding='utf-8') as file:
                csv_reader = csv.DictReader(file)
                
                for row in csv_reader:
                    # Convert numeric fields
                    numeric_fields = ['BPM', 'Energy', 'Dance', 'Loud', 'Valence', 
                                    'Acoustic', 'Spotify_Popularity', 'Length']
                    
                    for field in numeric_fields:
                        if field in row and row[field]:
                            try:
                                row[field] = float(row[field])
                            except ValueError:
                                row[field] = 0
                    
                    # Extract release year from Spotify_Release_Date
                    if 'Spotify_Release_Date' in row and row['Spotify_Release_Date']:
                        try:
                            release_year = int(row['Spotify_Release_Date'].split('-')[0])
                            row['Release_Year'] = release_year
                        except (ValueError, IndexError):
                            row['Release_Year'] = 2020  # Default fallback
                    else:
                        row['Release_Year'] = 2020  # Default fallback
                    
                    music_data.append(row)
            
            # Send JSON response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            json_data = json.dumps(music_data, indent=2)
            self.wfile.write(json_data.encode('utf-8'))
            
            print(f"✅ Served {len(music_data)} songs to web client")
            
        except Exception as e:
            print(f"❌ Error serving music data: {e}")
            self.send_error(500, f"Error loading music data: {str(e)}")
    
    def serve_spotify_config(self):
        """Serve Spotify API configuration"""
        try:
            # Load Spotify Client ID from environment or config
            spotify_client_id = os.getenv('SPOTIFY_CLIENT_ID', '')
            
            if not spotify_client_id:
                # Try to load from .env file
                try:
                    with open('.env', 'r') as f:
                        for line in f:
                            if line.startswith('SPOTIFY_CLIENT_ID='):
                                spotify_client_id = line.split('=', 1)[1].strip().strip('"\'')
                                break
                except FileNotFoundError:
                    pass
            
            # Get the exact host and port from the request
            host = self.headers.get('Host', 'localhost:8000')
            
            # Use exact redirect URI pattern from working example
            if host == 'localhost:8000' or host == '127.0.0.1:8000':
                redirect_uri = "http://127.0.0.1:8000/"
            else:
                protocol = 'https' if 'https' in self.headers.get('Referer', '') else 'http'
                redirect_uri = f'{protocol}://{host}/'
            
            config_data = {
                'client_id': spotify_client_id,
                'redirect_uri': redirect_uri
            }
            
            print(f"🔗 Providing redirect URI: {redirect_uri}")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            json_data = json.dumps(config_data)
            self.wfile.write(json_data.encode('utf-8'))
            
            if spotify_client_id:
                print("✅ Served Spotify configuration")
            else:
                print("⚠️  Warning: No Spotify Client ID configured")
            
        except Exception as e:
            print(f"❌ Error serving Spotify config: {e}")
            self.send_error(500, f"Error loading Spotify config: {str(e)}")
    
    def serve_spotify_callback(self):
        """Handle Spotify OAuth callback - redirect back to main page with authorization code"""
        try:
            # Get query parameters
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            # Get authorization code or error
            auth_code = query_params.get('code', [None])[0]
            auth_error = query_params.get('error', [None])[0]
            
            if auth_error:
                print(f"❌ Spotify OAuth error: {auth_error}")
                # Redirect back to main page with error
                redirect_url = f'/?error={auth_error}'
            elif auth_code:
                print(f"✅ Received Spotify authorization code: {auth_code[:20]}...")
                # Redirect back to main page with code
                redirect_url = f'/?code={auth_code}'
            else:
                print("❌ No authorization code or error received")
                redirect_url = '/?error=no_code'
            
            # Send redirect response
            self.send_response(302)
            self.send_header('Location', redirect_url)
            self.end_headers()
            
            print(f"🔄 Redirecting to: {redirect_url}")
            
        except Exception as e:
            print(f"❌ Error in Spotify callback: {e}")
            # Fallback redirect
            self.send_response(302)
            self.send_header('Location', '/?error=callback_error')
            self.end_headers()

def main():
    import sys
    
    # Allow port to be specified as command line argument
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    
    print("🎵 Starting Spotify Music Analyzer Server...")
    print("=" * 50)
    
    # Check if CSV exists
    if os.path.exists('spotify_master_database.csv'):
        with open('spotify_master_database.csv', 'r') as f:
            line_count = sum(1 for line in f) - 1  # Subtract header
        print(f"📊 Found database with {line_count} songs")
    else:
        print("⚠️  Warning: spotify_master_database.csv not found!")
        print("   The web app will use sample data instead.")
    
    print(f"🌐 Server starting on http://localhost:{PORT}")
    print(f"📱 Web app will be available at: http://localhost:{PORT}/music_analyzer.html")
    print("\n💡 Usage:")
    print("   1. Open the URL above in your browser")
    print("   2. Use the filter sliders to narrow down songs")
    print("   3. Click points on the Valence vs Energy plot to select songs")
    print("   4. Click 'Create Playlist' to download your selection")
    print("\n🛑 Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        with socketserver.TCPServer(("", PORT), MusicAnalyzerHandler) as httpd:
            # Auto-open browser
            webbrowser.open(f'http://localhost:{PORT}/music_analyzer.html')
            
            print(f"🚀 Server running on port {PORT}")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {PORT} is already in use!")
            print("   Try closing other applications or use a different port")
        else:
            print(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()