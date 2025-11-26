"""
Performance analyzer for simple analysis services.

This module provides comprehensive performance analysis capabilities
for monitoring and optimizing the simple analysis service methods.
"""

import json
import time
from typing import Any, Dict, List, Optional

import numpy as np
from loguru import logger

from src.utils.performance_optimizer import performance_monitor, get_performance_recommendations


class PerformanceAnalyzer:
    """
    Comprehensive performance analyzer for simple analysis services.

    Provides detailed analysis of method performance, bottlenecks,
    and optimization recommendations.
    """

    def __init__(self):
        """Initialize the performance analyzer."""
        self.method_metrics: Dict[str, List[float]] = {}
        self.operation_timings: Dict[str, Dict[str, float]] = {}
        logger.info("PerformanceAnalyzer initialized")

    def record_method_timing(
        self, service_name: str, method_name: str, duration: float
    ):
        """
        Record timing for a specific method.

        Args:
            service_name: Name of the service (e.g., 'SimpleFeatureExtractor')
            method_name: Name of the method (e.g., 'get_tempo')
            duration: Execution time in seconds
        """
        key = f"{service_name}.{method_name}"
        if key not in self.method_metrics:
            self.method_metrics[key] = []

        self.method_metrics[key].append(duration)

        # Keep only last 100 measurements
        if len(self.method_metrics[key]) > 100:
            self.method_metrics[key] = self.method_metrics[key][-100:]

    def get_method_statistics(
        self, service_name: str, method_name: str
    ) -> Optional[Dict[str, float]]:
        """
        Get performance statistics for a specific method.

        Args:
            service_name: Name of the service
            method_name: Name of the method

        Returns:
            Dictionary with performance statistics or None if no data
        """
        key = f"{service_name}.{method_name}"
        if key not in self.method_metrics or not self.method_metrics[key]:
            return None

        times = self.method_metrics[key]
        return {
            "count": len(times),
            "average": float(np.mean(times)),
            "median": float(np.median(times)),
            "min": float(np.min(times)),
            "max": float(np.max(times)),
            "std": float(np.std(times)),
            "p95": float(np.percentile(times, 95)),
            "p99": float(np.percentile(times, 99)),
        }

    def get_service_performance(self, service_name: str) -> Dict[str, Any]:
        """
        Get performance analysis for all methods in a service.

        Args:
            service_name: Name of the service

        Returns:
            Dictionary with service performance analysis
        """
        service_methods = {}

        for key, times in self.method_metrics.items():
            if key.startswith(f"{service_name}."):
                method_name = key.split(".", 1)[1]
                if times:
                    service_methods[method_name] = {
                        "count": len(times),
                        "average": float(np.mean(times)),
                        "median": float(np.median(times)),
                        "min": float(np.min(times)),
                        "max": float(np.max(times)),
                        "std": float(np.std(times)),
                        "p95": float(np.percentile(times, 95)),
                        "p99": float(np.percentile(times, 99)),
                    }

        return service_methods

    def get_all_services_performance(self) -> Dict[str, Any]:
        """
        Get performance analysis for all services.

        Returns:
            Dictionary with performance analysis for all services
        """
        services = {}

        for key in self.method_metrics.keys():
            service_name = key.split(".", 1)[0]
            if service_name not in services:
                services[service_name] = self.get_service_performance(service_name)

        return services

    def identify_bottlenecks(self) -> List[Dict[str, Any]]:
        """
        Identify performance bottlenecks across all methods.
        Includes both detailed method-level bottlenecks and operation-level bottlenecks
        from the existing @monitor_performance decorator.

        Returns:
            List of bottleneck information
        """
        bottlenecks = []

        # Analyze detailed method-level bottlenecks
        for key, times in self.method_metrics.items():
            if not times:
                continue

            avg_time = np.mean(times)
            max_time = np.max(times)
            std_time = np.std(times)

            # Identify slow methods (average > 1 second)
            if avg_time > 1.0:
                bottlenecks.append(
                    {
                        "method": key,
                        "type": "slow_average",
                        "severity": "high" if avg_time > 5.0 else "medium",
                        "average_time": avg_time,
                        "description": f"Average execution time is {avg_time:.2f}s",
                        "source": "detailed_method_analysis",
                    }
                )

            # Identify high variance methods (std > 50% of average)
            if std_time > avg_time * 0.5:
                bottlenecks.append(
                    {
                        "method": key,
                        "type": "high_variance",
                        "severity": "medium",
                        "variance": std_time,
                        "average": avg_time,
                        "description": f"High variance: std={std_time:.2f}s vs avg={avg_time:.2f}s",
                        "source": "detailed_method_analysis",
                    }
                )

            # Identify methods with occasional spikes (max > 3x average)
            if max_time > avg_time * 3:
                bottlenecks.append(
                    {
                        "method": key,
                        "type": "occasional_spikes",
                        "severity": "low",
                        "max_time": max_time,
                        "average": avg_time,
                        "description": f"Occasional spikes: max={max_time:.2f}s vs avg={avg_time:.2f}s",
                        "source": "detailed_method_analysis",
                    }
                )

        # Analyze operation-level bottlenecks from @monitor_performance
        global_metrics = performance_monitor.get_performance_summary()
        for operation, metrics in global_metrics.items():
            avg_time = metrics["average"]
            max_time = metrics["max"]
            std_time = metrics["std"]

            # Identify slow operations (average > 2 seconds for operations)
            if avg_time > 2.0:
                bottlenecks.append(
                    {
                        "method": f"@{operation}",
                        "type": "slow_operation",
                        "severity": "high" if avg_time > 10.0 else "medium",
                        "average_time": avg_time,
                        "description": f"Operation {operation} is slow: {avg_time:.2f}s avg",
                        "source": "monitor_performance_decorator",
                        "count": metrics["count"],
                    }
                )

            # Identify high variance operations (std > 50% of average)
            if std_time > avg_time * 0.5:
                bottlenecks.append(
                    {
                        "method": f"@{operation}",
                        "type": "high_variance_operation",
                        "severity": "medium",
                        "variance": std_time,
                        "average": avg_time,
                        "description": f"Operation {operation} has high variance: std={std_time:.2f}s vs avg={avg_time:.2f}s",
                        "source": "monitor_performance_decorator",
                        "count": metrics["count"],
                    }
                )

            # Identify operations with occasional spikes (max > 3x average)
            if max_time > avg_time * 3:
                bottlenecks.append(
                    {
                        "method": f"@{operation}",
                        "type": "operation_spikes",
                        "severity": "low",
                        "max_time": max_time,
                        "average": avg_time,
                        "description": f"Operation {operation} has spikes: max={max_time:.2f}s vs avg={avg_time:.2f}s",
                        "source": "monitor_performance_decorator",
                        "count": metrics["count"],
                    }
                )

        return sorted(
            bottlenecks,
            key=lambda x: x.get("average_time", x.get("variance", 0)),
            reverse=True,
        )

    def get_optimization_recommendations(self) -> Dict[str, List[str]]:
        """
        Get optimization recommendations based on performance analysis.
        Includes both detailed method-level recommendations and operation-level recommendations
        from the existing @monitor_performance decorator.

        Returns:
            Dictionary with recommendations by service/operation
        """
        recommendations = {}
        bottlenecks = self.identify_bottlenecks()

        # Process detailed method-level bottlenecks
        for bottleneck in bottlenecks:
            if bottleneck["source"] == "detailed_method_analysis":
                service_name = bottleneck["method"].split(".", 1)[0]
                if service_name not in recommendations:
                    recommendations[service_name] = []

                if bottleneck["type"] == "slow_average":
                    if bottleneck["severity"] == "high":
                        recommendations[service_name].append(
                            f"🚨 CRITICAL: {bottleneck['method']} is very slow ({bottleneck['average_time']:.2f}s avg) - "
                            "consider caching, parallel processing, or algorithm optimization"
                        )
                    else:
                        recommendations[service_name].append(
                            f"⚠️  SLOW: {bottleneck['method']} is slow ({bottleneck['average_time']:.2f}s avg) - "
                            "consider optimization or caching"
                        )

                elif bottleneck["type"] == "high_variance":
                    recommendations[service_name].append(
                        f"📊 VARIANCE: {bottleneck['method']} has high variance - "
                        "consider input validation or preprocessing to normalize performance"
                    )

                elif bottleneck["type"] == "occasional_spikes":
                    recommendations[service_name].append(
                        f"📈 SPIKES: {bottleneck['method']} has occasional spikes - "
                        "investigate edge cases or input-dependent performance"
                    )

        # Process operation-level bottlenecks from @monitor_performance
        for bottleneck in bottlenecks:
            if bottleneck["source"] == "monitor_performance_decorator":
                operation_name = bottleneck["method"].replace("@", "")
                if operation_name not in recommendations:
                    recommendations[operation_name] = []

                if bottleneck["type"] == "slow_operation":
                    if bottleneck["severity"] == "high":
                        recommendations[operation_name].append(
                            f"🚨 CRITICAL OPERATION: {operation_name} is very slow ({bottleneck['average_time']:.2f}s avg, {bottleneck['count']} calls) - "
                            "consider algorithm optimization, caching, or parallel processing"
                        )
                    else:
                        recommendations[operation_name].append(
                            f"⚠️  SLOW OPERATION: {operation_name} is slow ({bottleneck['average_time']:.2f}s avg, {bottleneck['count']} calls) - "
                            "consider optimization or caching"
                        )

                elif bottleneck["type"] == "high_variance_operation":
                    recommendations[operation_name].append(
                        f"📊 OPERATION VARIANCE: {operation_name} has high variance ({bottleneck['count']} calls) - "
                        "consider input validation or preprocessing to normalize performance"
                    )

                elif bottleneck["type"] == "operation_spikes":
                    recommendations[operation_name].append(
                        f"📈 OPERATION SPIKES: {operation_name} has occasional spikes ({bottleneck['count']} calls) - "
                        "investigate edge cases or input-dependent performance"
                    )

        # Add recommendations from existing performance optimizer
        existing_recommendations = get_performance_recommendations()
        for operation, recommendation in existing_recommendations.items():
            if operation not in recommendations:
                recommendations[operation] = []
            recommendations[operation].append(f"🔧 EXISTING: {recommendation}")

        return recommendations

    def generate_performance_report(self) -> Dict[str, Any]:
        """
        Generate a comprehensive performance report.

        Returns:
            Dictionary with complete performance analysis
        """
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total_methods": len(self.method_metrics),
                "total_measurements": sum(
                    len(times) for times in self.method_metrics.values()
                ),
                "total_operations": len(performance_monitor.get_performance_summary()),
            },
            "services": self.get_all_services_performance(),
            "operations": performance_monitor.get_performance_summary(),
            "bottlenecks": self.identify_bottlenecks(),
            "recommendations": self.get_optimization_recommendations(),
            "global_metrics": performance_monitor.get_performance_summary(),
        }

        # Add service-specific summaries
        for service_name in report["services"].keys():
            service_methods = report["services"][service_name]
            if service_methods:
                avg_times = [method["average"] for method in service_methods.values()]
                report["summary"][f"{service_name}_avg_time"] = float(
                    np.mean(avg_times)
                )
                report["summary"][f"{service_name}_total_methods"] = len(
                    service_methods
                )

        return report

    def print_performance_report(self):
        """Print a formatted performance report to console."""
        report = self.generate_performance_report()

        print("\n" + "=" * 80)
        print("🎵 SIMPLE ANALYSIS SERVICES - PERFORMANCE REPORT")
        print("=" * 80)
        print(f"📅 Generated: {report['timestamp']}")
        print(f"📊 Total Methods Monitored: {report['summary']['total_methods']}")
        print(f"📈 Total Measurements: {report['summary']['total_measurements']}")

        print("\n🏆 SERVICE PERFORMANCE SUMMARY:")
        print("-" * 50)
        for service_name, methods in report["services"].items():
            if methods:
                avg_times = [method["average"] for method in methods.values()]
                service_avg = np.mean(avg_times)
                print(f"📦 {service_name}:")
                print(f"   Methods: {len(methods)}")
                print(f"   Avg Time: {service_avg:.3f}s")
                print(f"   Slowest: {max(avg_times):.3f}s")
                print()

        print("\n🚨 PERFORMANCE BOTTLENECKS:")
        print("-" * 50)
        if report["bottlenecks"]:
            for i, bottleneck in enumerate(report["bottlenecks"][:10], 1):
                severity_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}[
                    bottleneck["severity"]
                ]
                source_icon = "🔍" if bottleneck.get("source") == "detailed_method_analysis" else "📊"
                print(f"{i:2d}. {severity_icon} {source_icon} {bottleneck['method']}")
                print(f"    {bottleneck['description']}")
                if bottleneck.get("count"):
                    print(f"    Calls: {bottleneck['count']}")
                print()
        else:
            print("✅ No significant bottlenecks detected!")

        print("\n💡 OPTIMIZATION RECOMMENDATIONS:")
        print("-" * 50)
        if report["recommendations"]:
            for service_name, recs in report["recommendations"].items():
                print(f"📦 {service_name}:")
                for rec in recs:
                    print(f"   {rec}")
                print()
        else:
            print("✅ No optimization recommendations at this time!")

        print("\n📊 OPERATION-LEVEL METRICS (@monitor_performance):")
        print("-" * 50)
        if report["operations"]:
            for operation, metrics in report["operations"].items():
                print(f"📊 {operation}:")
                print(f"   Count: {metrics['count']}")
                print(f"   Avg:   {metrics['average']:.3f}s")
                print(f"   Min:   {metrics['min']:.3f}s")
                print(f"   Max:   {metrics['max']:.3f}s")
                print(f"   Std:   {metrics['std']:.3f}s")
                print()
        else:
            print("No operation-level metrics available")

        print("\n📊 DETAILED METHOD STATISTICS:")
        print("-" * 50)
        for service_name, methods in report["services"].items():
            if methods:
                print(f"\n📦 {service_name}:")
                for method_name, stats in methods.items():
                    print(f"   🔧 {method_name}:")
                    print(f"      Count: {stats['count']}")
                    print(f"      Avg:   {stats['average']:.3f}s")
                    print(f"      Median:{stats['median']:.3f}s")
                    print(f"      Min:   {stats['min']:.3f}s")
                    print(f"      Max:   {stats['max']:.3f}s")
                    print(f"      P95:   {stats['p95']:.3f}s")
                    print(f"      P99:   {stats['p99']:.3f}s")
                    print()

        print("=" * 80)


