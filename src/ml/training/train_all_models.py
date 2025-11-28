#!/usr/bin/env python3
"""
Train All ML Models Script.
Trains all 3 ML models and saves artifacts to src/ml/models/.
"""
import json
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.ml.training.trainer import ModelTrainer
from src.ml.training.data_generator import TrainingDataGenerator


def train_all_models():
    """Train all ML models and generate evaluation reports."""
    print("=" * 60)
    print("MEAL ASSISTANT ML MODEL TRAINING")
    print(f"Started at: {datetime.now().isoformat()}")
    print("=" * 60)

    # Set up models directory
    models_dir = project_root / "src" / "ml" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # Initialize trainer
    trainer = ModelTrainer(models_dir)

    # Generate training data
    print("\n[1/4] Generating synthetic training data...")
    generator = TrainingDataGenerator(seed=42)
    pattern_logs, weight_entries = generator.generate_training_dataset(days=90, start_weight=250.0)
    print(f"   Generated {len(pattern_logs)} pattern logs")
    print(f"   Generated {len(weight_entries)} weight entries")

    # Train Pattern Recommender
    print("\n[2/4] Training Pattern Recommender (Gradient Boosting)...")
    pattern_results = trainer.train_pattern_recommender(
        pattern_logs=pattern_logs,
        n_synthetic_samples=500,
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    print(f"   Data source: {pattern_results['data_source']}")
    print(f"   Training samples: {pattern_results['samples']}")
    print(f"   Model saved to: {pattern_results['model_path']}")
    print("   Feature Importance:")
    for feature, importance in sorted(
        pattern_results['feature_importance'].items(),
        key=lambda x: x[1],
        reverse=True
    )[:5]:
        print(f"      {feature}: {importance:.4f}")

    # Train Weight Predictor
    print("\n[3/4] Training Weight Predictor (Ridge Regression)...")
    weight_results = trainer.train_weight_predictor(
        weight_entries=weight_entries,
        pattern_logs=pattern_logs,
        target_weight=200.0,
        alpha=1.0,
        random_state=42
    )
    print(f"   Data source: {weight_results['data_source']}")
    print(f"   Weight entries: {weight_results['weight_entries']}")
    print(f"   Pattern logs: {weight_results['pattern_logs']}")
    print(f"   Data quality: {weight_results['data_quality']['status']}")
    print(f"   Model saved to: {weight_results['model_path']}")

    # Train Ingredient Substitution Model
    print("\n[4/4] Initializing Ingredient Substitution Model (Content-Based Filtering)...")
    ingredient_results = trainer.train_ingredient_model()
    print(f"   Total ingredients: {ingredient_results['total_ingredients']}")
    print("   Category breakdown:")
    for category, count in ingredient_results['category_counts'].items():
        print(f"      {category}: {count}")
    print(f"   Model saved to: {ingredient_results['model_path']}")

    # Generate combined evaluation report
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE - EVALUATION SUMMARY")
    print("=" * 60)

    evaluation_report = {
        "training_timestamp": datetime.now().isoformat(),
        "models_trained": 3,
        "pattern_recommender": {
            "algorithm": "Gradient Boosting Classifier",
            "n_estimators": 100,
            "max_depth": 5,
            "learning_rate": 0.1,
            "features": 10,
            "classes": 7,
            "training_samples": pattern_results['samples'],
            "version": pattern_results['version'],
            "feature_importance": pattern_results['feature_importance'],
            "model_file": "pattern_recommender.pkl"
        },
        "weight_predictor": {
            "algorithm": "Ridge Regression with Polynomial Features",
            "alpha": 1.0,
            "degree": 2,
            "features": ["days_since_start", "rolling_avg_weight", "rolling_adherence", "rolling_cal_variance", "weekly_slope"],
            "training_entries": weight_results['weight_entries'],
            "data_quality": weight_results['data_quality'],
            "target_weight_lbs": weight_results['target_weight'],
            "version": weight_results['version'],
            "model_file": "weight_predictor.pkl"
        },
        "ingredient_substitution": {
            "algorithm": "Content-Based Filtering (Cosine Similarity)",
            "total_ingredients": ingredient_results['total_ingredients'],
            "categories": ingredient_results['category_counts'],
            "features": ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "category_encoding"],
            "version": ingredient_results['version'],
            "model_file": "ingredient_substitution.pkl"
        }
    }

    # Save evaluation report
    report_path = models_dir / "evaluation_report.json"
    with open(report_path, "w") as f:
        json.dump(evaluation_report, f, indent=2)

    print(f"\nEvaluation report saved to: {report_path}")

    # Print final summary
    print("\n" + "-" * 60)
    print("MODEL ARTIFACTS CREATED:")
    print("-" * 60)
    for model_file in models_dir.glob("*.pkl"):
        size_kb = model_file.stat().st_size / 1024
        print(f"   {model_file.name}: {size_kb:.1f} KB")

    metadata_path = models_dir / "training_metadata.json"
    if metadata_path.exists():
        print(f"   training_metadata.json: {metadata_path.stat().st_size / 1024:.1f} KB")
    print(f"   evaluation_report.json: {report_path.stat().st_size / 1024:.1f} KB")

    print("\n" + "=" * 60)
    print("ALL MODELS TRAINED SUCCESSFULLY!")
    print("=" * 60)

    return evaluation_report


if __name__ == "__main__":
    train_all_models()
