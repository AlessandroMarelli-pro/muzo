#!/usr/bin/env python3
"""
Performance benchmarking script for metadata extraction.

Measures and reports:
- Cache hit rate
- Average response times (Discogs vs LLM vs Simple)
- API call counts (Discogs vs LLM)
- Rate limit handling
"""

import argparse
import os
import sys
import time
from collections import defaultdict
from typing import Dict, List, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger

from src.services.gemini_metadata_extractor import GeminiMetadataExtractor


class PerformanceBenchmark:
    """Performance benchmarking for metadata extraction."""

    def __init__(self):
        """Initialize benchmark."""
        self.extractor = GeminiMetadataExtractor()
        self.metrics = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "discogs_success": 0,
            "discogs_failures": 0,
            "llm_calls": 0,
            "discogs_calls": 0,
            "response_times": [],
            "discogs_times": [],
            "llm_times": [],
            "simple_times": [],
        }

    def clear_cache(self):
        """Clear metadata cache."""
        if self.extractor.metadata_cache and self.extractor.metadata_cache.is_available():
            self.extractor.metadata_cache.clear_pattern("*")
            logger.info("Cache cleared")

    def benchmark_extraction(self, filename: str, file_path: Optional[str] = None, iterations: int = 5):
        """Benchmark metadata extraction."""
        logger.info(f"Benchmarking: {filename} ({iterations} iterations)")

        times = []
        cache_hits = 0
        cache_misses = 0

        for i in range(iterations):
            start = time.time()
            result = self.extractor.extract_metadata_from_filename(filename, file_path)
            elapsed = time.time() - start
            times.append(elapsed)

            if result:
                if i == 0:
                    cache_misses += 1
                else:
                    cache_hits += 1

            logger.info(f"Iteration {i+1}: {elapsed:.2f}s")

        self.metrics["total_requests"] += iterations
        self.metrics["cache_hits"] += cache_hits
        self.metrics["cache_misses"] += cache_misses
        self.metrics["response_times"].extend(times)

        avg_time = sum(times) / len(times)
        logger.info(f"Average time: {avg_time:.2f}s")
        return avg_time

    def measure_api_calls(self, filename: str, file_path: Optional[str] = None):
        """Measure API call counts."""
        if not self.extractor._is_available():
            logger.warning("Extractor not available")
            return

        discogs_calls = 0
        llm_calls = 0

        # Mock to count calls
        if self.extractor.discogs_enrichment:
            original_search = self.extractor.discogs_enrichment._search_discogs

            def count_discogs(*args, **kwargs):
                nonlocal discogs_calls
                discogs_calls += 1
                start = time.time()
                result = original_search(*args, **kwargs)
                self.metrics["discogs_times"].append(time.time() - start)
                return result

            self.extractor.discogs_enrichment._search_discogs = count_discogs

        original_llm_call = self.extractor._make_api_call_with_retry

        def count_llm(*args, **kwargs):
            nonlocal llm_calls
            llm_calls += 1
            start = time.time()
            result = original_llm_call(*args, **kwargs)
            self.metrics["llm_times"].append(time.time() - start)
            return result

        self.extractor._make_api_call_with_retry = count_llm

        # Clear cache and run
        self.clear_cache()
        self.extractor.extract_metadata_from_filename(filename, file_path)

        self.metrics["discogs_calls"] += discogs_calls
        self.metrics["llm_calls"] += llm_calls

        logger.info(f"Discogs API calls: {discogs_calls}")
        logger.info(f"LLM API calls: {llm_calls}")

        # Restore
        if self.extractor.discogs_enrichment:
            self.extractor.discogs_enrichment._search_discogs = original_search
        self.extractor._make_api_call_with_retry = original_llm_call

    def generate_report(self):
        """Generate performance report."""
        print("\n" + "=" * 70)
        print("METADATA EXTRACTION PERFORMANCE REPORT")
        print("=" * 70)

        # Cache statistics
        total_cache_requests = self.metrics["cache_hits"] + self.metrics["cache_misses"]
        if total_cache_requests > 0:
            hit_rate = self.metrics["cache_hits"] / total_cache_requests * 100
            print(f"\nCache Statistics:")
            print(f"  Total requests: {total_cache_requests}")
            print(f"  Cache hits: {self.metrics['cache_hits']} ({hit_rate:.1f}%)")
            print(f"  Cache misses: {self.metrics['cache_misses']} ({100-hit_rate:.1f}%)")

        # Response times
        if self.metrics["response_times"]:
            avg_time = sum(self.metrics["response_times"]) / len(self.metrics["response_times"])
            min_time = min(self.metrics["response_times"])
            max_time = max(self.metrics["response_times"])
            print(f"\nResponse Times:")
            print(f"  Average: {avg_time:.2f}s")
            print(f"  Min: {min_time:.2f}s")
            print(f"  Max: {max_time:.2f}s")

        # API call counts
        print(f"\nAPI Call Counts:")
        print(f"  Discogs API: {self.metrics['discogs_calls']}")
        print(f"  LLM API: {self.metrics['llm_calls']}")

        # Discogs times
        if self.metrics["discogs_times"]:
            avg_discogs = sum(self.metrics["discogs_times"]) / len(self.metrics["discogs_times"])
            print(f"  Average Discogs time: {avg_discogs:.2f}s")

        # LLM times
        if self.metrics["llm_times"]:
            avg_llm = sum(self.metrics["llm_times"]) / len(self.metrics["llm_times"])
            print(f"  Average LLM time: {avg_llm:.2f}s")

        # Success rates
        if self.metrics["total_requests"] > 0:
            success_rate = (
                (self.metrics["total_requests"] - self.metrics.get("failures", 0))
                / self.metrics["total_requests"]
                * 100
            )
            print(f"\nSuccess Rate: {success_rate:.1f}%")

        print("=" * 70 + "\n")


def main():
    """Main benchmark function."""
    parser = argparse.ArgumentParser(description="Performance benchmark for metadata extraction")
    parser.add_argument(
        "--file", type=str, help="Audio file to benchmark", required=True
    )
    parser.add_argument(
        "--iterations", type=int, default=5, help="Number of iterations (default: 5)"
    )
    parser.add_argument(
        "--clear-cache", action="store_true", help="Clear cache before benchmarking"
    )
    parser.add_argument(
        "--measure-api", action="store_true", help="Measure API call counts"
    )

    args = parser.parse_args()

    if not os.path.exists(args.file):
        logger.error(f"File not found: {args.file}")
        return 1

    benchmark = PerformanceBenchmark()

    if args.clear_cache:
        benchmark.clear_cache()

    filename = os.path.basename(args.file)
    file_path = args.file

    logger.info(f"Starting benchmark for: {filename}")

    # Run benchmark
    benchmark.benchmark_extraction(filename, file_path, args.iterations)

    # Measure API calls if requested
    if args.measure_api:
        benchmark.measure_api_calls(filename, file_path)

    # Generate report
    benchmark.generate_report()

    return 0


if __name__ == "__main__":
    sys.exit(main())
