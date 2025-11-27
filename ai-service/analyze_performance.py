#!/usr/bin/env python3
"""
Quick performance analysis script for simple analysis services.

This script provides a quick way to analyze the performance of
all methods in the simple analysis services.
"""

import os
import sys
import time
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from loguru import logger
from src.services.simple_analysis import SimpleAnalysisService
from src.utils.performance_analyzer import performance_analyzer


def find_test_audio():
    """Find a test audio file."""
    test_locations = [
        "tests/data/test.flac",
        "tests/data/test.mp3",
        "tests/data/test.wav",
        "tests/data/test.opus",
        "temp_segments",
        ".",
    ]

    for location in test_locations:
        if os.path.exists(location):
            for ext in [".flac", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus"]:
                for file in Path(location).glob(f"*{ext}"):
                    if file.is_file():
                        return str(file)

    return None


def analyze_method_performance(service, method_name, method_func, iterations=3):
    """Analyze performance of a single method."""
    times = []

    for i in range(iterations):
        start_time = time.time()
        try:
            result = method_func()
            duration = time.time() - start_time
            times.append(duration)
            logger.info(f"{method_name} iteration {i + 1}: {duration:.3f}s")
        except Exception as e:
            logger.error(f"{method_name} iteration {i + 1} failed: {e}")
            times.append(float("inf"))

    if times and any(t != float("inf") for t in times):
        valid_times = [t for t in times if t != float("inf")]
        avg_time = sum(valid_times) / len(valid_times)
        min_time = min(valid_times)
        max_time = max(valid_times)

        # Record in performance analyzer
        service_name = service.__class__.__name__
        for t in valid_times:
            performance_analyzer.record_method_timing(service_name, method_name, t)

        return {
            "method": method_name,
            "iterations": iterations,
            "average": avg_time,
            "min": min_time,
            "max": max_time,
            "success_rate": len(valid_times) / iterations,
        }

    return None


def run_performance_analysis():
    """Run comprehensive performance analysis."""
    print("🎵 SIMPLE ANALYSIS SERVICES - PERFORMANCE ANALYSIS")
    print("=" * 60)

    # Find test audio file
    test_file = find_test_audio()
    if not test_file:
        print("❌ No test audio file found!")
        print("Please place a test audio file in one of these locations:")
        print("  - tests/data/test.flac")
        print("  - tests/data/test.mp3")
        print("  - tests/data/test.wav")
        print("  - temp_segments/")
        print("  - current directory")
        return

    print(f"📁 Using test file: {test_file}")

    # Initialize service
    service = SimpleAnalysisService()

    # Test audio loading
    print("\n🔊 Testing Audio Loading...")
    print("-" * 30)

    # Load audio sample for feature tests
    y, sr = service.load_audio_sample(test_file, 30.0)
    print(f"Loaded audio: {len(y)} samples, {sr} Hz")

    # Test individual methods
    print("\n🔧 Testing Individual Methods...")
    print("-" * 30)

    # Feature extraction methods
    feature_methods = [
        ("get_tempo", lambda: service.feature_extractor.get_tempo(y, sr)),
        ("get_key", lambda: service.feature_extractor.get_key(y, sr)),
        (
            "get_spectral_features",
            lambda: service.feature_extractor.get_spectral_features(y, sr),
        ),
        ("get_mfcc", lambda: service.feature_extractor.get_mfcc(y, sr)),
        (
            "get_rhythm_fingerprint",
            lambda: service.feature_extractor.get_rhythm_fingerprint(y, sr),
        ),
        (
            "get_melodic_fingerprint",
            lambda: service.feature_extractor.get_melodic_fingerprint(y, sr),
        ),
        (
            "extract_basic_features",
            lambda: service.feature_extractor.extract_basic_features(y, sr),
        ),
    ]

    for method_name, method_func in feature_methods:
        result = analyze_method_performance(
            service.feature_extractor, method_name, method_func
        )
        if result:
            print(
                f"✅ {method_name}: {result['average']:.3f}s avg ({result['success_rate']:.1%} success)"
            )

    # Metadata extraction
    print("\n📋 Testing Metadata Extraction...")
    print("-" * 30)

    metadata_methods = [
        ("extract_file_metadata", lambda: service.extract_file_metadata(test_file)),
        ("extract_id3_tags", lambda: service.extract_id3_tags(test_file)),
    ]

    for method_name, method_func in metadata_methods:
        result = analyze_method_performance(service, method_name, method_func)
        if result:
            print(
                f"✅ {method_name}: {result['average']:.3f}s avg ({result['success_rate']:.1%} success)"
            )

    # Technical analysis
    print("\n🔬 Testing Technical Analysis...")
    print("-" * 30)

    result = analyze_method_performance(
        service,
        "extract_audio_technical",
        lambda: service.extract_audio_technical(test_file),
    )
    if result:
        print(
            f"✅ extract_audio_technical: {result['average']:.3f}s avg ({result['success_rate']:.1%} success)"
        )

    # Fingerprint generation
    print("\n🔍 Testing Fingerprint Generation...")
    print("-" * 30)

    result = analyze_method_performance(
        service,
        "generate_simple_fingerprint",
        lambda: service.generate_simple_fingerprint(test_file, y, sr),
    )
    if result:
        print(
            f"✅ generate_simple_fingerprint: {result['average']:.3f}s avg ({result['success_rate']:.1%} success)"
        )

    # Classification (if available)
    print("\n🏷️  Testing Classification...")
    print("-" * 30)

    try:
        result = analyze_method_performance(
            service,
            "generate_hierarchical_classification",
            lambda: service.generate_hierarchical_classification(test_file),
        )
        if result:
            print(
                f"✅ generate_hierarchical_classification: {result['average']:.3f}s avg ({result['success_rate']:.1%} success)"
            )
    except Exception as e:
        print(f"⚠️  Classification not available: {e}")

    # Full analysis pipeline
    print("\n🚀 Testing Full Analysis Pipeline...")
    print("-" * 30)

    result = analyze_method_performance(
        service, "analyze_audio", lambda: service.analyze_audio(test_file)
    )
    if result:
        print(
            f"✅ analyze_audio: {result['average']:.3f}s avg ({result['success_rate']:.1%} success)"
        )

    # Generate performance report
    print("\n📊 PERFORMANCE REPORT")
    print("=" * 60)
    performance_analyzer.print_performance_report()

    print("\n✅ Performance analysis completed!")
    print("💡 Use 'python performance_dashboard.py' for real-time monitoring")
    print("💡 Use 'python performance_test.py' for comprehensive testing")


if __name__ == "__main__":
    run_performance_analysis()
