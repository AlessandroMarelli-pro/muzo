#!/usr/bin/env python3
"""
Model Training Module for Filename Parser

This module provides training capabilities for machine learning models
to parse audio filenames into structured metadata using sequence labeling.
"""

import json
import logging
import os
import pickle
import re
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)


class FilenameTokenizer:
    """Tokenize filenames for machine learning using character-level features"""

    def __init__(self, max_features: int = 10000):
        self.max_features = max_features
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=(1, 3),
            lowercase=True,
            stop_words=None,
            analyzer="char_wb",  # Character-level n-grams
        )
        self.is_fitted = False

    def fit_transform(self, filenames: List[str]) -> np.ndarray:
        """Fit vectorizer and transform filenames"""
        X = self.vectorizer.fit_transform(filenames)
        self.is_fitted = True
        return X.toarray()

    def transform(self, filenames: List[str]) -> np.ndarray:
        """Transform filenames using fitted vectorizer"""
        if not self.is_fitted:
            raise ValueError("Vectorizer must be fitted first")
        X = self.vectorizer.transform(filenames)
        return X.toarray()

    def save(self, path: str):
        """Save tokenizer"""
        with open(path, "wb") as f:
            pickle.dump(self.vectorizer, f)

    def load(self, path: str):
        """Load tokenizer"""
        with open(path, "rb") as f:
            self.vectorizer = pickle.load(f)
        self.is_fitted = True


class FilenameFeatureExtractor:
    """Extract features from filenames for pattern recognition"""

    def __init__(self):
        self.patterns = {
            "has_dash": r"-",
            "has_underscore": r"_",
            "has_parentheses": r"[()]",
            "has_brackets": r"[\[\]]",
            "has_year": r"\b(19|20)\d{2}\b",
            "has_number": r"\d+",
            "has_ampersand": r"&",
            "has_feat": r"\bfeat\b",
            "has_remix": r"\bremix\b",
            "has_mix": r"\bmix\b",
            "has_version": r"\bversion\b",
            "has_edit": r"\bedit\b",
            "has_extended": r"\bextended\b",
            "has_original": r"\boriginal\b",
            "has_instrumental": r"\binstrumental\b",
            "has_acapella": r"\bacapella\b",
            "has_dub": r"\bdub\b",
            "has_radio": r"\bradio\b",
            "has_album": r"\balbum\b",
            "has_single": r"\bsingle\b",
            "has_ep": r"\bep\b",
            "has_lp": r"\blp\b",
        }

    def extract_features(self, filename: str) -> Dict[str, bool]:
        """Extract pattern-based features from filename"""
        features = {}
        filename_lower = filename.lower()

        for pattern_name, pattern in self.patterns.items():
            features[pattern_name] = bool(re.search(pattern, filename_lower))

        # Additional features
        features["length"] = len(filename)
        features["word_count"] = len(filename.split())
        features["has_spaces"] = " " in filename
        features["has_dots"] = "." in filename
        features["has_colons"] = ":" in filename
        features["has_semicolons"] = ";" in filename
        features["has_commas"] = "," in filename
        features["has_quotes"] = (
            '"' in filename or "＂" in filename or '"' in filename or '"' in filename
        )
        features["has_single_quotes"] = (
            "'" in filename or """ in filename or """ in filename
        )
        features["has_apostrophes"] = "'" in filename

        return features

    def extract_positional_features(self, filename: str) -> Dict[str, float]:
        """Extract positional features (where patterns appear)"""
        features = {}
        filename_lower = filename.lower()

        # Find positions of key separators
        dash_pos = filename_lower.find("-")
        features["dash_position"] = dash_pos / len(filename) if dash_pos != -1 else -1

        paren_pos = filename_lower.find("(")
        features["paren_position"] = (
            paren_pos / len(filename) if paren_pos != -1 else -1
        )

        bracket_pos = filename_lower.find("[")
        features["bracket_position"] = (
            bracket_pos / len(filename) if bracket_pos != -1 else -1
        )

        # Find year position
        year_match = re.search(r"\b(19|20)\d{2}\b", filename_lower)
        features["year_position"] = (
            year_match.start() / len(filename) if year_match else -1
        )

        return features