# Global performance analyzer instance
performance_analyzer = PerformanceAnalyzer()


def analyze_method_performance(service_name: str, method_name: str):
    """
    Decorator to analyze performance of individual methods.

    Args:
        service_name: Name of the service
        method_name: Name of the method
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                performance_analyzer.record_method_timing(
                    service_name, method_name, duration
                )
                logger.debug(
                    f"{service_name}.{method_name} completed in {duration:.3f}s"
                )

        return wrapper

    return decorator


def get_performance_insights() -> Dict[str, Any]:
    """
    Get quick performance insights for dashboard or monitoring.

    Returns:
        Dictionary with key performance insights
    """
    report = performance_analyzer.generate_performance_report()

    insights = {
        "status": "healthy",
        "slowest_service": None,
        "slowest_method": None,
        "total_bottlenecks": len(report["bottlenecks"]),
        "critical_issues": 0,
        "recommendations_count": sum(
            len(recs) for recs in report["recommendations"].values()
        ),
    }

    # Find slowest service
    service_avgs = {}
    for service_name, methods in report["services"].items():
        if methods:
            avg_times = [method["average"] for method in methods.values()]
            service_avgs[service_name] = np.mean(avg_times)

    if service_avgs:
        insights["slowest_service"] = max(service_avgs, key=service_avgs.get)

    # Find slowest method
    all_methods = []
    for service_name, methods in report["services"].items():
        for method_name, stats in methods.items():
            all_methods.append((f"{service_name}.{method_name}", stats["average"]))

    if all_methods:
        insights["slowest_method"] = max(all_methods, key=lambda x: x[1])[0]

    # Count critical issues
    for bottleneck in report["bottlenecks"]:
        if bottleneck["severity"] == "high":
            insights["critical_issues"] += 1

    # Determine overall status
    if insights["critical_issues"] > 0:
        insights["status"] = "critical"
    elif insights["total_bottlenecks"] > 5:
        insights["status"] = "warning"

    return insights
