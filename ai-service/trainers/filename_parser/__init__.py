#!/usr/bin/env python3
"""
Filename Parser Training Module

This module provides tools for training a machine learning model to parse audio filenames
into structured metadata (artist, title, year, label, subtitle).

Features:
- Data augmentation for expanding training datasets
- Model training with multiple architecture options
- Integration with existing regex-based parser
- Evaluation and testing utilities
"""

# Import the main classes from their respective modules
from .data_augmentation import DatasetProcessor, FilenameAugmenter, ParsedMetadata
from .hybrid_parser import HybridFilenameParser
from .model_training import FilenameParserModel, ModelTrainer

__all__ = [
    "ParsedMetadata",
    "FilenameAugmenter",
    "DatasetProcessor",
    "FilenameParserModel",
    "ModelTrainer",
    "HybridFilenameParser",
]
