"""
Simple audio analysis service for minimal operations.

This service provides basic audio analysis with minimal computational overhead,
using soundfile for fast loading and avoiding redundant operations.
"""

import gc
import json
import os
import time
from typing import Any, Dict, Optional

from loguru import logger

from src.services.openai_metadata_extractor import OpenAIMetadataExtractor
from src.services.simple_audio_loader import SimpleAudioLoader
from src.services.simple_feature_extractor import SimpleFeatureExtractor
from src.services.simple_filename_parser import SimpleFilenameParser
from src.services.simple_fingerprint_generator import SimpleFingerprintGenerator
from src.services.simple_metadata_extractor import SimpleMetadataExtractor
from src.services.simple_technical_analyzer import SimpleTechnicalAnalyzer
from src.utils.performance_analyzer import performance_analyzer
from src.utils.performance_optimizer import monitor_performance


class SimpleAnalysisService:
    """
    Simple audio analysis service that provides minimal operations
    for basic audio information extraction.
    """

    def __init__(self):
        """Initialize the simple analysis service."""
        logger.info("SimpleAnalysisService initialized")

        # Initialize all service components
        self.filename_parser = SimpleFilenameParser()
        self.audio_loader = SimpleAudioLoader()
        self.metadata_extractor = SimpleMetadataExtractor(self.filename_parser)
        self.technical_analyzer = SimpleTechnicalAnalyzer()
        self.feature_extractor = SimpleFeatureExtractor()
        self.fingerprint_generator = SimpleFingerprintGenerator()

        # Initialize OpenAI metadata extractor (optional, will be None if API key not set)
        try:
            self.openai_extractor = OpenAIMetadataExtractor()
            if self.openai_extractor._is_available():
                logger.info("OpenAI metadata extractor initialized and available")
            else:
                logger.info(
                    "OpenAI metadata extractor initialized but not available (no API key)"
                )
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI metadata extractor: {e}")
            self.openai_extractor = None

        # Performance monitoring thresholds
        self.performance_thresholds = {
            "slow_method_threshold": 1.0,  # 1 second
            "critical_method_threshold": 5.0,  # 5 seconds
            "slow_operation_threshold": 2.0,  # 2 seconds
            "critical_operation_threshold": 10.0,  # 10 seconds
        }

        # Memory management: track analysis count for periodic cleanup
        self.analysis_count = 0
        self.gc_interval = 10  # Force GC every 10 analyses

    @monitor_performance("filename_parsing")
    def parse_filename_for_metadata(self, filename: str) -> Dict[str, str]:
        return self.filename_parser.parse_filename_for_metadata(filename)

    @monitor_performance("openai_metadata_extraction")
    def extract_metadata_with_openai(
        self, filename: str, file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from filename using OpenAI.
        If file_path is provided, ID3 tags will be extracted and used for more accurate results.

        Args:
            filename: Audio filename (with or without extension)
            file_path: Optional path to the audio file for ID3 tag extraction

        Returns:
            Dictionary containing OpenAI-extracted metadata, or empty dict if unavailable
        """
        if self.openai_extractor and self.openai_extractor._is_available():
            return self.openai_extractor.extract_metadata_from_filename(
                filename, file_path
            )
        else:
            logger.debug("OpenAI metadata extraction not available, skipping")
            return {}

    @monitor_performance("audio_conversion")
    def convert_m4a_to_wav(self, file_path: str) -> str:
        return self.audio_loader.convert_m4a_to_wav(file_path)

    @monitor_performance("audio_loading")
    def smart_audio_sample_loading(
        self,
        file_path: str,
        sample_duration: float = None,
        skip_intro: float = 0.0,
    ):
        return self.audio_loader.smart_audio_sample_loading(
            file_path,
            sample_duration,
            skip_intro,
        )

    @monitor_performance("metadata_extraction")
    def extract_file_metadata(self, file_path: str) -> Dict[str, Any]:
        return self.metadata_extractor.extract_file_metadata(file_path)

    @monitor_performance("id3_extraction")
    def extract_id3_tags(
        self, file_path: str, original_filename: str = ""
    ) -> Dict[str, Any]:
        return self.metadata_extractor.extract_id3_tags(file_path, original_filename)

    @monitor_performance("technical_analysis")
    def extract_audio_technical(self, file_path: str) -> Dict[str, Any]:
        return self.technical_analyzer.extract_audio_technical(file_path)

    @monitor_performance("feature_extraction")
    def extract_basic_features(
        self, y_harmonic, y_percussive, y_bpm, bpm_metadata, sr, file_path: str
    ) -> Dict[str, Any]:
        return self.feature_extractor.extract_basic_features(
            y_harmonic, y_percussive, y_bpm, bpm_metadata, sr, file_path
        )

    @monitor_performance("fingerprint_generation")
    def generate_simple_fingerprint(self, file_path: str, y, sr) -> Dict[str, Any]:
        return self.fingerprint_generator.generate_simple_fingerprint(file_path, y, sr)

    def check_performance_bottlenecks(self) -> Dict[str, Any]:
        """
        Check for current performance bottlenecks during runtime.

        Returns:
            Dictionary with bottleneck information and recommendations
        """
        try:
            bottlenecks = performance_analyzer.identify_bottlenecks()
            recommendations = performance_analyzer.get_optimization_recommendations()

            # Filter for critical and high-severity bottlenecks
            critical_bottlenecks = [
                b for b in bottlenecks if b.get("severity") in ["high", "critical"]
            ]

            # Check if any operations exceed thresholds
            from src.utils.performance_optimizer import performance_monitor

            global_metrics = performance_monitor.get_performance_summary()

            threshold_violations = []
            for operation, metrics in global_metrics.items():
                avg_time = metrics["average"]
                if (
                    avg_time
                    > self.performance_thresholds["critical_operation_threshold"]
                ):
                    threshold_violations.append(
                        {
                            "operation": operation,
                            "type": "critical_operation",
                            "avg_time": avg_time,
                            "threshold": self.performance_thresholds[
                                "critical_operation_threshold"
                            ],
                            "count": metrics["count"],
                        }
                    )
                elif avg_time > self.performance_thresholds["slow_operation_threshold"]:
                    threshold_violations.append(
                        {
                            "operation": operation,
                            "type": "slow_operation",
                            "avg_time": avg_time,
                            "threshold": self.performance_thresholds[
                                "slow_operation_threshold"
                            ],
                            "count": metrics["count"],
                        }
                    )

            return {
                "status": "healthy"
                if not critical_bottlenecks and not threshold_violations
                else "warning",
                "critical_bottlenecks": critical_bottlenecks,
                "threshold_violations": threshold_violations,
                "total_bottlenecks": len(bottlenecks),
                "recommendations": recommendations,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

        except Exception as e:
            logger.error(f"Failed to check performance bottlenecks: {e}")
            return {
                "status": "error",
                "message": f"Bottleneck check failed: {str(e)}",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

    def log_performance_status(self):
        """Log current performance status to console."""
        try:
            status = self.check_performance_bottlenecks()

            if status["status"] == "healthy":
                logger.info(
                    "✅ Performance Status: HEALTHY - No critical bottlenecks detected"
                )
            elif status["status"] == "warning":
                logger.warning(
                    "⚠️ Performance Status: WARNING - Performance issues detected"
                )

                if status["critical_bottlenecks"]:
                    logger.warning(
                        f"🚨 Critical Bottlenecks ({len(status['critical_bottlenecks'])}):"
                    )
                    for bottleneck in status["critical_bottlenecks"][:3]:  # Show top 3
                        logger.warning(
                            f"   - {bottleneck['method']}: {bottleneck['description']}"
                        )

                if status["threshold_violations"]:
                    logger.warning(
                        f"📊 Threshold Violations ({len(status['threshold_violations'])}):"
                    )
                    for violation in status["threshold_violations"][:3]:  # Show top 3
                        logger.warning(
                            f"   - {violation['operation']}: {violation['avg_time']:.2f}s avg ({violation['count']} calls)"
                        )
            else:
                logger.error(
                    f"❌ Performance Status: ERROR - {status.get('message', 'Unknown error')}"
                )

        except Exception as e:
            logger.error(f"Failed to log performance status: {e}")

    def get_performance_summary(self) -> Dict[str, Any]:
        """
        Get a quick performance summary for runtime monitoring.

        Returns:
            Dictionary with key performance metrics
        """
        try:
            from src.utils.performance_analyzer import get_performance_insights

            insights = get_performance_insights()
            bottlenecks = self.check_performance_bottlenecks()

            return {
                "overall_status": insights["status"],
                "slowest_service": insights.get("slowest_service"),
                "slowest_method": insights.get("slowest_method"),
                "total_bottlenecks": insights["total_bottlenecks"],
                "critical_issues": insights["critical_issues"],
                "threshold_violations": len(
                    bottlenecks.get("threshold_violations", [])
                ),
                "recommendations_count": insights["recommendations_count"],
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

        except Exception as e:
            logger.error(f"Failed to get performance summary: {e}")
            return {
                "overall_status": "error",
                "message": f"Performance summary failed: {str(e)}",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

    @monitor_performance("simple_analysis_all")
    def analyze_audio(
        self,
        file_path: str,
        sample_duration: float = 10.0,
        original_filename: str = "",
        skip_intro: float = 30.0,
        skip_openai_metadata: bool = False,
    ) -> Dict[str, Any]:
        # Track if we converted an M4A file so we can clean it up
        converted_wav_path = None

        try:
            logger.info(f"Starting simple audio analysis: {file_path}")
            start_time = time.time()

            if file_path.endswith(".m4a"):
                converted_wav_path = self.convert_m4a_to_wav(file_path)
                file_path = converted_wav_path

            # Load audio samples for efficient analysis (harmonic, percussive, and BPM)
            (
                y_harmonic,
                y_percussive,
                y_bpm,
                sr,
                harmonic_metadata,
                percussive_metadata,
                bpm_metadata,
            ) = self.smart_audio_sample_loading(
                file_path,
                sample_duration,
                skip_intro,
            )

            # Extract all information
            file_metadata = self.extract_file_metadata(file_path)

            technical_info = self.extract_audio_technical(
                file_path
            )  # Use full file for duration
            basic_features = self.extract_basic_features(
                y_harmonic, y_percussive, y_bpm, bpm_metadata, sr, file_path
            )  # Use optimized samples for features
            # Use harmonic sample for fingerprint (more representative of melody/harmony)
            fingerprint = self.generate_simple_fingerprint(file_path, y_harmonic, sr)
            id3_tags = self.extract_id3_tags(file_path, original_filename)

            # Extract metadata using OpenAI if available and not skipped
            openai_metadata = {}
            if original_filename and not skip_openai_metadata:
                openai_metadata = self.extract_metadata_with_openai(original_filename)
                if openai_metadata:
                    logger.info("OpenAI metadata extracted successfully")
            elif skip_openai_metadata:
                logger.debug(
                    "Skipping OpenAI metadata extraction (skip_openai_metadata=True)"
                )

            # Check performance bottlenecks after analysis
            # performance_status = self.check_performance_bottlenecks()

            # Log performance status if there are issues
            # if performance_status["status"] != "healthy":
            #     self.log_performance_status()

            # Combine all results
            analysis_result = {
                "status": "success",
                "message": "Simple audio analysis completed successfully",
                "processing_time": round(time.time() - start_time, 3),
                "processing_mode": "simple",
                # "performance_status": performance_status["status"],
                # "performance_summary": self.get_performance_summary(),
                **file_metadata,
                **technical_info,
                **basic_features,
                **fingerprint,
                **id3_tags,
            }

            # Add OpenAI metadata if available
            if openai_metadata:
                analysis_result["openai_metadata"] = openai_metadata

            logger.info(
                f"Simple audio analysis completed in {analysis_result['processing_time']:.3f}s"
            )

            # Include performance warnings in the result if needed
            # if performance_status["status"] == "warning":
            #    analysis_result["performance_warnings"] = {
            #        "critical_bottlenecks": performance_status["critical_bottlenecks"],
            #        "threshold_violations": performance_status["threshold_violations"],
            #        "recommendations": performance_status["recommendations"],
            #    }

            # Explicitly release audio array from memory
            del y_harmonic
            del y_percussive
            del y_bpm

            # Track analysis count and perform periodic garbage collection
            self.analysis_count += 1
            if self.analysis_count % self.gc_interval == 0:
                logger.debug(f"🧹 Performing GC after {self.analysis_count} analyses")
                gc.collect()

            return analysis_result

        except Exception as e:
            logger.error(f"Simple audio analysis failed: {e}")
            local = locals()
            # Clean up on error
            if "y_harmonic" in local:
                del local["y_harmonic"]
            if "y_percussive" in locals():
                del local["y_percussive"]
            if "y_bpm" in local:
                del local["y_bpm"]
            gc.collect()

            return {
                "status": "error",
                "message": f"Analysis failed: {str(e)}",
                "processing_mode": "simple",
            }
        finally:
            # Clean up converted WAV file if we created one
            if converted_wav_path and os.path.exists(converted_wav_path):
                try:
                    os.unlink(converted_wav_path)
                    logger.info(f"Cleaned up converted WAV file: {converted_wav_path}")
                except Exception as e:
                    logger.error(
                        f"Failed to clean up converted WAV file {converted_wav_path}: {e}"
                    )
