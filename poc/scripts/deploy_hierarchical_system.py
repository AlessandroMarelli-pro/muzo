#!/usr/bin/env python3
"""
Hierarchical Music Classification Deployment Script

This script demonstrates how to deploy and use the complete hierarchical system:
1. Genre Classifier (82.38% accuracy) - identifies main genre
2. Subgenre Specialists - focused models for each genre's subgenres

Usage Examples:
  # Train all subgenre specialists
  python deploy_hierarchical_system.py --train-all --dataset "C:/path/to/dataset"
  
  # Train specific genre specialists
  python deploy_hierarchical_system.py --train-specialists --genres Alternative Dance_EDM --dataset "C:/path/to/dataset"
  
  # Deploy complete system for inference
  python deploy_hierarchical_system.py --deploy --genre-model "models/final_optimized_7genres/final_optimized_7genres-v1.0.pth"
  
  # Test hierarchical classification
  python deploy_hierarchical_system.py --test --audio-file "test_song.flac"

Perfect for integration with the Muzo AI service!
"""

import argparse
import logging
import os
import sys
from pathlib import Path
import json
import time

# Add the src directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cnn_model_training_subgenre import (
    SubgenreSpecialistTrainer,
    HierarchicalModelMatrix,
    train_all_subgenre_specialists
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def train_all_specialists(dataset_path: str, output_dir: str = "models/subgenre_specialists", **kwargs):
    """Train subgenre specialists for all genres."""
    logger.info(f"🚀 Starting training of all subgenre specialists")
    logger.info(f"📁 Dataset: {dataset_path}")
    logger.info(f"💾 Output: {output_dir}")
    
    results = train_all_subgenre_specialists(
        dataset_path=dataset_path,
        output_dir=output_dir,
        **kwargs
    )
    
    return results


def train_specific_specialists(
    dataset_path: str, 
    genres: list, 
    output_dir: str = "models/subgenre_specialists", 
    **kwargs
):
    """Train specialists for specific genres only."""
    logger.info(f"🎯 Training specialists for specific genres: {', '.join(genres)}")
    
    results = train_all_subgenre_specialists(
        dataset_path=dataset_path,
        output_dir=output_dir,
        genres_to_train=genres,
        **kwargs
    )
    
    return results


def deploy_hierarchical_system(
    genre_model_path: str,
    specialists_dir: str = "models/subgenre_specialists"
) -> HierarchicalModelMatrix:
    """Deploy the complete hierarchical classification system."""
    logger.info(f"🏗️ Deploying hierarchical classification system")
    logger.info(f"🎯 Genre model: {genre_model_path}")
    logger.info(f"🎵 Specialists directory: {specialists_dir}")
    
    # Initialize the hierarchical system
    system = HierarchicalModelMatrix(
        genre_model_path=genre_model_path,
        specialists_dir=specialists_dir
    )
    
    # Load all components
    system.load_complete_system()
    
    # Get system info
    info = system.get_system_info()
    
    logger.info(f"✅ System deployed successfully!")
    logger.info(f"🎯 Genre classifier: {info['coverage']['total_genres']} genres")
    logger.info(f"🎵 Subgenre specialists: {info['coverage']['specialists_available']} loaded")
    logger.info(f"📊 Coverage: {info['coverage']['coverage_percentage']:.1f}%")
    
    # Show detailed coverage
    logger.info(f"\n📋 Detailed System Coverage:")
    for genre in info['genre_classifier']['genres']:
        if genre in info['subgenre_specialists']:
            specialist_info = info['subgenre_specialists'][genre]
            logger.info(f"  ✅ {genre}: {specialist_info['num_subgenres']} subgenres")
        else:
            logger.info(f"  ❌ {genre}: No specialist available")
    
    return system


