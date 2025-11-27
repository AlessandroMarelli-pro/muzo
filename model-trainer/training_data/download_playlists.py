#!/usr/bin/env python3

import json
import os
import subprocess
import sys
import argparse


def download_playlists(json_data, output_path=".", use_vpn=False, vpn_location=None, max_retries=3):
    """
    Download playlists organized by genre and subgenre.

    Args:
        json_data: List of dictionaries containing genre, subgenres, and playlist IDs
        output_path: Base directory where genre/subgenre folders will be created
        use_vpn: Whether to use NordVPN for downloads
        vpn_location: Specific VPN location to use (optional)
        max_retries: Maximum retry attempts for bot detection
    """
    for genre_data in json_data:
        genre = genre_data["genre"]

        # Create genre folder if it doesn't exist
        genre_path = os.path.join(output_path, genre)
        if not os.path.exists(genre_path):
            os.makedirs(genre_path)
            print(f"Created genre folder: {genre_path}")

        for subgenre_data in genre_data["subgenres"]:
            subgenre = subgenre_data["subgenre"]
            playlist_id = subgenre_data["playlistId"]

            # Create subgenre folder path
            subgenre_path = os.path.join(output_path, genre, subgenre)
            if not os.path.exists(subgenre_path):
                os.makedirs(subgenre_path)
                print(f"Created subgenre folder: {subgenre_path}")

            # Change to subgenre directory and call download script
            print(f"Downloading playlist {playlist_id} to {subgenre_path}")
            try:
                # Build command arguments
                cmd = [
                    "python",
                    os.path.join(os.path.dirname(__file__), "download_playlist.py"),
                    playlist_id,
                    "50",  # Default number of tracks
                    "--output-dir",
                    subgenre_path,
                    "--max-duration",
                    "3",  # Default 3 minutes per track
                    "--max-retries",
                    str(max_retries),
                ]
                
                # Add VPN options if enabled
                if use_vpn:
                    cmd.append("--vpn-provider")
                    if vpn_location:
                        cmd.extend(["--vpn-location", vpn_location])
                
                # Run the Python download script
                subprocess.run(cmd, check=True)
                print(f"Successfully downloaded playlist {playlist_id}")
            except subprocess.CalledProcessError as e:
                print(f"Error downloading playlist {playlist_id}: {e}")
            except FileNotFoundError:
                print(
                    "Error: download_playlist.py not found. Make sure it's in the same directory as this script."
                )
                return


def main():
    parser = argparse.ArgumentParser(
        description="Download multiple playlists organized by genre and subgenre",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 download_playlists.py playlists.json ./downloads
  python3 download_playlists.py playlists.json ./downloads --vpn
  python3 download_playlists.py playlists.json ./downloads --vpn --vpn-location us
  python3 download_playlists.py playlists.json ./downloads --vpn --max-retries 5

VPN Support:
- NordVPN: Premium VPN with automatic server switching
- Requires: NordVPN installation + nordvpn-switcher package
        """,
    )
    
    parser.add_argument("json_file", help="JSON file containing playlist data")
    parser.add_argument("output_path", help="Base directory for downloaded files")
    parser.add_argument("--vpn", action="store_true", help="Enable NordVPN for bypassing bot detection")
    parser.add_argument("--vpn-location", help="Specific NordVPN server location to connect to")
    parser.add_argument("--max-retries", type=int, default=3, help="Maximum retry attempts for bot detection (default: 3)")
    
    args = parser.parse_args()

    try:
        # Read from file
        with open(args.json_file, "r", encoding="utf-8") as f:
            json_text = f.read()

        # Parse JSON
        playlist_data = json.loads(json_text)

        # Create output directory if it doesn't exist
        if not os.path.exists(args.output_path):
            os.makedirs(args.output_path)
            print(f"Created output directory: {args.output_path}")

        # Download playlists
        download_playlists(
            playlist_data, 
            args.output_path, 
            use_vpn=args.vpn, 
            vpn_location=args.vpn_location,
            max_retries=args.max_retries
        )

    except FileNotFoundError:
        print(f"Error: File '{args.json_file}' not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format - {e}")
        sys.exit(1)
    except KeyError as e:
        print(f"Error: Missing required field {e} in JSON data")
        sys.exit(1)


#   python3 download_playlists.py playlists.json ./downloads
if __name__ == "__main__":
    main()
