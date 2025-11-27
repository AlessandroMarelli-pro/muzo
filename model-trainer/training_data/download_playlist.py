#!/usr/bin/env python3

import argparse
import os
import sys
import time
import random
import subprocess
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"  # No Color


class VPNManager:
    """VPN management class for handling NordVPN connections and switching."""
    
    def __init__(self, max_retries=3):
        self.max_retries = max_retries
        self.current_location = None
        self.nordvpn_settings = None
        
        # NordVPN server locations
        self.vpn_locations = ["us", "ca", "uk", "de", "fr", "nl"]
    
    def is_vpn_available(self):
        """Check if NordVPN client is installed and available."""
        try:
            # Check if nordvpn-switcher package is available
            try:
                import nordvpn_switcher
                return True
            except ImportError:
                # Fallback to checking if NordVPN GUI is installed
                return os.path.exists("C:\\Program Files\\NordVPN\\NordVPN.exe")
        except Exception:
            return False
    
    def get_current_status(self):
        """Get current NordVPN connection status."""
        try:
            if self.nordvpn_settings:
                return "NordVPN connected"
            else:
                return "NordVPN not connected"
        except Exception as e:
            print_warning(f"Could not get VPN status: {e}")
            return "Unknown"
    
    def connect_vpn(self, location=None):
        """Connect to NordVPN with specified location."""
        if not self.is_vpn_available():
            print_error("NordVPN client is not installed or not available")
            return False
        
        if location is None:
            location = random.choice(self.vpn_locations)
        
        print_info(f"Connecting to NordVPN server: {location}")
        
        try:
            # Try nordvpn-switcher first
            try:
                from nordvpn_switcher import initialize_VPN, rotate_VPN
                
                if self.nordvpn_settings is None:
                    print_info("Initializing NordVPN settings...")
                    # Try to initialize with a timeout approach
                    try:
                        # Use saved settings if available
                        self.nordvpn_settings = initialize_VPN(save=1, area_input=["random countries europe 10"])
                        print_success("NordVPN initialized with saved settings")
                    except Exception as e:
                        print_warning(f"Failed to initialize with saved settings: {e}")
                        print_info("Trying without saved settings...")
                        try:
                            self.nordvpn_settings = initialize_VPN(save=0)
                            print_success("NordVPN initialized without saved settings")
                        except Exception as e2:
                            print_error(f"Failed to initialize NordVPN: {e2}")
                            print_info("Falling back to manual NordVPN connection...")
                            return self._manual_nordvpn_connect(location)
                
                print_info(f"Rotating to NordVPN server in {location}...")
                rotate_VPN(self.nordvpn_settings)
                self.current_location = location
                print_success(f"Successfully connected to NordVPN server in {location}")
                time.sleep(3)  # Wait for connection to stabilize
                return True
            except ImportError:
                print_error("nordvpn-switcher package not installed. Install with: pip install nordvpn-switcher")
                return False
        except Exception as e:
            print_error(f"Error connecting to NordVPN: {e}")
            print_info("Falling back to manual NordVPN connection...")
            return self._manual_nordvpn_connect(location)
    
    def _manual_nordvpn_connect(self, location):
        """Manual NordVPN connection fallback."""
        print_info("Attempting manual NordVPN connection...")
        try:
            # Try to use NordVPN CLI directly if available
            result = subprocess.run(
                ["nordvpn", "connect", location], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            if result.returncode == 0:
                self.current_location = location
                print_success(f"Successfully connected to NordVPN server in {location} (manual)")
                time.sleep(3)
                return True
            else:
                print_error(f"Manual NordVPN connection failed: {result.stderr}")
                return False
        except FileNotFoundError:
            print_error("NordVPN CLI not found. Please ensure NordVPN is properly installed.")
            return False
        except subprocess.TimeoutExpired:
            print_error("NordVPN connection timed out")
            return False
        except Exception as e:
            print_error(f"Manual NordVPN connection error: {e}")
            return False
    
    def disconnect_vpn(self):
        """Disconnect from NordVPN."""
        if not self.is_vpn_available():
            return False
        
        print_info("Disconnecting from NordVPN")
        
        try:
            # Try nordvpn-switcher first
            try:
                from nordvpn_switcher import terminate_VPN
                terminate_VPN(self.nordvpn_settings)
                print_success("Successfully disconnected from NordVPN")
                self.current_location = None
                time.sleep(2)  # Wait for disconnection
                return True
            except ImportError:
                print_warning("nordvpn-switcher package not available for disconnect")
                return self._manual_nordvpn_disconnect()
        except Exception as e:
            print_error(f"Error disconnecting from NordVPN: {e}")
            print_info("Trying manual disconnect...")
            return self._manual_nordvpn_disconnect()
    
    def _manual_nordvpn_disconnect(self):
        """Manual NordVPN disconnection fallback."""
        try:
            result = subprocess.run(
                ["nordvpn", "disconnect"], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            if result.returncode == 0:
                print_success("Successfully disconnected from NordVPN (manual)")
                self.current_location = None
                time.sleep(2)
                return True
            else:
                print_warning(f"Manual NordVPN disconnect warning: {result.stderr}")
                return False
        except FileNotFoundError:
            print_warning("NordVPN CLI not found for disconnect")
            return False
        except subprocess.TimeoutExpired:
            print_warning("NordVPN disconnect timed out")
            return False
        except Exception as e:
            print_warning(f"Manual NordVPN disconnect error: {e}")
            return False
    
    def change_vpn_location(self):
        """Change NordVPN to a different location."""
        if not self.is_vpn_available():
            return False
        
        print_info("Changing NordVPN location to bypass restrictions...")
        
        # Get available locations excluding current one
        available_locations = [loc for loc in self.vpn_locations 
                              if loc != self.current_location]
        
        if not available_locations:
            print_warning("No alternative NordVPN locations available")
            return False
        
        # Connect to new location (nordvpn-switcher handles disconnection automatically)
        new_location = random.choice(available_locations)
        success = self.connect_vpn(new_location)
        
        if success:
            print_success(f"NordVPN location changed to: {new_location}")
            return True
        else:
            print_error("Failed to change NordVPN location")
            return False
    
    def handle_bot_detection(self):
        """Handle bot detection by changing VPN location."""
        print_warning("Bot detection encountered - attempting VPN location change...")
        
        for attempt in range(self.max_retries):
            print_info(f"VPN change attempt {attempt + 1}/{self.max_retries}")
            
            if self.change_vpn_location():
                print_success("VPN location changed successfully")
                return True
            else:
                print_warning(f"VPN change attempt {attempt + 1} failed")
                if attempt < self.max_retries - 1:
                    time.sleep(5)  # Wait before retry
        
        print_error("All VPN change attempts failed")
        return False


def print_info(message):
    """Print info message with blue color."""
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {message}")


def print_success(message):
    """Print success message with green color."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {message}")


def print_warning(message):
    """Print warning message with yellow color."""
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")


def print_error(message):
    """Print error message with red color."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def check_ffmpeg_exists():
    """Check if ffmpeg is available."""
    try:
        import subprocess

        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        print_success("ffmpeg is installed")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print_error("ffmpeg is not installed")
        return False


def count_existing_audio_files(directory):
    """Count existing audio files in the directory."""
    try:
        if not os.path.exists(directory):
            return 0
        
        files = os.listdir(directory)
        audio_files = [
            f for f in files if f.endswith((".flac", ".mp3", ".m4a", ".webm", ".wav", ".ogg"))
        ]
        return len(audio_files)
    except OSError as e:
        print_warning(f"Could not scan directory {directory}: {e}")
        return 0


def check_bot_detection_error(output):
    """Check if the output contains bot detection error messages."""
    bot_error_indicators = [
        "Sign in to confirm you're not a bot",
        "Use --cookies-from-browser",
        "Use --cookies for the",
        "bot detection",
        "Please sign in to continue"
    ]
    
    output_lower = output.lower()
    for indicator in bot_error_indicators:
        if indicator.lower() in output_lower:
            return True
    return False


def validate_positive_integer(value):
    """Validate that a string represents a positive integer."""
    try:
        num = int(value)
        if num <= 0:
            raise ValueError("Number must be positive")
        return num
    except ValueError as e:
        raise argparse.ArgumentTypeError(f"Invalid number: {e}")


def construct_playlist_url(playlist_input):
    """Construct the full playlist URL from input."""
    if "youtube.com" in playlist_input or "youtu.be" in playlist_input:
        return playlist_input
    else:
        return f"https://music.youtube.com/playlist?list={playlist_input}"


def progress_hook(d):
    """Progress hook for yt-dlp to show download progress."""
    if d["status"] == "downloading":
        if "total_bytes" in d:
            percent = d["downloaded_bytes"] / d["total_bytes"] * 100
            print_info(f"Downloading: {percent:.1f}% of {d['total_bytes']} bytes")
        elif "total_bytes_estimate" in d:
            percent = d["downloaded_bytes"] / d["total_bytes_estimate"] * 100
            print_info(
                f"Downloading: {percent:.1f}% of ~{d['total_bytes_estimate']} bytes"
            )
        else:
            print_info(f"Downloading: {d['downloaded_bytes']} bytes")
    elif d["status"] == "finished":
        print_info(f"Finished downloading: {d['filename']}")


def download_playlist(
    playlist_url, num_tracks, download_dir=".", max_duration_minutes=3, max_files=50, vpn_manager=None, max_retries=3
):
    """Download playlist using yt-dlp command line tool."""
    import subprocess

    print_info(f"Starting download from playlist: {playlist_url}")
    print_info(f"Number of tracks to download: {num_tracks}")
    print_info(f"Max duration per track: {max_duration_minutes} minutes")
    print_info(f"Download location: {os.path.abspath(download_dir)}")

    # Create download directory if it doesn't exist
    Path(download_dir).mkdir(parents=True, exist_ok=True)
    print_info(f"Using download directory: {download_dir}")

    # Check for existing audio files
    existing_files = count_existing_audio_files(download_dir)
    print_info(f"Found {existing_files} existing audio files in directory")
    
    if existing_files >= max_files:
        print_warning(f"Directory already contains {existing_files} audio files (>= {max_files})")
        print_info("Skipping download to avoid exceeding file limit")
        return True, False  # Return (success, download_attempted)

    # Construct yt-dlp command
    cmd = [
        "yt-dlp",
        "--extract-audio",
        "--audio-format",
        "flac",
        "--audio-quality",
        "0",
        "--playlist-end",
        str(num_tracks),
        "--output",
        f"{download_dir}/%(title)s.%(ext)s",
        "--sleep-interval",
        "1",
        "--max-sleep-interval",
        "10",
        "--concurrent-fragments",
        "2",
        "--embed-metadata",
        "--add-metadata",
        "--ignore-errors",
        "--no-warnings",
        "--progress",
        "--cookies-from-browser",
        "firefox",
        "--download-archive",
        f"{download_dir}/downloaded_files.txt",
        playlist_url,
    ]

    print_info("Downloading tracks...")

    # Attempt download with retry logic for bot detection
    for attempt in range(max_retries):
        if attempt > 0:
            print_info(f"Retry attempt {attempt + 1}/{max_retries}")
        
        try:
            # Run yt-dlp command with real-time output display
            print_info("Starting yt-dlp download process...")
            
            # Use Popen for real-time output while still capturing stderr for bot detection
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            stderr_output = ""
            
            # Read output in real-time using threading for cross-platform compatibility
            import threading
            import queue
            
            stdout_queue = queue.Queue()
            stderr_queue = queue.Queue()
            
            def read_stdout():
                for line in iter(process.stdout.readline, ''):
                    stdout_queue.put(line)
                process.stdout.close()
            
            def read_stderr():
                for line in iter(process.stderr.readline, ''):
                    stderr_queue.put(line)
                process.stderr.close()
            
            # Start threads to read stdout and stderr
            stdout_thread = threading.Thread(target=read_stdout)
            stderr_thread = threading.Thread(target=read_stderr)
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            stdout_thread.start()
            stderr_thread.start()
            
            # Process output in real-time
            while process.poll() is None or not stdout_queue.empty() or not stderr_queue.empty():
                # Process stdout
                try:
                    while True:
                        line = stdout_queue.get_nowait()
                        print(line.rstrip())
                except queue.Empty:
                    pass
                
                # Process stderr
                try:
                    while True:
                        line = stderr_queue.get_nowait()
                        stderr_output += line
                        print(line.rstrip(), file=sys.stderr)
                except queue.Empty:
                    pass
                
                # Small delay to prevent busy waiting
                import time
                time.sleep(0.01)
            
            # Wait for threads to finish
            stdout_thread.join(timeout=1)
            stderr_thread.join(timeout=1)
            
            # Get the final return code
            return_code = process.returncode

            # Check for bot detection errors in stderr
            if stderr_output and check_bot_detection_error(stderr_output):
                print_error("Bot detection encountered!")
                
                # If VPN manager is available, try to change VPN location
                if vpn_manager and vpn_manager.is_vpn_available():
                    print_info("Attempting to bypass bot detection with VPN...")
                    if vpn_manager.handle_bot_detection():
                        print_info("VPN location changed, retrying download...")
                        continue  # Retry the download
                    else:
                        print_error("VPN change failed, stopping download")
                        return False, True
                else:
                    print_error("YouTube is asking you to sign in to confirm you're not a bot.")
                    print_info("To resolve this issue, you can:")
                    print_info("1. Use --cookies-from-browser option with yt-dlp")
                    print_info("2. Use --cookies option with a cookies file")
                    print_info("3. Try again later when the bot detection is less active")
                    print_info("4. Use --vpn-provider option to enable VPN switching")
                    print_warning("Download process stopped due to bot detection")
                    return False, True

            if return_code == 0:
                print_success("Download completed successfully!")
                print_info(f"Files saved in: {download_dir}")

                # Show downloaded files
                print_info("Downloaded files:")
                try:
                    files = os.listdir(download_dir)
                    audio_files = [
                        f for f in files if f.endswith((".flac", ".mp3", ".m4a", ".webm"))
                    ]
                    for file in sorted(audio_files):
                        file_path = os.path.join(download_dir, file)
                        if os.path.isfile(file_path):
                            size = os.path.getsize(file_path)
                            print(f"  {file} ({size} bytes)")

                    print_success(f"Total audio files downloaded: {len(audio_files)}")

                except OSError as e:
                    print_warning(f"Could not list files in {download_dir}: {e}")

                return True, True
            else:
                print_error(
                    f"Download completed with errors (exit code: {return_code})"
                )
                # Check stderr for additional error information
                if stderr_output:
                    print_error(f"Error details: {stderr_output}")
                return False, True

        except subprocess.CalledProcessError as e:
            print_error(f"Download failed with exit code {e.returncode}")
            print_warning("Check the playlist URL and try again")
            return False, True
        except KeyboardInterrupt:
            print_warning("Download interrupted by user")
            return False, True
    
    # If we get here, all retry attempts failed
    print_error(f"Download failed after {max_retries} attempts")
    return False, True


def main():
    """Main function to handle command line arguments and execute download."""
    parser = argparse.ArgumentParser(
        description="YouTube Music Playlist Downloader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 download_playlist.py "PLrAKWdKgX5wA..." 15
  python3 download_playlist.py "PLrAKWdKgX5wA..." 15 --max-duration 2
  python3 download_playlist.py "https://music.youtube.com/playlist?list=PLrAKWdKgX5wA..." 10 -d 5 -o ./downloads
  python3 download_playlist.py "PLrAKWdKgX5wA..." 20 --max-files 100
  python3 download_playlist.py "PLrAKWdKgX5wA..." 10 --vpn-provider
  python3 download_playlist.py "PLrAKWdKgX5wA..." 10 --vpn-provider --vpn-location us
  python3 download_playlist.py "PLrAKWdKgX5wA..." 10 --vpn-provider --max-retries 5
  python3 download_playlist.py "PLrAKWdKgX5wA..." 10 --no-vpn

VPN Support:
- NordVPN: Premium VPN with automatic server switching
- Requires: NordVPN installation + nordvpn-switcher package
- Use --no-vpn if VPN is causing blocking issues

Note: 
- You can use either the full playlist URL or just the playlist ID
- The script will skip download if the directory already contains >= 50 files (configurable with --max-files)
- Bot detection errors will automatically trigger NordVPN location changes if VPN is enabled
- NordVPN must be installed and logged in before running the script
- If nordvpn-switcher blocks on "I want to connect to...", use --no-vpn to disable VPN
        """,
    )

    parser.add_argument("playlist_id", help="YouTube playlist ID or full URL")

    parser.add_argument(
        "num_tracks",
        type=validate_positive_integer,
        help="Number of tracks to download (positive integer)",
    )

    parser.add_argument(
        "--output-dir",
        "-o",
        default=".",
        help="Output directory for downloaded files (default: current directory)",
    )

    parser.add_argument(
        "--max-duration",
        "-d",
        type=validate_positive_integer,
        default=3,
        help="Maximum duration per track in minutes (default: 3)",
    )

    parser.add_argument(
        "--max-files",
        "-f",
        type=validate_positive_integer,
        default=50,
        help="Maximum number of audio files in directory before skipping download (default: 50)",
    )

    parser.add_argument(
        "--vpn-provider",
        action="store_true",
        help="Enable NordVPN for bypassing bot detection (requires NordVPN installation)",
    )

    parser.add_argument(
        "--no-vpn",
        action="store_true",
        help="Disable VPN entirely (useful if VPN is causing blocking issues)",
    )

    parser.add_argument(
        "--vpn-location",
        help="Specific NordVPN server location to connect to (optional, random if not specified)",
    )

    parser.add_argument(
        "--max-retries",
        "-r",
        type=validate_positive_integer,
        default=3,
        help="Maximum number of retry attempts for bot detection (default: 3)",
    )

    args = parser.parse_args()

    # Check if ffmpeg is installed
    if not check_ffmpeg_exists():
        print_error("ffmpeg is not installed. Please install it first:")
        print_info("brew install ffmpeg")
        print_info("or visit: https://ffmpeg.org/download.html")
        sys.exit(1)

    # Initialize VPN manager if VPN is enabled and not disabled
    vpn_manager = None
    if args.vpn_provider and not args.no_vpn:
        print_info("Initializing NordVPN manager")
        vpn_manager = VPNManager(args.max_retries)
        
        if not vpn_manager.is_vpn_available():
            print_error("NordVPN client is not installed or not available")
            print_info("Please install NordVPN first:")
            print_info("- Download from: https://nordvpn.com/download")
            print_info("- Install nordvpn-switcher: pip install nordvpn-switcher")
            sys.exit(1)
        
        # Connect to VPN if specified
        if args.vpn_location:
            print_info(f"Connecting to NordVPN server: {args.vpn_location}")
            if not vpn_manager.connect_vpn(args.vpn_location):
                print_error("Failed to connect to specified NordVPN location")
                sys.exit(1)
        else:
            print_info("Connecting to random NordVPN server...")
            if not vpn_manager.connect_vpn():
                print_error("Failed to connect to NordVPN")
                sys.exit(1)
        
        print_info(f"NordVPN Status: {vpn_manager.get_current_status()}")
    elif args.no_vpn:
        print_info("VPN disabled by user request")

    # Construct playlist URL
    playlist_url = construct_playlist_url(args.playlist_id)

    # Execute download
    success, download_attempted = download_playlist(
        playlist_url, args.num_tracks, args.output_dir, args.max_duration, args.max_files, vpn_manager, args.max_retries
    )

    # Cleanup VPN connection if it was established and a download was attempted
    if vpn_manager and vpn_manager.current_location and download_attempted:
        print_info("Disconnecting from VPN...")
        vpn_manager.disconnect_vpn()
    elif vpn_manager and vpn_manager.current_location and not download_attempted:
        print_info("VPN connection maintained (no download attempted)")

    if success:
        print_success("Script execution completed!")
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
