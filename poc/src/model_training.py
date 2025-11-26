"""
Model Training Module - High Performance Version

This module implements machine learning model training for music genre and subgenre classification
using Random Forest algorithm with multiprocessing and GPU acceleration support.
Trains on music dataset features and provides model evaluation, persistence, and prediction capabilities.

Optimized for AMD Ryzen 7 + RTX 4070 high-performance training.
Based on the Muzo data model and AI service API specifications.
"""

import logging
import os
import time
from multiprocessing import cpu_count
from pathlib import Path
from typing import Dict, List, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.feature_selection import SelectKBest, f_classif, RFE
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from collections import Counter


# Try to import GPU acceleration libraries
try:
    import cupy as cp

    GPU_AVAILABLE = True
    print("🚀 GPU acceleration available (CuPy)")
except ImportError:
    GPU_AVAILABLE = False
    print("⚠️  GPU acceleration not available. Install CuPy for GPU support.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MusicGenreClassifier:
    """
    Music genre and subgenre classification using Random Forest algorithm with high-performance training.

    Trains on audio features extracted from music dataset and provides
    both genre and subgenre classification with confidence scores.
    Supports multiprocessing and GPU acceleration for faster training.
    """

    def __init__(
        self,
        model_name: str = "music-v1.0",
        random_state: int = 42,
        max_workers: int = None,
        use_gpu: bool = True,
    ):
        """
        Initialize the classifier.

        Args:
            model_name: Name/version of the model
            random_state: Random state for reproducibility
            max_workers: Maximum number of workers for parallel processing
            use_gpu: Whether to use GPU acceleration when available
        """
        self.model_name = model_name
        self.random_state = random_state
        self.max_workers = max_workers or cpu_count()
        self.use_gpu = use_gpu and GPU_AVAILABLE

        # Models for genre and subgenre classification
        self.genre_model = None
        self.subgenre_model = None

        # Scalers and encoders
        self.genre_scaler = StandardScaler()
        self.subgenre_scaler = StandardScaler()
        self.genre_encoder = LabelEncoder()
        self.subgenre_encoder = LabelEncoder()
        
        # Feature selectors
        self.genre_feature_selector = None
        self.subgenre_feature_selector = None
        self.genre_variance_selector = None
        self.subgenre_variance_selector = None

        # Feature and class information
        self.feature_columns = None
        self.genre_classes_ = None
        self.subgenre_classes_ = None
        self.actual_feature_count = None

        # Training status
        self.is_trained = False
        self.training_mode = "genre_only"  # "genre_only", "subgenre_only", "both"

    def prepare_features(
        self, df: pd.DataFrame
    ) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
        """
        Prepare features and labels for training (both genre and subgenre).

        Args:
            df: DataFrame with extracted features

        Returns:
            Tuple of (features, labels_dict) where labels_dict contains 'genre' and 'subgenre' arrays
        """
        # Filter out failed extractions
        if "extraction_failed" in df.columns:
            # Handle NaN values in extraction_failed column
            df_clean = df[~df["extraction_failed"].fillna(False)].copy()
        else:
            df_clean = df.copy()

        if len(df_clean) == 0:
            raise ValueError("No valid feature extractions found in dataset")

        # Extract feature columns (exclude metadata columns)
        metadata_columns = [
            "filename",
            "file_path",
            "genre",
            "subgenre",
            "label",  # Alternative column name for genre/subgenre
            "duration",
            "sample_rate",
            "extraction_failed",
            "error",
            "dataset",
            "extraction_date",
        ]

        feature_columns = [
            col for col in df_clean.columns if col not in metadata_columns
        ]

        # Handle GTZAN format features (already flattened)
        features_list = []
        for _, row in df_clean.iterrows():
            feature_vector = []

            for col in feature_columns:
                value = row[col]

                if isinstance(value, (int, float)):
                    # Scalar features (GTZAN format)
                    feature_vector.append(value)
                elif isinstance(value, str):
                    # Handle string values
                    if value.startswith("[") and value.endswith("]"):
                        # Parse string representation of array
                        try:
                            import ast

                            parsed_value = ast.literal_eval(value)
                            if isinstance(parsed_value, list):
                                feature_vector.extend(parsed_value)
                            else:
                                feature_vector.append(float(parsed_value))
                        except (ValueError, SyntaxError):
                            continue
                    else:
                        # Skip non-numeric strings
                        continue
                else:
                    # Handle other types (convert to float or skip)
                    try:
                        feature_vector.append(float(value))
                    except (ValueError, TypeError):
                        continue

            features_list.append(feature_vector)

        # Convert to numpy array with GPU acceleration if available
        if self.use_gpu and GPU_AVAILABLE:
            X = cp.asarray(features_list)
            X = cp.asnumpy(X)  # Convert back to CPU for sklearn
        else:
            X = np.array(features_list)

        # Prepare labels for both genre and subgenre
        labels_dict = {}

        # Genre labels
        if "genre" in df_clean.columns:
            genre_labels = df_clean["genre"].fillna("unknown").values
            labels_dict["genre"] = genre_labels
        else:
            raise ValueError("No 'genre' column found in dataset")

        # Subgenre labels
        if "subgenre" in df_clean.columns:
            subgenre_labels = df_clean["subgenre"].fillna("").values
            # Only use subgenre labels where subgenre is not empty
            has_subgenre = subgenre_labels != ""
            labels_dict["subgenre"] = subgenre_labels
            labels_dict["has_subgenre"] = has_subgenre
        else:
            # If no subgenre column, create empty array
            labels_dict["subgenre"] = np.array([""] * len(df_clean))
            labels_dict["has_subgenre"] = np.array([False] * len(df_clean))

        # Store feature column names for later use
        self.feature_columns = feature_columns
        self.actual_feature_count = X.shape[1]

        logger.info(f"Prepared features: {X.shape[0]} samples, {X.shape[1]} features")
        logger.info(f"Genres: {np.unique(labels_dict['genre'])}")
        if "subgenre" in labels_dict:
            unique_subgenres = np.unique(
                labels_dict["subgenre"][labels_dict["subgenre"] != ""]
            )
            logger.info(f"Subgenres: {unique_subgenres}")

        return X, labels_dict

    def select_features(self, X: np.ndarray, y: np.ndarray, model_type: str, max_features: int = None) -> np.ndarray:
        """
        Select the most important features to reduce overfitting.
        
        Args:
            X: Feature matrix
            y: Labels
            model_type: "genre" or "subgenre"
            max_features: Maximum number of features to select
            
        Returns:
            Selected feature matrix
        """
        # Determine optimal number of features based on sample size and classes
        n_samples, n_features = X.shape
        n_classes = len(np.unique(y))
        
        # Remove constant features first to avoid warnings
        from sklearn.feature_selection import VarianceThreshold
        
        # Remove features with zero variance (constant features)
        variance_selector = VarianceThreshold(threshold=0.0)
        X_no_constant = variance_selector.fit_transform(X)
        
        logger.info(f"Removed {X.shape[1] - X_no_constant.shape[1]} constant features")
        logger.info(f"Features after removing constants: {X_no_constant.shape[1]}")
        
        # Calculate max_features based on actual available features
        available_features = X_no_constant.shape[1]
        if max_features is None:
            # More generous feature selection: use more features for better performance
            max_features = min(
                int(np.sqrt(available_features) * 2),  # Allow more features
                max(10, n_samples // 5),  # More generous sample ratio
                int(available_features * 0.7)  # Use 70% of available features
            )
        
        # Ensure we don't try to select more features than available
        max_features = min(max_features, available_features)
        
        logger.info(f"Selecting {max_features} features from {available_features} for {model_type}")
        
        # Use SelectKBest with f_classif for feature selection
        selector = SelectKBest(score_func=f_classif, k=max_features)
        X_selected = selector.fit_transform(X_no_constant, y)
        
        # Store selectors for later use
        if model_type == "genre":
            self.genre_feature_selector = selector
            self.genre_variance_selector = variance_selector
        else:
            self.subgenre_feature_selector = selector
            self.subgenre_variance_selector = variance_selector
            
        logger.info(f"Selected {X_selected.shape[1]} features for {model_type}")
        return X_selected

    def analyze_class_distribution(self, y: np.ndarray, model_type: str) -> None:
        """
        Analyze and log class distribution to understand imbalance.
        
        Args:
            y: Labels
            model_type: "genre" or "subgenre"
        """
        class_counts = Counter(y)
        total_samples = len(y)
        
        logger.info(f"\n{model_type.capitalize()} Class Distribution:")
        logger.info(f"Total samples: {total_samples}")
        logger.info(f"Number of classes: {len(class_counts)}")
        
        # Log class distribution
        for class_name, count in class_counts.most_common():
            percentage = (count / total_samples) * 100
            logger.info(f"  {class_name}: {count} samples ({percentage:.1f}%)")
        
        # Calculate imbalance ratio
        max_count = max(class_counts.values())
        min_count = min(class_counts.values())
        imbalance_ratio = max_count / min_count if min_count > 0 else float('inf')
        
        logger.info(f"Imbalance ratio: {imbalance_ratio:.2f}")
        if imbalance_ratio > 10:
            logger.warning(f"High class imbalance detected for {model_type}!")
        elif imbalance_ratio > 5:
            logger.info(f"Moderate class imbalance for {model_type}")
        
        # Identify the most common class (likely cause of bias)
        most_common_class = class_counts.most_common(1)[0]
        logger.warning(f"Most common class: {most_common_class[0]} ({most_common_class[1]} samples, {(most_common_class[1]/total_samples)*100:.1f}%)")
        
        return class_counts

    def train(
        self,
        features_df: pd.DataFrame,
        test_size: float = 0.2,
        cv_folds: int = 5,
        optimize_hyperparameters: bool = True,
        training_mode: str = "both",  # "genre_only", "subgenre_only", "both"
    ) -> Dict:
        """
        Train the Random Forest classifier for genre and/or subgenre classification.

        Args:
            features_df: DataFrame with extracted features
            test_size: Proportion of data for testing
            cv_folds: Number of cross-validation folds
            optimize_hyperparameters: Whether to optimize hyperparameters
            training_mode: "genre_only", "subgenre_only", or "both"

        Returns:
            Dictionary with training results and metrics
        """
        logger.info(f"Starting high-performance training for model: {self.model_name}")
        logger.info(f"Training mode: {training_mode}")
        logger.info(f"Workers: {self.max_workers}, GPU: {self.use_gpu}")

        self.training_mode = training_mode
        start_time = time.time()

        # Prepare features
        X, labels_dict = self.prepare_features(features_df)

        results = {
            "model_name": self.model_name,
            "training_mode": training_mode,
            "training_samples": len(X),
            "n_features": X.shape[1],
            "use_gpu": self.use_gpu,
            "max_workers": self.max_workers,
        }

        # Train genre model
        if training_mode in ["genre_only", "both"]:
            logger.info("🎵 Training genre classifier...")
            # Analyze class distribution
            self.analyze_class_distribution(labels_dict["genre"], "genre")
            # Apply feature selection for genre classification
            X_genre_selected = self.select_features(X, labels_dict["genre"], "genre")
            genre_results = self._train_single_model(
                X_genre_selected,
                labels_dict["genre"],
                "genre",
                test_size,
                cv_folds,
                optimize_hyperparameters,
            )
            results.update({f"genre_{k}": v for k, v in genre_results.items()})

        # Train subgenre model
        if training_mode in ["subgenre_only", "both"]:
            logger.info("🎶 Training subgenre classifier...")
            # Only train on samples that have subgenre labels
            has_subgenre_mask = labels_dict["has_subgenre"]
            if np.any(has_subgenre_mask):
                X_subgenre = X[has_subgenre_mask]
                y_subgenre = labels_dict["subgenre"][has_subgenre_mask]
                
                # Analyze class distribution
                self.analyze_class_distribution(y_subgenre, "subgenre")
                
                # Apply feature selection for subgenre classification (adaptive approach)
                # Let the method determine optimal number based on available features
                X_subgenre_selected = self.select_features(X_subgenre, y_subgenre, "subgenre")

                subgenre_results = self._train_single_model(
                    X_subgenre_selected,
                    y_subgenre,
                    "subgenre",
                    test_size,
                    cv_folds,
                    optimize_hyperparameters,
                )
                results.update(
                    {f"subgenre_{k}": v for k, v in subgenre_results.items()}
                )
            else:
                logger.warning("No subgenre labels found, skipping subgenre training")
                results["subgenre_training"] = "skipped_no_labels"

        training_time = time.time() - start_time
        results["training_time"] = training_time
        results["training_rate"] = len(X) / training_time

        self.is_trained = True

        logger.info(f"✅ Training completed in {training_time:.1f} seconds")
        logger.info(f"📈 Training rate: {results['training_rate']:.1f} samples/second")

        return results

    def _train_single_model(
        self,
        X: np.ndarray,
        y: np.ndarray,
        model_type: str,
        test_size: float,
        cv_folds: int,
        optimize_hyperparameters: bool,
    ) -> Dict:
        """
        Train a single model (genre or subgenre) with high-performance features.

        Args:
            X: Feature matrix
            y: Labels
            model_type: "genre" or "subgenre"
            test_size: Test set proportion
            cv_folds: Cross-validation folds
            optimize_hyperparameters: Whether to optimize hyperparameters

        Returns:
            Dictionary with training results
        """
        # Encode labels
        if model_type == "genre":
            y_encoded = self.genre_encoder.fit_transform(y)
            self.genre_classes_ = self.genre_encoder.classes_
            scaler = self.genre_scaler
        else:
            y_encoded = self.subgenre_encoder.fit_transform(y)
            self.subgenre_classes_ = self.subgenre_encoder.classes_
            scaler = self.subgenre_scaler

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y_encoded,
            test_size=test_size,
            random_state=self.random_state,
            stratify=y_encoded,
        )

        # Scale features with GPU acceleration if available
        if self.use_gpu and GPU_AVAILABLE:
            X_train_gpu = cp.asarray(X_train)
            X_test_gpu = cp.asarray(X_test)

            # Scale on GPU
            scaler.fit(cp.asnumpy(X_train_gpu))
            X_train_scaled = scaler.transform(cp.asnumpy(X_train_gpu))
            X_test_scaled = scaler.transform(cp.asnumpy(X_test_gpu))
        else:
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)

        logger.info(f"Training set: {X_train_scaled.shape[0]} samples")
        logger.info(f"Test set: {X_test_scaled.shape[0]} samples")

        # Initialize Random Forest with balanced regularization
        rf_params = {
            "n_estimators": 150,  # Moderate number for good performance
            "max_depth": 20,  # Allow more depth for complex patterns
            "min_samples_split": 5,  # Moderate constraint
            "min_samples_leaf": 2,  # Allow smaller leaves for fine-grained patterns
            "min_weight_fraction_leaf": 0.0,  # Remove overly restrictive constraint
            "max_features": "sqrt",  # Keep feature limitation
            "random_state": self.random_state,
            "n_jobs": self.max_workers,  # Use all available cores
            "bootstrap": True,
            "oob_score": True,
            "class_weight": "balanced",  # Handle class imbalance
        }

        if optimize_hyperparameters:
            logger.info(f"🔍 Optimizing hyperparameters for {model_type}...")

            # Define parameter grid with balanced approach
            param_grid = {
                "n_estimators": [100, 150, 200],
                "max_depth": [15, 20, 25],
                "min_samples_split": [2, 5, 8],
                "min_samples_leaf": [1, 2, 3],
                "max_features": ["sqrt", "log2", 0.7],
            }

            # Grid search with parallel processing
            grid_search = GridSearchCV(
                RandomForestClassifier(
                    random_state=self.random_state, n_jobs=self.max_workers
                ),
                param_grid,
                cv=cv_folds,
                scoring="accuracy",
                n_jobs=self.max_workers,
                verbose=1,
            )

            grid_search.fit(X_train_scaled, y_train)
            best_params = grid_search.best_params_
            logger.info(f"Best parameters for {model_type}: {best_params}")
            rf_params.update(best_params)

        # Train ensemble model for better performance
        # Use more aggressive regularization for subgenre classification
        if model_type == "subgenre":
            # More conservative parameters for 33-class problem
            rf_params_subgenre = rf_params.copy()
            rf_params_subgenre.update({
                "n_estimators": 200,  # More trees for stability
                "max_depth": 15,  # Shallower trees
                "min_samples_split": 10,  # More samples required
                "min_samples_leaf": 5,  # More samples per leaf
                "max_features": "log2",  # Fewer features per split
                "class_weight": "balanced_subsample",  # Better class balancing
            })
            
            rf_model = RandomForestClassifier(**rf_params_subgenre)
            et_model = ExtraTreesClassifier(**rf_params_subgenre)
        else:
            # Standard parameters for genre classification
            rf_model = RandomForestClassifier(**rf_params)
            et_model = ExtraTreesClassifier(
                n_estimators=rf_params["n_estimators"],
                max_depth=rf_params["max_depth"],
                min_samples_split=rf_params["min_samples_split"],
                min_samples_leaf=rf_params["min_samples_leaf"],
                max_features=rf_params["max_features"],
                random_state=self.random_state,
                n_jobs=self.max_workers,
                bootstrap=True,
                class_weight="balanced_subsample",  # Better class balancing
            )
        
        # Create voting classifier
        model = VotingClassifier(
            estimators=[
                ('rf', rf_model),
                ('et', et_model)
            ],
            voting='soft'  # Use probability voting for better performance
        )
        model.fit(X_train_scaled, y_train)

        # Store model
        if model_type == "genre":
            self.genre_model = model
        else:
            self.subgenre_model = model

        # Evaluate model
        train_score = model.score(X_train_scaled, y_train)
        test_score = model.score(X_test_scaled, y_test)

        # Cross-validation score with stratified k-fold
        stratified_cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=self.random_state)
        cv_scores = cross_val_score(
            model,
            X_train_scaled,
            y_train,
            cv=stratified_cv,
            scoring="accuracy",
            n_jobs=self.max_workers,
        )

        # Predictions for detailed evaluation
        y_pred = model.predict(X_test_scaled)

        # Classification report
        classes = (
            self.genre_classes_ if model_type == "genre" else self.subgenre_classes_
        )
        class_report = classification_report(
            y_test, y_pred, target_names=classes, output_dict=True
        )

        # Confusion matrix
        conf_matrix = confusion_matrix(y_test, y_pred)

        # Feature importance (average for ensemble models)
        if hasattr(model, 'feature_importances_'):
            feature_importance = model.feature_importances_
        else:
            # For ensemble models, average the feature importances
            importances = []
            for estimator in model.estimators_:
                importances.append(estimator.feature_importances_)
            feature_importance = np.mean(importances, axis=0)

        # Prepare results
        results = {
            "training_samples": X_train_scaled.shape[0],
            "test_samples": X_test_scaled.shape[0],
            "n_classes": len(classes),
            "classes": classes.tolist(),
            "train_accuracy": float(train_score),
            "test_accuracy": float(test_score),
            "cv_mean": float(cv_scores.mean()),
            "cv_std": float(cv_scores.std()),
            "classification_report": class_report,
            "confusion_matrix": conf_matrix.tolist(),
            "feature_importance": feature_importance.tolist(),
            "best_params": rf_params if optimize_hyperparameters else None,
            "hyperparameter_optimization": optimize_hyperparameters,
        }

        logger.info(
            f"{model_type.capitalize()} - Train: {train_score:.4f}, Test: {test_score:.4f}, CV: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}"
        )

        return results

    def predict(self, features: Union[np.ndarray, List]) -> Dict:
        """
        Predict genre and subgenre for given features.

        Args:
            features: Feature vector or list of feature vectors

        Returns:
            Dictionary with prediction results for both genre and subgenre
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Convert to numpy array if needed
        if isinstance(features, list):
            features = np.array(features)

        # Ensure 2D array
        if features.ndim == 1:
            features = features.reshape(1, -1)

        results = {
            "genre_prediction": None,
            "subgenre_prediction": None,
        }

        # Predict genre
        if self.genre_model is not None:
            # Apply feature preprocessing if available
            if self.genre_variance_selector is not None and self.genre_feature_selector is not None:
                # First remove constant features, then select best features
                features_no_constant = self.genre_variance_selector.transform(features)
                features_selected = self.genre_feature_selector.transform(features_no_constant)
            else:
                features_selected = features
                
            features_scaled = self.genre_scaler.transform(features_selected)
            genre_predictions = self.genre_model.predict(features_scaled)
            genre_probabilities = self.genre_model.predict_proba(features_scaled)
            predicted_genres = self.genre_encoder.inverse_transform(genre_predictions)

            genre_results = []
            for i, (genre, probs) in enumerate(
                zip(predicted_genres, genre_probabilities)
            ):
                confidence = float(np.max(probs))
                top_indices = np.argsort(probs)[-3:][::-1]
                alternative_genres = []

                for idx in top_indices:
                    alt_genre = self.genre_classes_[idx]
                    alt_confidence = float(probs[idx])
                    alternative_genres.append(
                        {"genre": alt_genre, "confidence": alt_confidence}
                    )

                genre_result = {
                    "primary_genre": genre,
                    "confidence": confidence,
                    "alternative_genres": alternative_genres,
                    "all_probabilities": {
                        self.genre_classes_[j]: float(probs[j])
                        for j in range(len(self.genre_classes_))
                    },
                }
                genre_results.append(genre_result)

            results["genre_prediction"] = (
                genre_results[0] if len(genre_results) == 1 else genre_results
            )

        # Predict subgenre
        if self.subgenre_model is not None:
            # Apply feature preprocessing if available
            if self.subgenre_variance_selector is not None and self.subgenre_feature_selector is not None:
                # First remove constant features, then select best features
                features_no_constant = self.subgenre_variance_selector.transform(features)
                features_selected = self.subgenre_feature_selector.transform(features_no_constant)
            else:
                features_selected = features
                
            features_scaled = self.subgenre_scaler.transform(features_selected)
            subgenre_predictions = self.subgenre_model.predict(features_scaled)
            subgenre_probabilities = self.subgenre_model.predict_proba(features_scaled)
            predicted_subgenres = self.subgenre_encoder.inverse_transform(
                subgenre_predictions
            )

            subgenre_results = []
            for i, (subgenre, probs) in enumerate(
                zip(predicted_subgenres, subgenre_probabilities)
            ):
                confidence = float(np.max(probs))
                top_indices = np.argsort(probs)[-3:][::-1]
                alternative_subgenres = []

                for idx in top_indices:
                    alt_subgenre = self.subgenre_classes_[idx]
                    alt_confidence = float(probs[idx])
                    alternative_subgenres.append(
                        {"subgenre": alt_subgenre, "confidence": alt_confidence}
                    )

                subgenre_result = {
                    "primary_subgenre": subgenre,
                    "confidence": confidence,
                    "alternative_subgenres": alternative_subgenres,
                    "all_probabilities": {
                        self.subgenre_classes_[j]: float(probs[j])
                        for j in range(len(self.subgenre_classes_))
                    },
                }
                subgenre_results.append(subgenre_result)

            results["subgenre_prediction"] = (
                subgenre_results[0] if len(subgenre_results) == 1 else subgenre_results
            )

        return results

    def analyze_prediction_confidence(self, features: Union[np.ndarray, List], threshold: float = 0.5) -> Dict:
        """
        Analyze prediction confidence and identify low-confidence predictions.
        
        Args:
            features: Feature vector or list of feature vectors
            threshold: Confidence threshold below which predictions are considered unreliable
            
        Returns:
            Dictionary with confidence analysis
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before analyzing predictions")
        
        # Convert to numpy array if needed
        if isinstance(features, list):
            features = np.array(features)
        
        # Ensure 2D array
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        results = {
            "genre_confidence": None,
            "subgenre_confidence": None,
            "low_confidence_warnings": [],
            "recommendations": []
        }
        
        # Analyze genre prediction confidence
        if self.genre_model is not None:
            # Apply feature preprocessing
            if self.genre_variance_selector is not None and self.genre_feature_selector is not None:
                features_no_constant = self.genre_variance_selector.transform(features)
                features_selected = self.genre_feature_selector.transform(features_no_constant)
            else:
                features_selected = features
                
            features_scaled = self.genre_scaler.transform(features_selected)
            genre_probabilities = self.genre_model.predict_proba(features_scaled)
            
            max_genre_confidence = float(np.max(genre_probabilities))
            results["genre_confidence"] = max_genre_confidence
            
            if max_genre_confidence < threshold:
                results["low_confidence_warnings"].append(
                    f"Genre prediction confidence ({max_genre_confidence:.3f}) is below threshold ({threshold})"
                )
                results["recommendations"].append("Consider collecting more diverse training data for genre classification")
        
        # Analyze subgenre prediction confidence
        if self.subgenre_model is not None:
            # Apply feature preprocessing
            if self.subgenre_variance_selector is not None and self.subgenre_feature_selector is not None:
                features_no_constant = self.subgenre_variance_selector.transform(features)
                features_selected = self.subgenre_feature_selector.transform(features_no_constant)
            else:
                features_selected = features
                
            features_scaled = self.subgenre_scaler.transform(features_selected)
            subgenre_probabilities = self.subgenre_model.predict_proba(features_scaled)
            
            max_subgenre_confidence = float(np.max(subgenre_probabilities))
            results["subgenre_confidence"] = max_subgenre_confidence
            
            if max_subgenre_confidence < threshold:
                results["low_confidence_warnings"].append(
                    f"Subgenre prediction confidence ({max_subgenre_confidence:.3f}) is below threshold ({threshold})"
                )
                results["recommendations"].append("Consider implementing hierarchical classification for better subgenre accuracy")
        
        return results

    def predict_with_confidence(self, features: Union[np.ndarray, List], confidence_threshold: float = 0.5) -> Dict:
        """
        Predict with confidence analysis and warnings for low-confidence predictions.
        
        Args:
            features: Feature vector or list of feature vectors
            confidence_threshold: Threshold below which predictions are flagged as unreliable
            
        Returns:
            Dictionary with predictions and confidence analysis
        """
        # Get standard predictions
        predictions = self.predict(features)
        
        # Get confidence analysis
        confidence_analysis = self.analyze_prediction_confidence(features, confidence_threshold)
        
        # Combine results
        results = {
            **predictions,
            "confidence_analysis": confidence_analysis,
            "is_reliable": len(confidence_analysis["low_confidence_warnings"]) == 0
        }
        
        return results

    def save_model(self, file_path: Union[str, Path]) -> None:
        """
        Save the trained model to disk.

        Args:
            file_path: Path to save the model
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")

        model_data = {
            "genre_model": self.genre_model,
            "subgenre_model": self.subgenre_model,
            "genre_scaler": self.genre_scaler,
            "subgenre_scaler": self.subgenre_scaler,
            "genre_encoder": self.genre_encoder,
            "subgenre_encoder": self.subgenre_encoder,
            "genre_feature_selector": self.genre_feature_selector,
            "subgenre_feature_selector": self.subgenre_feature_selector,
            "genre_variance_selector": self.genre_variance_selector,
            "subgenre_variance_selector": self.subgenre_variance_selector,
            "feature_columns": self.feature_columns,
            "actual_feature_count": self.actual_feature_count,
            "genre_classes_": self.genre_classes_,
            "subgenre_classes_": self.subgenre_classes_,
            "model_name": self.model_name,
            "random_state": self.random_state,
            "training_mode": self.training_mode,
            "max_workers": self.max_workers,
            "use_gpu": self.use_gpu,
        }

        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Save using joblib for better performance with scikit-learn objects
        joblib.dump(model_data, file_path)

        logger.info(f"Model saved to: {file_path}")

    def load_model(self, file_path: Union[str, Path]) -> None:
        """
        Load a trained model from disk.

        Args:
            file_path: Path to the saved model
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Model file not found: {file_path}")

        # Load model data
        model_data = joblib.load(file_path)

        # Restore model components
        self.genre_model = model_data.get("genre_model")
        self.subgenre_model = model_data.get("subgenre_model")
        self.genre_scaler = model_data.get("genre_scaler")
        self.subgenre_scaler = model_data.get("subgenre_scaler")
        self.genre_encoder = model_data.get("genre_encoder")
        self.subgenre_encoder = model_data.get("subgenre_encoder")
        self.genre_feature_selector = model_data.get("genre_feature_selector")
        self.subgenre_feature_selector = model_data.get("subgenre_feature_selector")
        self.genre_variance_selector = model_data.get("genre_variance_selector")
        self.subgenre_variance_selector = model_data.get("subgenre_variance_selector")
        self.feature_columns = model_data.get("feature_columns")
        self.actual_feature_count = model_data.get("actual_feature_count")
        self.genre_classes_ = model_data.get("genre_classes_")
        self.subgenre_classes_ = model_data.get("subgenre_classes_")
        self.model_name = model_data.get("model_name")
        self.random_state = model_data.get("random_state")
        self.training_mode = model_data.get("training_mode", "genre_only")
        self.max_workers = model_data.get("max_workers", cpu_count())
        self.use_gpu = model_data.get("use_gpu", False)
        self.is_trained = True

        logger.info(f"Model loaded from: {file_path}")
        logger.info(f"Training mode: {self.training_mode}")

    def get_model_info(self) -> Dict:
        """
        Get information about the trained model.

        Returns:
            Dictionary with model information
        """
        if not self.is_trained:
            return {"status": "not_trained"}

        info = {
            "model_name": self.model_name,
            "training_mode": self.training_mode,
            "n_features": self.actual_feature_count
            if hasattr(self, "actual_feature_count")
            else len(self.feature_columns),
            "feature_columns": self.feature_columns,
            "model_type": "RandomForestClassifier",
            "random_state": self.random_state,
            "max_workers": self.max_workers,
            "use_gpu": self.use_gpu,
        }

        if self.genre_model is not None:
            info["genre_classes"] = self.genre_classes_.tolist()
            info["genre_n_classes"] = len(self.genre_classes_)

        if self.subgenre_model is not None:
            info["subgenre_classes"] = self.subgenre_classes_.tolist()
            info["subgenre_n_classes"] = len(self.subgenre_classes_)

        return info


def train_music_model(
    features_file: str,
    output_dir: str = "models",
    model_name: str = "music-v1.0",
    optimize_hyperparameters: bool = True,
    training_mode: str = "both",
    max_workers: int = None,
    use_gpu: bool = True,
) -> Dict:
    """
    Train Random Forest model on music dataset features with high-performance capabilities.

    Args:
        features_file: Path to CSV file with extracted features
        output_dir: Directory to save the trained model
        model_name: Name/version of the model
        optimize_hyperparameters: Whether to optimize hyperparameters
        training_mode: "genre_only", "subgenre_only", or "both"
        max_workers: Maximum number of workers for parallel processing
        use_gpu: Whether to use GPU acceleration when available

    Returns:
        Dictionary with training results
    """
    logger.info(f"Training high-performance model on music dataset: {features_file}")
    logger.info(f"Training mode: {training_mode}")
    logger.info(f"Workers: {max_workers or cpu_count()}, GPU: {use_gpu}")

    # Load features
    if not os.path.exists(features_file):
        raise FileNotFoundError(f"Features file not found: {features_file}")

    df = pd.read_csv(features_file)
    logger.info(f"Loaded features: {len(df)} samples")

    # Initialize classifier with high-performance settings
    classifier = MusicGenreClassifier(
        model_name=model_name, max_workers=max_workers, use_gpu=use_gpu
    )

    # Train model
    results = classifier.train(
        df,
        optimize_hyperparameters=optimize_hyperparameters,
        training_mode=training_mode,
    )

    # Save model
    model_path = os.path.join(output_dir, f"{model_name}.pkl")
    classifier.save_model(model_path)

    # Save training results
    results_path = os.path.join(output_dir, f"{model_name}_results.json")
    import json

    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Training completed. Model saved to: {model_path}")
    logger.info(f"Results saved to: {results_path}")

    return results


