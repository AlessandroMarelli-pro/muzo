"""
Logging configuration for scrapers.
"""

import logging
import sys


def setup_logging(level=logging.INFO, format_string=None):
    """
    Set up logging configuration for scrapers.

    Args:
        level: Logging level (default: INFO)
        format_string: Custom format string for log messages
    """
    if format_string is None:
        format_string = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    logging.basicConfig(
        level=level, format=format_string, handlers=[logging.StreamHandler(sys.stdout)]
    )

    # Reduce noise from external libraries
    logging.getLogger("musicbrainzngs").setLevel(logging.WARNING)
    logging.getLogger("pylast").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def get_logger(name):
    """
    Get a logger instance for a scraper.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)
