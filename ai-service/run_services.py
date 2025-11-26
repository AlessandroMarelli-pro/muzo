#!/usr/bin/env python3
"""
Service Runner Script for Muzo AI Service

This script allows you to run different configurations of the Muzo AI service:
- Simple Analysis only (audioFlux-based, no threading conflicts)
- Hierarchical Classification only (CNN-based, multithreaded)
- Both services (full functionality)

Usage:
    # Run simple analysis only (for audioFlux testing)
    python run_services.py --simple-only

    # Run hierarchical classification only
    python run_services.py --hierarchical-only

    # Run both services (default)
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
        "--simple-only",
        action="store_true",
        help="Run only simple analysis service (audioFlux-based)",
    )
    parser.add_argument(
        "--hierarchical-only",
        action="store_true",
        help="Run only hierarchical classification service (CNN-based)",
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

    # Set environment variables based on arguments
    if args.simple_only:
        os.environ["ENABLE_SIMPLE_ANALYSIS"] = "true"
        os.environ["ENABLE_HIERARCHICAL_CLASSIFICATION"] = "false"
        print("🚀 Starting Muzo AI Service - Simple Analysis Only")
        print("   ✅ audioFlux-based feature extraction")
        print("   🚫 Hierarchical classification disabled")
        print("   💡 Perfect for audioFlux testing without threading conflicts")
    elif args.hierarchical_only:
        os.environ["ENABLE_SIMPLE_ANALYSIS"] = "false"
        os.environ["ENABLE_HIERARCHICAL_CLASSIFICATION"] = "true"
        print("🚀 Starting Muzo AI Service - Hierarchical Classification Only")
        print("   🚫 Simple analysis disabled")
        print("   ✅ CNN-based hierarchical classification")
        print("   💡 Multithreaded service for production classification")
    else:
        os.environ["ENABLE_SIMPLE_ANALYSIS"] = "true"
        os.environ["ENABLE_HIERARCHICAL_CLASSIFICATION"] = "true"
        print("🚀 Starting Muzo AI Service - Full Configuration")
        print("   ✅ audioFlux-based feature extraction")
        print("   ✅ CNN-based hierarchical classification")
        print("   💡 Complete functionality with both services")

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