class FilenameParserModel:
    """Machine learning model for filename parsing using pattern recognition"""

    def __init__(self):
        self.tokenizer = FilenameTokenizer()
        self.feature_extractor = FilenameFeatureExtractor()
        self.models = {}
        self.fields = ["artist", "title", "year", "label", "subtitle"]
        self.is_trained = False
        self.field_patterns = {}

    def prepare_data(
        self, df: pd.DataFrame
    ) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
        """Prepare training data with pattern-based features"""
        logger.info(f"Preparing data with {len(df)} samples")
        filenames = df["filename"].tolist()

        # Extract character-level features
        logger.info("Extracting character-level features...")
        X_char = self.tokenizer.fit_transform(filenames)
        logger.info(f"Character features shape: {X_char.shape}")

        # Extract pattern-based features
        logger.info("Extracting pattern-based features...")
        X_patterns = []
        total_filenames = len(filenames)

        for i, filename in enumerate(filenames):
            if i % 10000 == 0:  # Progress update every 10k samples
                progress = (i / total_filenames) * 100
                logger.info(
                    f"  Processing features: {progress:.1f}% ({i}/{total_filenames})"
                )

            pattern_features = self.feature_extractor.extract_features(filename)
            positional_features = self.feature_extractor.extract_positional_features(
                filename
            )

            # Combine all features
            combined_features = {**pattern_features, **positional_features}
            X_patterns.append(list(combined_features.values()))

        X_patterns = np.array(X_patterns)
        logger.info(f"Pattern features shape: {X_patterns.shape}")

        # Combine character and pattern features
        logger.info("Combining features...")
        X = np.hstack([X_char, X_patterns])
        logger.info(f"Final feature matrix shape: {X.shape}")

        # Prepare targets for each field - use binary classification
        logger.info("Preparing target labels...")
        y = {}
        for field in self.fields:
            # Convert to binary: 1 if field has content, 0 if empty
            field_data = df[field].fillna("").astype(str)
            y[field] = (field_data != "").astype(int)
            unique_count = len(np.unique(y[field]))
            logger.info(f"  {field}: {unique_count} unique classes")

        return X, y

    def train(self, df: pd.DataFrame, test_size: float = 0.2):
        """Train the model"""
        logger.info("Preparing training data...")
        X, y = self.prepare_data(df)
        print(f"Prepared data with {len(X)} samples")

        # Split data
        X_train, X_test, indices_train, indices_test = train_test_split(
            X, np.arange(len(X)), test_size=test_size, random_state=42
        )

        logger.info(f"Training set size: {len(X_train)}")
        logger.info(f"Test set size: {len(X_test)}")

        # Train separate models for each field
        total_fields = len(self.fields)
        for i, field in enumerate(self.fields):
            logger.info(f"Training model for field: {field} ({i + 1}/{total_fields})")

            # Get training targets
            y_train = y[field][indices_train]
            y_test = y[field][indices_test]
            # Check if we have enough samples and class diversity
            unique_classes = np.unique(y_train)
            if len(unique_classes) < 2:
                logger.warning(
                    f"Field {field} has only one class in training data. Skipping model training."
                )
                # Create a dummy model that always predicts the majority class
                from sklearn.dummy import DummyClassifier

                model = DummyClassifier(strategy="most_frequent")
                model.fit(X_train, y_train)
            else:
                # Train model - use LogisticRegression for binary classification
                logger.info(
                    f"  Training {field} model with {len(unique_classes)} unique classes..."
                )
                model = LogisticRegression(
                    random_state=42, max_iter=1000, class_weight="balanced"
                )
                model.fit(X_train, y_train)
                logger.info(f"  {field} model training completed")

            self.models[field] = model

            # Evaluate
            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            logger.info(f"  Accuracy for {field}: {accuracy:.3f}")

            # Progress update
            progress = (i + 1) / total_fields * 100
            logger.info(
                f"  Progress: {progress:.1f}% ({i + 1}/{total_fields} fields completed)"
            )

        self.is_trained = True
        logger.info("Training completed")

    def predict(self, filename: str) -> Dict[str, str]:
        """Predict metadata for a filename using pattern recognition"""
        if not self.is_trained:
            raise ValueError("Model must be trained first")

        # Extract features
        X_char = self.tokenizer.transform([filename])

        pattern_features = self.feature_extractor.extract_features(filename)
        print(f"Pattern features: {pattern_features}")
        positional_features = self.feature_extractor.extract_positional_features(
            filename
        )
        print(f"Positional features: {positional_features}")
        combined_features = {**pattern_features, **positional_features}
        X_patterns = np.array([list(combined_features.values())])

        X = np.hstack([X_char, X_patterns])

        # Predict which fields are present
        field_predictions = {}
        for field in self.fields:
            prediction = self.models[field].predict(X)[0]
            field_predictions[field] = bool(prediction)

        # Use regex patterns to extract actual values
        result = self._extract_values_from_filename(filename, field_predictions)
        return result

    def _extract_values_from_filename(
        self, filename: str, field_predictions: Dict[str, bool]
    ) -> Dict[str, str]:
        """Extract actual values from filename using regex patterns"""
        result = {field: "" for field in self.fields}

        # Remove file extension
        base_name = re.sub(r"\.[^.]*$", "", filename).strip()

        # Extract year first (most reliable)
        year_match = re.search(r"\b(19|20)\d{2}\b", base_name)
        if year_match and field_predictions.get("year", False):
            result["year"] = year_match.group()
            base_name = base_name.replace(year_match.group(), "").strip()

        # Extract label (in brackets)
        label_match = re.search(r"\[([^\]]+)\]", base_name)
        if label_match and field_predictions.get("label", False):
            result["label"] = label_match.group(1).strip()
            base_name = base_name.replace(label_match.group(), "").strip()

        # Extract subtitle (in parentheses)
        subtitle_match = re.search(r"\(([^)]+)\)", base_name)
        if subtitle_match and field_predictions.get("subtitle", False):
            result["subtitle"] = subtitle_match.group(1).strip()
            base_name = base_name.replace(subtitle_match.group(), "").strip()

        # Extract title from quotes (full-width or regular quotes)
        quote_patterns = [
            r'"([^"]+)"',  # Regular double quotes
            r"＂([^＂]+)＂",  # Full-width double quotes
            r'"([^"]+)"',  # Left/right double quotes
            r'"([^"]+)"',  # Alternative left/right quotes
        ]

        for pattern in quote_patterns:
            quote_match = re.search(pattern, base_name)
            if quote_match and (
                not field_predictions.get("title")
                or field_predictions.get("title") == ""
            ):
                result["title"] = quote_match.group(1).strip()
                base_name = base_name.replace(quote_match.group(), "").strip()
                break

        # Extract artist and title using common separators
        if (
            field_predictions.get("artist", False)
            and field_predictions.get("title", False)
        ) or (not result["artist"] and not result["title"]):
            # Try different separators
            separators = [" - ", " – ", " — ", " ~ ", " : ", " _ ", " . "]

            for sep in separators:
                if sep in base_name:
                    parts = base_name.split(sep, 1)
                    if len(parts) == 2:
                        result["artist"] = parts[0].strip()
                        result["title"] = parts[1].strip()
                        break

            # If no separator found, try to split on first space
            if not result["artist"] and not result["title"]:
                # For complex filenames, try to identify artist vs title
                # Look for patterns like "artist ( subtitle ) title year"
                if "(" in base_name and ")" in base_name:
                    # Find the first word before parentheses as artist
                    paren_start = base_name.find("(")
                    before_paren = base_name[:paren_start].strip()
                    if before_paren:
                        result["artist"] = before_paren
                        # Everything after parentheses (minus year) is title
                        after_paren = base_name[paren_start:].strip()
                        # Remove year if present
                        if result["year"]:
                            after_paren = after_paren.replace(
                                result["year"], ""
                            ).strip()
                        # Remove parentheses content
                        after_paren = re.sub(r"\([^)]*\)", "", after_paren).strip()
                        result["title"] = after_paren
                else:
                    # Simple case: split on first space
                    words = base_name.split()
                    if len(words) >= 2:
                        result["artist"] = words[0]
                        result["title"] = " ".join(words[1:])

        # If we still don't have artist and title, try to extract from remaining base_name
        if not result["artist"] and not result["title"] and base_name.strip():
            # If we have a title from quotes but no artist, try to extract artist from remaining text
            if result["title"] and base_name.strip():
                # The remaining text should be the artist
                result["artist"] = base_name.strip()
            elif not result["title"]:
                # No title found, treat the whole thing as title
                result["title"] = base_name.strip()

        # Clean up results
        for field in result:
            result[field] = result[field].strip()

        return result

    def predict_batch(self, filenames: List[str]) -> List[Dict[str, str]]:
        """Predict metadata for multiple filenames"""
        if not self.is_trained:
            raise ValueError("Model must be trained first")

        results = []
        for filename in filenames:
            result = self.predict(filename)
            results.append(result)

        return results

    def save(self, model_dir: str):
        """Save trained model"""
        os.makedirs(model_dir, exist_ok=True)

        # Save tokenizer
        self.tokenizer.save(os.path.join(model_dir, "tokenizer.pkl"))

        # Save feature extractor
        with open(os.path.join(model_dir, "feature_extractor.pkl"), "wb") as f:
            pickle.dump(self.feature_extractor, f)

        # Save models
        for field, model in self.models.items():
            with open(os.path.join(model_dir, f"{field}_model.pkl"), "wb") as f:
                pickle.dump(model, f)

        # Save metadata
        metadata = {"fields": self.fields, "is_trained": self.is_trained}
        with open(os.path.join(model_dir, "metadata.json"), "w") as f:
            json.dump(metadata, f)

        logger.info(f"Model saved to {model_dir}")

    def load(self, model_dir: str):
        """Load trained model"""
        # Load tokenizer
        self.tokenizer.load(os.path.join(model_dir, "tokenizer.pkl"))

        # Load feature extractor
        with open(os.path.join(model_dir, "feature_extractor.pkl"), "rb") as f:
            self.feature_extractor = pickle.load(f)

        # Load models
        self.models = {}
        for field in self.fields:
            with open(os.path.join(model_dir, f"{field}_model.pkl"), "rb") as f:
                self.models[field] = pickle.load(f)

        # Load metadata
        with open(os.path.join(model_dir, "metadata.json"), "r") as f:
            metadata = json.load(f)

        self.is_trained = metadata["is_trained"]
        logger.info(f"Model loaded from {model_dir}")


