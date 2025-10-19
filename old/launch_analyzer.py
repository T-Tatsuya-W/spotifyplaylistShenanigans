#!/usr/bin/env python3
"""
🎵 Music Analyzer Launcher
Quick launcher for the Spotify Music Analyzer web interface
"""

import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def main():
    print("🎵 Spotify Music Analyzer Launcher")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('spotify_master_database.csv'):
        print("⚠️  Warning: spotify_master_database.csv not found!")
        print("   Make sure you're in the correct directory.")
        print("   The analyzer will use sample data instead.")
        print()
    
    if not os.path.exists('music_analyzer.html'):
        print("❌ Error: music_analyzer.html not found!")
        print("   Please ensure all files are in the current directory.")
        return 1
    
    if not os.path.exists('music_server.py'):
        print("❌ Error: music_server.py not found!")
        print("   Please ensure all files are in the current directory.")
        return 1
    
    print("✅ All files found! Starting the music analyzer...")
    print()
    print("📱 The web interface will open automatically")
    print("🛑 Press Ctrl+C to stop the server")
    print()
    
    try:
        # Start the server
        subprocess.run([sys.executable, 'music_server.py'])
    except KeyboardInterrupt:
        print("\n🛑 Music analyzer stopped")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())