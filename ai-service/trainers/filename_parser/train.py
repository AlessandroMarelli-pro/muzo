#!/usr/bin/env python3
"""
Training Pipeline for Filename Parser

This script provides a complete pipeline for training a filename parser model
from a CSV dataset with data augmentation.
"""

import argparse
import logging
import os
import sys
from pathlib import Path

# Add the parent directory to the path to import modules
sys.path.append(str(Path(__file__).parent.parent.parent))

from trainers.filename_parser.data_augmentation import DatasetProcessor
from trainers.filename_parser.hybrid_parser import HybridFilenameParser
from trainers.filename_parser.model_training import ModelTrainer

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def create_sample_dataset(output_path: str):
    """Create a sample dataset for testing"""
    sample_data = {
        "filename": [
            "Light In Darkness - Serpent 🇯🇵 1999.mp3",
            "Mecánica Clásica - Columnas de Agua.mp3",
            "Mind Body & Soul - Lost In A Maze (Extended Version).mp3",
            "Monkey's Touch - Mutant Song.mp3",
            "Monschau - Cynic.mp3",
            "Kabuki femme fatale (Jita Sensation Remix).mp3",
            "Homies   Paraíso.mp3",
            "Dawn Again ＂Outerspace Indoors feat Lochie Thompson＂.mp3",
            "Jon Anderson   Speed Deep (The Deep Forest Remix) (1995).mp3",
            "Done With You.mp3",
            "Maine Kaha Tha Mat Jao Tum.mp3",
            "Identification Unknown (Longhair Remix).mp3",
            "Are You Feeling.mp3",
            "Dates on Skates.mp3",
            "Africa (Flute Mix).mp3",
            "Golden Shot (Omformer 'Energy Cycle' Mix).mp3",
            "Le salaire du rappeur   Charles Henry.mp3",
            "Ever Changing Bubbles (Deep88 Balearic Mix).mp3",
            "Cosmic Police (Edit).mp3",
            "Amida ‎   Amitabha Mix 1.mp3",
        ],
        "artist": [
            "Light In Darkness",
            "Mecánica Clásica",
            "Mind Body & Soul",
            "Monkey's Touch",
            "Monschau",
            "Kabuki",
            "Homies",
            "Dawn Again",
            "Jon Anderson",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Charles Henry",
            "",
            "",
            "Amida",
        ],
        "title": [
            "Serpent",
            "Columnas de Agua",
            "Lost In A Maze (Extended Version)",
            "Mutant Song",
            "Cynic",
            "femme fatale (Jita Sensation Remix)",
            "Paraíso",
            "＂Outerspace Indoors feat Lochie Thompson＂",
            "Speed Deep (The Deep Forest Remix)",
            "Done With You",
            "Maine Kaha Tha Mat Jao Tum",
            "Identification Unknown (Longhair Remix)",
            "Are You Feeling",
            "Dates on Skates",
            "Africa (Flute Mix)",
            "Golden Shot (Omformer 'Energy Cycle' Mix)",
            "Le salaire du rappeur",
            "Ever Changing Bubbles (Deep88 Balearic Mix)",
            "Cosmic Police (Edit)",
            "Amitabha Mix 1",
        ],
        "year": [
            "1999",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "1995",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ],
        "label": [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ],
        "subtitle": [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ],
    }

    import pandas as pd

    df = pd.DataFrame(sample_data)
    df.to_csv(output_path, index=False)
    logger.info(f"Sample dataset created at {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Train filename parser model")
    parser.add_argument(
        "--input-csv", type=str, help="Input CSV file with training data"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="trained_models",
        help="Output directory for trained model",
    )
    parser.add_argument(
        "--augmented-csv", type=str, help="Output path for augmented dataset"
    )
    parser.add_argument(
        "--test-size", type=float, default=0.2, help="Test set size (0.0 to 1.0)"
    )
    parser.add_argument(
        "--create-sample", action="store_true", help="Create sample dataset for testing"
    )

    args = parser.parse_args()

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    if args.create_sample:
        sample_path = os.path.join(args.output_dir, "sample_dataset.csv")
        create_sample_dataset(sample_path)
        logger.info(f"Sample dataset created at {sample_path}")
        return

    if not args.input_csv:
        logger.error("Input CSV file is required")
        return

    if not os.path.exists(args.input_csv):
        logger.error(f"Input CSV file not found: {args.input_csv}")
        return

    try:
        # Step 1: Data Augmentation
        logger.info("Step 1: Data Augmentation")
        processor = DatasetProcessor()

        if args.augmented_csv:
            augmented_path = args.augmented_csv
        else:
            augmented_path = os.path.join(args.output_dir, "augmented_dataset.csv")

        augmented_df = processor.create_training_data(args.input_csv, augmented_path)
        logger.info(f"Augmented dataset saved to {augmented_path}")

        # Step 2: Model Training
        logger.info("Step 2: Model Training")
        trainer = ModelTrainer()
        trainer.train_from_csv(augmented_path, args.output_dir, args.test_size)

        # Step 3: Test Hybrid Parser
        logger.info("Step 3: Testing Hybrid Parser")
        hybrid_parser = HybridFilenameParser(args.output_dir)

        # Test with a few samples
        test_filenames = [
            "Test Artist - Test Song.mp3",
            "Another Band – Another Track (2023).mp3",
        ]

        for filename in test_filenames:
            result = hybrid_parser.parse(filename)
            logger.info(f"Parsed '{filename}': {result}")

        logger.info("Training pipeline completed successfully!")

    except Exception as e:
        logger.error(f"Training pipeline failed: {e}")
        raise


if __name__ == "__main__":
    main()