def test_hierarchical_classification(system: HierarchicalModelMatrix, audio_file: str):
    """Test the hierarchical system on a single audio file."""
    logger.info(f"🧪 Testing hierarchical classification")
    logger.info(f"🎵 Audio file: {audio_file}")
    
    if not os.path.exists(audio_file):
        logger.error(f"Audio file not found: {audio_file}")
        return None
    
    start_time = time.time()
    result = system.predict_hierarchical(audio_file)
    prediction_time = time.time() - start_time
    
    # Extract results
    hierarchical = result['hierarchical_prediction']
    
    logger.info(f"🎉 Hierarchical Classification Results:")
    logger.info(f"  🎯 Genre: {hierarchical['genre']} ({hierarchical['genre_confidence']:.2%})")
    logger.info(f"  🎵 Subgenre: {hierarchical['subgenre']} ({hierarchical['subgenre_confidence']:.2%})")
    logger.info(f"  🎪 Combined Confidence: {hierarchical['combined_confidence']:.2%}")
    logger.info(f"  ⏱️ Prediction Time: {prediction_time:.2f}s")
    
    return result


def create_deployment_config(
    genre_model_path: str,
    specialists_dir: str,
    output_path: str = "deployment_config.json"
):
    """Create a deployment configuration file for the AI service."""
    config = {
        "hierarchical_music_classification": {
            "version": "1.0",
            "description": "Hierarchical CNN-based music genre and subgenre classification",
            "architecture": "Genre Classifier → Subgenre Specialists",
            "performance": {
                "genre_accuracy": "82.38%",
                "deployment_ready": True
            },
            "models": {
                "genre_classifier": {
                    "path": genre_model_path,
                    "type": "CNN/Hybrid",
                    "input": "mel-spectrogram",
                    "output": "genre_probabilities"
                },
                "subgenre_specialists": {
                    "directory": specialists_dir,
                    "type": "per-genre CNN specialists",
                    "input": "mel-spectrogram",
                    "output": "subgenre_probabilities"
                }
            },
            "usage": {
                "step1": "Use genre classifier to predict main genre",
                "step2": "Use corresponding specialist to predict subgenre",
                "step3": "Combine confidences for final result"
            },
            "integration": {
                "ai_service_compatible": True,
                "real_time_ready": True,
                "batch_processing_ready": True
            }
        }
    }
    
    with open(output_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    logger.info(f"📄 Deployment config created: {output_path}")
    return config


def main():
    parser = argparse.ArgumentParser(
        description="Deploy Hierarchical Music Classification System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Train all subgenre specialists
  python deploy_hierarchical_system.py --train-all --dataset "C:/path/to/dataset"
  
  # Train specific genres only
  python deploy_hierarchical_system.py --train-specialists --genres Alternative Dance_EDM --dataset "C:/path/to/dataset"
  
  # Deploy system for inference
  python deploy_hierarchical_system.py --deploy --genre-model "models/final_optimized_7genres/final_optimized_7genres-v1.0.pth"
  
  # Test on audio file
  python deploy_hierarchical_system.py --test --audio-file "test_song.flac" --genre-model "models/genre_model.pth"
        """
    )
    
    # Mode selection
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--train-all", action="store_true", help="Train all subgenre specialists")
    mode_group.add_argument("--train-specialists", action="store_true", help="Train specific genre specialists")
    mode_group.add_argument("--deploy", action="store_true", help="Deploy hierarchical system")
    mode_group.add_argument("--test", action="store_true", help="Test hierarchical classification")
    mode_group.add_argument("--create-config", action="store_true", help="Create deployment configuration")
    
    # Training arguments
    parser.add_argument("--dataset", help="Path to hierarchical music dataset")
    parser.add_argument("--genres", nargs="+", help="Specific genres to train")
    parser.add_argument("--output", default="models/subgenre_specialists", help="Output directory")
    parser.add_argument("--target-samples", type=int, default=500, help="Target samples per subgenre")
    parser.add_argument("--segment-duration", type=float, default=30.0, help="Segment duration")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--architecture", choices=["cnn", "hybrid"], default="hybrid", help="Architecture")
    
    # Deployment arguments
    parser.add_argument("--genre-model", help="Path to trained genre classifier")
    parser.add_argument("--specialists-dir", default="models/subgenre_specialists", help="Specialists directory")
    
    # Testing arguments
    parser.add_argument("--audio-file", help="Audio file to test")
    
    args = parser.parse_args()
    
    try:
        if args.train_all:
            if not args.dataset:
                parser.error("--dataset is required for training")
            
            logger.info("🚀 TRAINING ALL SUBGENRE SPECIALISTS")
            results = train_all_specialists(
                dataset_path=args.dataset,
                output_dir=args.output,
                target_samples_per_subgenre=args.target_samples,
                segment_duration=args.segment_duration,
                num_epochs=args.epochs,
                learning_rate=args.lr,
                batch_size=args.batch_size,
                architecture=args.architecture
            )
            
            successful = results['training_summary']['successful_training']
            total = results['training_summary']['total_genres']
            
            print(f"\n🎉 ALL SPECIALISTS TRAINING COMPLETE!")
            print(f"✅ Success: {successful}/{total} specialists trained")
            print(f"⏱️ Total time: {results['training_summary']['total_time']/60:.1f} minutes")
            
        elif args.train_specialists:
            if not args.dataset or not args.genres:
                parser.error("--dataset and --genres are required for specific training")
            
            logger.info(f"🎯 TRAINING SPECIFIC SPECIALISTS: {', '.join(args.genres)}")
            results = train_specific_specialists(
                dataset_path=args.dataset,
                genres=args.genres,
                output_dir=args.output,
                target_samples_per_subgenre=args.target_samples,
                segment_duration=args.segment_duration,
                num_epochs=args.epochs,
                learning_rate=args.lr,
                batch_size=args.batch_size,
                architecture=args.architecture
            )
            
            successful = results['training_summary']['successful_training']
            total = len(args.genres)
            
            print(f"\n🎉 SPECIFIC SPECIALISTS TRAINING COMPLETE!")
            print(f"✅ Success: {successful}/{total} specialists trained")
            
        elif args.deploy:
            if not args.genre_model:
                parser.error("--genre-model is required for deployment")
            
            logger.info("🏗️ DEPLOYING HIERARCHICAL SYSTEM")
            system = deploy_hierarchical_system(
                genre_model_path=args.genre_model,
                specialists_dir=args.specialists_dir
            )
            
            print(f"\n🎉 HIERARCHICAL SYSTEM DEPLOYED!")
            print(f"🎯 Ready for production use with AI service")
            
            # Create deployment config
            create_deployment_config(
                genre_model_path=args.genre_model,
                specialists_dir=args.specialists_dir
            )
            
        elif args.test:
            if not args.genre_model or not args.audio_file:
                parser.error("--genre-model and --audio-file are required for testing")
            
            logger.info("🧪 TESTING HIERARCHICAL CLASSIFICATION")
            
            # Deploy system first
            system = deploy_hierarchical_system(
                genre_model_path=args.genre_model,
                specialists_dir=args.specialists_dir
            )
            
            # Test classification
            result = test_hierarchical_classification(system, args.audio_file)
            
            if result:
                print(f"\n🎉 CLASSIFICATION COMPLETE!")
                hierarchical = result['hierarchical_prediction']
                print(f"🎵 Result: {hierarchical['genre']} → {hierarchical['subgenre']}")
                print(f"🎪 Confidence: {hierarchical['combined_confidence']:.2%}")
            
        elif args.create_config:
            if not args.genre_model:
                parser.error("--genre-model is required for config creation")
            
            logger.info("📄 CREATING DEPLOYMENT CONFIGURATION")
            config = create_deployment_config(
                genre_model_path=args.genre_model,
                specialists_dir=args.specialists_dir
            )
            
            print(f"\n📄 DEPLOYMENT CONFIG CREATED!")
            print(f"🔧 Ready for AI service integration")
            
    except KeyboardInterrupt:
        logger.info("⚠️ Operation cancelled by user")
    except Exception as e:
        logger.error(f"❌ Operation failed: {str(e)}")
        raise


if __name__ == "__main__":
    main()
