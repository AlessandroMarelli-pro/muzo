"""
Hierarchical Music Classification System

Two-stage approach:
1. Stage 1: Genre Classification (5 classes)
2. Stage 2: Subgenre Classification within each genre (specialized models)

This approach provides better performance than single-stage classification
by reducing the complexity from 33 classes to 5 + smaller subsets.
"""

import logging
import os
import pickle
import time
from pathlib import Path
from typing import Dict, List, Tuple, Union
import pandas as pd
import numpy as np
from collections import Counter

from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.feature_selection import SelectKBest, f_classif, VarianceThreshold

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HierarchicalMusicClassifier:
    """
    Two-stage hierarchical music classifier:
    1. Genre classifier (5 classes)
    2. Subgenre classifiers (one per genre)
    """
    
    def __init__(self, model_name: str = "hierarchical-v1.0", max_workers: int = None):
        """
        Initialize hierarchical classifier.
        
        Args:
            model_name: Name for the hierarchical model
            max_workers: Number of workers for parallel processing
        """
        self.model_name = model_name
        self.max_workers = max_workers or os.cpu_count()
        
        # Stage 1: Genre classifier
        self.genre_classifier = None
        self.genre_scaler = None
        self.genre_feature_selector = None
        self.genre_variance_selector = None
        self.genre_classes_ = None
        
        # Stage 2: Subgenre classifiers (one per genre)
        self.subgenre_classifiers = {}
        self.subgenre_scalers = {}
        self.subgenre_feature_selectors = {}
        self.subgenre_variance_selectors = {}
        self.subgenre_classes_ = {}
        
        # Genre-subgenre mapping
        self.genre_subgenre_map = {}
        
    def analyze_hierarchical_structure(self, features_df: pd.DataFrame) -> Dict:
        """
        Analyze the hierarchical structure of the dataset.
        
        Args:
            features_df: DataFrame with genre and subgenre columns
            
        Returns:
            Dictionary with hierarchical analysis
        """
        logger.info("🔍 Analyzing hierarchical structure...")
        
        analysis = {
            'total_samples': len(features_df),
            'genres': {},
            'genre_counts': Counter(),
            'subgenre_counts': Counter(),
            'hierarchy_complexity': {}
        }
        
        # Analyze genre-subgenre structure
        for genre in features_df['genre'].unique():
            genre_data = features_df[features_df['genre'] == genre]
            subgenres = genre_data['subgenre'].unique()
            
            analysis['genres'][genre] = {
                'subgenres': list(subgenres),
                'subgenre_count': len(subgenres),
                'sample_count': len(genre_data),
                'samples_per_subgenre': len(genre_data) / len(subgenres)
            }
            
            analysis['genre_counts'][genre] = len(genre_data)
            self.genre_subgenre_map[genre] = list(subgenres)
            
            # Calculate complexity reduction
            analysis['hierarchy_complexity'][genre] = {
                'original_classes': len(features_df['subgenre'].unique()),
                'reduced_classes': len(subgenres),
                'complexity_reduction': len(features_df['subgenre'].unique()) / len(subgenres)
            }
        
        # Log analysis
        logger.info(f"Dataset Structure:")
        logger.info(f"  Total samples: {analysis['total_samples']}")
        logger.info(f"  Genres: {len(analysis['genres'])}")
        logger.info(f"  Total subgenres: {len(features_df['subgenre'].unique())}")
        
        logger.info(f"\nHierarchical Breakdown:")
        for genre, data in analysis['genres'].items():
            logger.info(f"  {genre}: {data['sample_count']} samples, {data['subgenre_count']} subgenres")
            logger.info(f"    Avg per subgenre: {data['samples_per_subgenre']:.1f}")
            complexity = analysis['hierarchy_complexity'][genre]
            logger.info(f"    Complexity reduction: {complexity['original_classes']} → {complexity['reduced_classes']} classes")
        
        return analysis
    
    def select_features(self, X: np.ndarray, y: np.ndarray, stage: str, genre: str = None, max_features: int = None) -> np.ndarray:
        """
        Select optimal features for the given stage and genre.
        
        Args:
            X: Feature matrix
            y: Target labels
            stage: "genre" or "subgenre"
            genre: Genre name (for subgenre stage)
            max_features: Maximum number of features to select
            
        Returns:
            Selected features
        """
        if max_features is None:
            max_features = min(35, X.shape[1] - 5)  # Reserve space for metadata
        
        # Remove constant features first
        variance_selector = VarianceThreshold(threshold=0.0)
        X_var_filtered = variance_selector.fit_transform(X)
        
        # Adjust max_features if needed
        available_features = X_var_filtered.shape[1]
        actual_max_features = min(max_features, available_features)
        
        # Select best features using ANOVA F-test
        feature_selector = SelectKBest(f_classif, k=actual_max_features)
        X_selected = feature_selector.fit_transform(X_var_filtered, y)
        
        # Store selectors
        if stage == "genre":
            self.genre_variance_selector = variance_selector
            self.genre_feature_selector = feature_selector
        else:
            key = f"{genre}_subgenre"
            self.subgenre_variance_selectors[key] = variance_selector
            self.subgenre_feature_selectors[key] = feature_selector
        
        logger.info(f"{stage.title()} feature selection ({genre or 'all'}): {X.shape[1]} → {X_selected.shape[1]} features")
        
        return X_selected
    
    def train_genre_classifier(self, features_df: pd.DataFrame) -> Dict:
        """
        Train Stage 1: Genre classifier.
        
        Args:
            features_df: DataFrame with features and labels
            
        Returns:
            Training results for genre classification
        """
        logger.info("🎵 Stage 1: Training Genre Classifier...")
        
        # Prepare features (exclude metadata columns)
        feature_columns = [col for col in features_df.columns 
                          if col not in ['genre', 'subgenre', 'original_file', 'chunk_start', 
                                       'chunk_end', 'chunk_duration', 'chunk_index', 
                                       'original_duration', 'chunks_needed_per_file', 'overlap_ratio']]
        
        X = features_df[feature_columns].values
        y_genre = features_df['genre'].values
        
        # Encode labels
        genre_encoder = LabelEncoder()
        y_genre_encoded = genre_encoder.fit_transform(y_genre)
        self.genre_classes_ = genre_encoder.classes_
        
        # Feature selection
        X_selected = self.select_features(X, y_genre_encoded, "genre")
        
        # Scale features
        self.genre_scaler = StandardScaler()
        X_scaled = self.genre_scaler.fit_transform(X_selected)
        
        # Configure Random Forest for genre classification
        rf_params = {
            "n_estimators": 150,
            "max_depth": 20,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "max_features": "sqrt",
            "random_state": 42,
            "n_jobs": self.max_workers,
            "bootstrap": True,
            "class_weight": "balanced",
        }
        
        # Create ensemble classifier
        rf_model = RandomForestClassifier(**rf_params)
        et_model = ExtraTreesClassifier(**rf_params)
        
        self.genre_classifier = VotingClassifier(
            estimators=[('rf', rf_model), ('et', et_model)],
            voting='soft'
        )
        
        # Hyperparameter optimization
        param_grid = {
            'rf__n_estimators': [100, 150, 200],
            'rf__max_depth': [15, 20, 25],
            'rf__min_samples_split': [2, 5, 8],
            'rf__min_samples_leaf': [1, 2, 3],
        }
        
        logger.info("Optimizing genre classifier hyperparameters...")
        grid_search = GridSearchCV(
            self.genre_classifier,
            param_grid,
            cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
            scoring='accuracy',
            n_jobs=self.max_workers,
            verbose=1
        )
        
        grid_search.fit(X_scaled, y_genre_encoded)
        self.genre_classifier = grid_search.best_estimator_
        
        # Cross-validation
        cv_scores = cross_val_score(
            self.genre_classifier,
            X_scaled,
            y_genre_encoded,
            cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
            scoring='accuracy',
            n_jobs=self.max_workers
        )
        
        # Training accuracy
        train_pred = self.genre_classifier.predict(X_scaled)
        train_accuracy = accuracy_score(y_genre_encoded, train_pred)
        
        results = {
            'stage': 'genre',
            'classes': len(self.genre_classes_),
            'samples': len(X_scaled),
            'features': X_scaled.shape[1],
            'train_accuracy': train_accuracy,
            'cv_accuracy_mean': cv_scores.mean(),
            'cv_accuracy_std': cv_scores.std(),
            'best_params': grid_search.best_params_
        }
        
        logger.info(f"Genre Classifier Results:")
        logger.info(f"  Classes: {results['classes']}")
        logger.info(f"  Training accuracy: {results['train_accuracy']:.4f}")
        logger.info(f"  CV accuracy: {results['cv_accuracy_mean']:.4f} ± {results['cv_accuracy_std']:.4f}")
        
        return results
    
    def train_subgenre_classifiers(self, features_df: pd.DataFrame) -> Dict:
        """
        Train Stage 2: Subgenre classifiers for each genre.
        
        Args:
            features_df: DataFrame with features and labels
            
        Returns:
            Training results for subgenre classification
        """
        logger.info("🎵 Stage 2: Training Subgenre Classifiers...")
        
        # Prepare features
        feature_columns = [col for col in features_df.columns 
                          if col not in ['genre', 'subgenre', 'original_file', 'chunk_start', 
                                       'chunk_end', 'chunk_duration', 'chunk_index', 
                                       'original_duration', 'chunks_needed_per_file', 'overlap_ratio']]
        
        subgenre_results = {}
        
        for genre in features_df['genre'].unique():
            logger.info(f"\n  Training subgenre classifier for: {genre}")
            
            # Filter data for this genre
            genre_data = features_df[features_df['genre'] == genre]
            X_genre = genre_data[feature_columns].values
            y_subgenre = genre_data['subgenre'].values
            
            if len(np.unique(y_subgenre)) < 2:
                logger.warning(f"Skipping {genre}: insufficient subgenres ({len(np.unique(y_subgenre))})")
                continue
            
            # Encode labels
            subgenre_encoder = LabelEncoder()
            y_subgenre_encoded = subgenre_encoder.fit_transform(y_subgenre)
            self.subgenre_classes_[genre] = subgenre_encoder.classes_
            
            # Feature selection
            X_selected = self.select_features(X_genre, y_subgenre_encoded, "subgenre", genre)
            
            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X_selected)
            self.subgenre_scalers[genre] = scaler
            
            # Configure specialized Random Forest for this genre
            rf_params = {
                "n_estimators": 200,
                "max_depth": 15,
                "min_samples_split": 10,
                "min_samples_leaf": 5,
                "max_features": "log2",
                "random_state": 42,
                "n_jobs": self.max_workers,
                "bootstrap": True,
                "class_weight": "balanced_subsample",
            }
            
            # Create ensemble classifier
            rf_model = RandomForestClassifier(**rf_params)
            et_model = ExtraTreesClassifier(**rf_params)
            
            classifier = VotingClassifier(
                estimators=[('rf', rf_model), ('et', et_model)],
                voting='soft'
            )
            
            # Hyperparameter optimization (simplified for subgenres)
            param_grid = {
                'rf__n_estimators': [150, 200, 250],
                'rf__max_depth': [10, 15, 20],
                'rf__min_samples_split': [5, 10, 15],
            }
            
            try:
                grid_search = GridSearchCV(
                    classifier,
                    param_grid,
                    cv=min(3, len(np.unique(y_subgenre_encoded))),  # Adjust CV folds
                    scoring='accuracy',
                    n_jobs=self.max_workers
                )
                
                grid_search.fit(X_scaled, y_subgenre_encoded)
                self.subgenre_classifiers[genre] = grid_search.best_estimator_
                
                # Cross-validation
                cv_scores = cross_val_score(
                    self.subgenre_classifiers[genre],
                    X_scaled,
                    y_subgenre_encoded,
                    cv=min(3, len(np.unique(y_subgenre_encoded))),
                    scoring='accuracy',
                    n_jobs=self.max_workers
                )
                
                # Training accuracy
                train_pred = self.subgenre_classifiers[genre].predict(X_scaled)
                train_accuracy = accuracy_score(y_subgenre_encoded, train_pred)
                
                subgenre_results[genre] = {
                    'classes': len(self.subgenre_classes_[genre]),
                    'samples': len(X_scaled),
                    'features': X_scaled.shape[1],
                    'train_accuracy': train_accuracy,
                    'cv_accuracy_mean': cv_scores.mean(),
                    'cv_accuracy_std': cv_scores.std(),
                    'best_params': grid_search.best_params_
                }
                
                logger.info(f"    {genre}: {subgenre_results[genre]['classes']} classes, "
                          f"acc={subgenre_results[genre]['train_accuracy']:.4f}, "
                          f"cv={subgenre_results[genre]['cv_accuracy_mean']:.4f}±{subgenre_results[genre]['cv_accuracy_std']:.4f}")
                
            except Exception as e:
                logger.error(f"Failed to train subgenre classifier for {genre}: {e}")
                continue
        
        return subgenre_results
    
    def predict(self, features: Union[np.ndarray, List]) -> Dict:
        """
        Hierarchical prediction: Genre first, then subgenre.
        
        Args:
            features: Feature vector or list of features
            
        Returns:
            Dictionary with predictions and confidence scores
        """
        if isinstance(features, list):
            features = np.array(features).reshape(1, -1)
        elif features.ndim == 1:
            features = features.reshape(1, -1)
        
        # Stage 1: Genre prediction
        if self.genre_variance_selector:
            features_var = self.genre_variance_selector.transform(features)
        else:
            features_var = features
            
        if self.genre_feature_selector:
            features_selected = self.genre_feature_selector.transform(features_var)
        else:
            features_selected = features_var
            
        features_scaled = self.genre_scaler.transform(features_selected)
        
        genre_proba = self.genre_classifier.predict_proba(features_scaled)[0]
        genre_pred_idx = np.argmax(genre_proba)
        genre_pred = self.genre_classes_[genre_pred_idx]
        genre_confidence = genre_proba[genre_pred_idx]
        
        # Stage 2: Subgenre prediction within predicted genre
        subgenre_pred = None
        subgenre_confidence = 0.0
        
        if genre_pred in self.subgenre_classifiers:
            # Apply feature selection for this genre
            key = f"{genre_pred}_subgenre"
            if key in self.subgenre_variance_selectors:
                features_var_sub = self.subgenre_variance_selectors[key].transform(features)
            else:
                features_var_sub = features
                
            if key in self.subgenre_feature_selectors:
                features_selected_sub = self.subgenre_feature_selectors[key].transform(features_var_sub)
            else:
                features_selected_sub = features_var_sub
                
            features_scaled_sub = self.subgenre_scalers[genre_pred].transform(features_selected_sub)
            
            subgenre_proba = self.subgenre_classifiers[genre_pred].predict_proba(features_scaled_sub)[0]
            subgenre_pred_idx = np.argmax(subgenre_proba)
            subgenre_pred = self.subgenre_classes_[genre_pred][subgenre_pred_idx]
            subgenre_confidence = subgenre_proba[subgenre_pred_idx]
        
        return {
            'genre': genre_pred,
            'genre_confidence': float(genre_confidence),
            'subgenre': subgenre_pred,
            'subgenre_confidence': float(subgenre_confidence),
            'combined_confidence': float(genre_confidence * subgenre_confidence) if subgenre_pred else float(genre_confidence)
        }
    
    def save_model(self, output_path: str):
        """
        Save the complete hierarchical model.
        
        Args:
            output_path: Directory to save the model
        """
        os.makedirs(output_path, exist_ok=True)
    
        model_data = {
            'model_name': self.model_name,
            'genre_classifier': self.genre_classifier,
            'genre_scaler': self.genre_scaler,
            'genre_feature_selector': self.genre_feature_selector,
            'genre_variance_selector': self.genre_variance_selector,
            'genre_classes_': self.genre_classes_,
            'subgenre_classifiers': self.subgenre_classifiers,
            'subgenre_scalers': self.subgenre_scalers,
            'subgenre_feature_selectors': self.subgenre_feature_selectors,
            'subgenre_variance_selectors': self.subgenre_variance_selectors,
            'subgenre_classes_': self.subgenre_classes_,
            'genre_subgenre_map': self.genre_subgenre_map
        }
        
        model_path = os.path.join(output_path, f"{self.model_name}.pkl")
        with open(model_path, 'wb') as f:
            pickle.dump(model_data, f)
        
        logger.info(f"Hierarchical model saved to: {model_path}")
        return model_path
    
    def load_model(self, model_path: str):
        """
        Load the complete hierarchical model.
        
        Args:
            model_path: Path to the saved model file
        """
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)
        
        self.model_name = model_data['model_name']
        self.genre_classifier = model_data['genre_classifier']
        self.genre_scaler = model_data['genre_scaler']
        self.genre_feature_selector = model_data['genre_feature_selector']
        self.genre_variance_selector = model_data['genre_variance_selector']
        self.genre_classes_ = model_data['genre_classes_']
        self.subgenre_classifiers = model_data['subgenre_classifiers']
        self.subgenre_scalers = model_data['subgenre_scalers']
        self.subgenre_feature_selectors = model_data['subgenre_feature_selectors']
        self.subgenre_variance_selectors = model_data['subgenre_variance_selectors']
        self.subgenre_classes_ = model_data['subgenre_classes_']
        self.genre_subgenre_map = model_data['genre_subgenre_map']
        
        logger.info(f"Hierarchical model loaded from: {model_path}")