if __name__ == "__main__":
    """
    Example usage and training script.
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Train Random Forest model on music dataset"
    )
    parser.add_argument(
        "--features",
        default="../data/features_extracted.csv",
        help="Path to features CSV file",
    )
    parser.add_argument(
        "--output", default="../models", help="Output directory for trained model"
    )
    parser.add_argument("--model-name", default="music-v1.0", help="Model name/version")
    parser.add_argument(
        "--no-optimize", action="store_true", help="Skip hyperparameter optimization"
    )
    parser.add_argument(
        "--training-mode",
        choices=["genre_only", "subgenre_only", "both"],
        default="both",
        help="Training mode: genre_only, subgenre_only, or both",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Number of parallel workers (default: CPU count)",
    )
    parser.add_argument(
        "--no-gpu", action="store_true", help="Disable GPU acceleration"
    )

    args = parser.parse_args()

    # Train model
    try:
        results = train_music_model(
            features_file=args.features,
            output_dir=args.output,
            model_name=args.model_name,
            optimize_hyperparameters=not args.no_optimize,
            training_mode=args.training_mode,
            max_workers=args.workers,
            use_gpu=not args.no_gpu,
        )

        print("\n=== High-Performance Training Results ===")
        print(f"Model: {results['model_name']}")
        print(f"Training mode: {results['training_mode']}")
        print(f"Training samples: {results['training_samples']}")
        print(f"Features: {results['n_features']}")
        print(f"Workers: {results['max_workers']}, GPU: {results['use_gpu']}")
        print(f"Training time: {results['training_time']:.1f}s")
        print(f"Training rate: {results['training_rate']:.1f} samples/second")

        # Display genre results
        if "genre_test_accuracy" in results:
            print("\n=== Genre Classification ===")
            print(f"Training samples: {results['genre_training_samples']}")
            print(f"Test samples: {results['genre_test_samples']}")
            print(f"Classes: {results['genre_n_classes']}")
            print(f"Train accuracy: {results['genre_train_accuracy']:.4f}")
            print(f"Test accuracy: {results['genre_test_accuracy']:.4f}")
            print(
                f"CV accuracy: {results['genre_cv_mean']:.4f} ± {results['genre_cv_std']:.4f}"
            )

        # Display subgenre results
        if "subgenre_test_accuracy" in results:
            print("\n=== Subgenre Classification ===")
            print(f"Training samples: {results['subgenre_training_samples']}")
            print(f"Test samples: {results['subgenre_test_samples']}")
            print(f"Classes: {results['subgenre_n_classes']}")
            print(f"Train accuracy: {results['subgenre_train_accuracy']:.4f}")
            print(f"Test accuracy: {results['subgenre_test_accuracy']:.4f}")
            print(
                f"CV accuracy: {results['subgenre_cv_mean']:.4f} ± {results['subgenre_cv_std']:.4f}"
            )

        # Check if target accuracy is met
        target_accuracy = 0.80  # 80% target
        genre_met = results.get("genre_test_accuracy", 0) >= target_accuracy
        subgenre_met = results.get("subgenre_test_accuracy", 0) >= target_accuracy

        if genre_met and subgenre_met:
            print(
                f"\n✅ SUCCESS: Both models achieved target accuracy ({target_accuracy:.2f})"
            )
        elif genre_met or subgenre_met:
            print(
                f"\n⚠️  PARTIAL: Some models achieved target accuracy ({target_accuracy:.2f})"
            )
        else:
            print(
                f"\n❌ WARNING: Models did not achieve target accuracy ({target_accuracy:.2f})"
            )

    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise
