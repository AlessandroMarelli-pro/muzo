#!/usr/bin/env python3
"""
Service Runner Script for Muzo AI Service

Usage:
    # Run the service (default)
    python run_services.py

    # Run with custom port
    python run_services.py --port 5001
"""

import argparse
import os
import sys
from pathlib import Path

from loguru import logger

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app_with_routes


def main():
    parser = argparse.ArgumentParser(
        description="Run Muzo AI Service with different configurations"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=4000,
        help="Port to run the service on (default: 5000)",
    )
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)"
    )
    parser.add_argument("--debug", action="store_true", help="Run in debug mode")

    args = parser.parse_args()

    os.environ["ENABLE_SIMPLE_ANALYSIS"] = "true"
    print("🚀 Starting Muzo AI Service")
    print("   ✅ audioFlux-based feature extraction")
    print("   ✅ discogs-effnet embedding + classifier heads")

    # Create and run the app
    app = create_app_with_routes()

    print(f"\n🌐 Service will be available at: http://{args.host}:{args.port}")
    print(f"📊 Service status: http://{args.host}:{args.port}/api/v1/service-status")
    print(f"🏥 Health check: http://{args.host}:{args.port}/health")
    print("\n" + "=" * 60)

    try:
        app.run(host=args.host, port=args.port, debug=args.debug)
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"\n❌ Service failed to start: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