class ModelTrainer:
    """Main training class"""

    def __init__(self):
        self.model = FilenameParserModel()

    def train_from_csv(self, csv_path: str, model_dir: str, test_size: float = 0.2):
        """Train model from CSV file"""
        logger.info(f"Loading training data from {csv_path}")

        # Load data
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded {len(df)} samples")

        # Train model
        logger.info("Starting model training...")
        self.model.train(df, test_size=test_size)

        # Save model
        logger.info("Saving trained model...")
        self.model.save(model_dir)

        logger.info("Training completed successfully")

    def evaluate_model(self, csv_path: str) -> Dict[str, float]:
        """Evaluate model performance"""
        if not self.model.is_trained:
            raise ValueError("Model must be trained first")

        # Load test data
        df = pd.read_csv(csv_path)

        # Predict
        predictions = self.model.predict_batch(df["filename"].tolist())

        # Calculate accuracy for each field
        accuracies = {}
        for field in self.model.fields:
            true_values = df[field].fillna("").values
            pred_values = [pred[field] for pred in predictions]

            accuracy = accuracy_score(true_values, pred_values)
            accuracies[field] = accuracy

        return accuracies


def main():
    """Main function for testing"""
    trainer = ModelTrainer()

    # Example usage
    sample_data = {
        "filename": [
            "Artist - Title.mp3",
            "Band – Song (1999).mp3",
            "Singer ~ Track [Label].mp3",
        ],
        "artist": ["Artist", "Band", "Singer"],
        "title": ["Title", "Song", "Track"],
        "year": ["", "1999", ""],
        "label": ["", "", "Label"],
        "subtitle": ["", "", ""],
    }

    df = pd.DataFrame(sample_data)

    # Save sample data
    df.to_csv("sample_data.csv", index=False)

    # Train model
    trainer.train_from_csv("sample_data.csv", "trained_model")

    # Test prediction
    test_filename = "New Artist - New Song (2023).mp3"
    prediction = trainer.model.predict(test_filename)
    print(f"Prediction for '{test_filename}': {prediction}")


if __name__ == "__main__":
    main()