def train_hierarchical_model(
    features_file: str,
    output_dir: str = "models",
    model_name: str = "hierarchical-v1.0",
    max_workers: int = None
) -> Dict:
    """
    Train complete hierarchical music classification model.
    
    Args:
        features_file: Path to balanced features CSV
        output_dir: Output directory for models
        model_name: Name for the hierarchical model
        max_workers: Number of parallel workers
            
        Returns:
        Training results
    """
    logger.info(f"🎵 Training Hierarchical Music Classification Model")
    logger.info(f"Features: {features_file}")
    logger.info(f"Output: {output_dir}")
    
    start_time = time.time()
    
    # Load balanced features
    if not os.path.exists(features_file):
        raise FileNotFoundError(f"Features file not found: {features_file}")
    
    df = pd.read_csv(features_file)
    logger.info(f"Loaded {len(df)} balanced samples")
    
    # Initialize hierarchical classifier
    classifier = HierarchicalMusicClassifier(
        model_name=model_name,
        max_workers=max_workers
    )
    
    # Analyze hierarchical structure
    structure_analysis = classifier.analyze_hierarchical_structure(df)
    
    # Stage 1: Train genre classifier
    genre_results = classifier.train_genre_classifier(df)
    
    # Stage 2: Train subgenre classifiers
    subgenre_results = classifier.train_subgenre_classifiers(df)
    
    # Save model
    model_path = classifier.save_model(output_dir)
    
    training_time = time.time() - start_time
    
    # Compile results
    results = {
        'model_name': model_name,
        'training_time': training_time,
        'total_samples': len(df),
        'structure_analysis': structure_analysis,
        'genre_results': genre_results,
        'subgenre_results': subgenre_results,
        'model_path': model_path
    }
    
    # Calculate overall performance
    total_genre_accuracy = genre_results['train_accuracy']
    avg_subgenre_accuracy = np.mean([r['train_accuracy'] for r in subgenre_results.values()])
    combined_accuracy = total_genre_accuracy * avg_subgenre_accuracy
    
    logger.info(f"\n🎉 Hierarchical Training Complete!")
    logger.info(f"Training time: {training_time:.1f}s")
    logger.info(f"Genre accuracy: {total_genre_accuracy:.4f}")
    logger.info(f"Avg subgenre accuracy: {avg_subgenre_accuracy:.4f}")
    logger.info(f"Combined accuracy estimate: {combined_accuracy:.4f}")
    logger.info(f"Model saved to: {model_path}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Train hierarchical music classification model")
    parser.add_argument("--features", required=True, help="Path to balanced features CSV")
    parser.add_argument("--output", default="models", help="Output directory")
    parser.add_argument("--model-name", default="hierarchical-v1.0", help="Model name")
    parser.add_argument("--workers", type=int, default=None, help="Number of workers")
    
    args = parser.parse_args()
    
    try:
        results = train_hierarchical_model(
            features_file=args.features,
            output_dir=args.output,
            model_name=args.model_name,
            max_workers=args.workers
        )
        
        print(f"\n✅ Success! Hierarchical model trained and saved.")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise