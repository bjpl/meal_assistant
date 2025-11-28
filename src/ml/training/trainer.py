"""
Model Trainer.
Handles training workflow for all ML models.
"""
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import json

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.data.models import PatternLog, WeightEntry, PatternType
from src.ml.models.pattern_recommender import PatternRecommender
from src.ml.models.weight_predictor import WeightPredictor
from src.ml.models.ingredient_substitution import IngredientSubstitutionModel
from src.ml.training.data_generator import TrainingDataGenerator


class ModelTrainer:
    """
    Orchestrates training for all ML models.

    Handles:
    - Data preparation
    - Model training
    - Evaluation
    - Model persistence
    - Training metadata tracking
    """

    def __init__(self, models_dir: Path):
        """
        Initialize trainer.

        Args:
            models_dir: Directory to save trained models
        """
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)

        self.pattern_recommender: Optional[PatternRecommender] = None
        self.weight_predictor: Optional[WeightPredictor] = None
        self.ingredient_model: Optional[IngredientSubstitutionModel] = None

        self.training_metadata: Dict[str, Any] = {}

    def train_pattern_recommender(
        self,
        pattern_logs: Optional[List[PatternLog]] = None,
        n_synthetic_samples: int = 500,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Train the pattern recommender model.

        Args:
            pattern_logs: Historical pattern logs (optional, generates synthetic if None)
            n_synthetic_samples: Number of synthetic samples to generate
            **kwargs: Model hyperparameters

        Returns:
            Training results and metrics
        """
        generator = TrainingDataGenerator()

        if pattern_logs and len(pattern_logs) >= 30:
            # Use real data
            X = []
            y = []

            for i, log in enumerate(pattern_logs):
                if log.adherence_score >= 0.75:  # Successful days
                    prev_log = pattern_logs[i-1] if i > 0 else None

                    X.append({
                        "date": log.date,
                        "day_type": log.context.day_type.value if log.context else "weekday",
                        "weather": log.context.weather.value if log.context else "sunny",
                        "stress_level": log.context.stress_level.value if log.context else 2,
                        "activity_level": log.context.activity_level.value if log.context else "moderate",
                        "has_morning_workout": log.context.has_morning_workout if log.context else False,
                        "has_evening_social": log.context.has_evening_social if log.context else False,
                        "prev_pattern": (prev_log.pattern_actual or prev_log.pattern_planned).value if prev_log else "traditional",
                        "prev_adherence": prev_log.adherence_score if prev_log else 0.8,
                        "prev_energy": prev_log.energy_rating if prev_log and prev_log.energy_rating else 3,
                    })
                    y.append(log.pattern_actual or log.pattern_planned)

            data_source = "real"
        else:
            # Generate synthetic data
            X, y = generator.generate_pattern_recommender_data(n_synthetic_samples)
            data_source = "synthetic"

        # Train model
        self.pattern_recommender = PatternRecommender()
        self.pattern_recommender.fit(X, y, **kwargs)

        # Save model
        model_path = self.models_dir / "pattern_recommender.pkl"
        self.pattern_recommender.save(model_path)

        # Get feature importance
        importance = self.pattern_recommender.get_feature_importance()

        results = {
            "model": "pattern_recommender",
            "data_source": data_source,
            "samples": len(X),
            "feature_importance": importance,
            "model_path": str(model_path),
            "trained_at": datetime.now().isoformat(),
            "version": PatternRecommender.MODEL_VERSION,
        }

        self.training_metadata["pattern_recommender"] = results
        self._save_metadata()

        return results

    def train_weight_predictor(
        self,
        weight_entries: Optional[List[WeightEntry]] = None,
        pattern_logs: Optional[List[PatternLog]] = None,
        target_weight: float = 200.0,
        days: int = 90,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Train the weight predictor model.

        Args:
            weight_entries: Historical weight entries
            pattern_logs: Historical pattern logs
            target_weight: Target weight for predictions
            days: Days of synthetic data to generate if needed
            **kwargs: Model hyperparameters

        Returns:
            Training results and metrics
        """
        generator = TrainingDataGenerator()

        if weight_entries and len(weight_entries) >= 14:
            # Use real data
            if not pattern_logs:
                pattern_logs = []
            data_source = "real"
        else:
            # Generate synthetic data
            pattern_logs, weight_entries = generator.generate_training_dataset(days)
            data_source = "synthetic"

        # Train model
        self.weight_predictor = WeightPredictor(target_weight=target_weight)
        self.weight_predictor.fit(weight_entries, pattern_logs, **kwargs)

        # Save model
        model_path = self.models_dir / "weight_predictor.pkl"
        self.weight_predictor.save(model_path)

        # Get data quality assessment
        quality = self.weight_predictor.get_data_quality_status(weight_entries)

        results = {
            "model": "weight_predictor",
            "data_source": data_source,
            "weight_entries": len(weight_entries),
            "pattern_logs": len(pattern_logs),
            "data_quality": quality,
            "target_weight": target_weight,
            "model_path": str(model_path),
            "trained_at": datetime.now().isoformat(),
            "version": WeightPredictor.MODEL_VERSION,
        }

        self.training_metadata["weight_predictor"] = results
        self._save_metadata()

        return results

    def train_ingredient_model(
        self,
        additional_ingredients: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Initialize/update the ingredient substitution model.

        Args:
            additional_ingredients: Extra ingredients to add to database

        Returns:
            Training results and metrics
        """
        self.ingredient_model = IngredientSubstitutionModel()

        # Add any additional ingredients
        if additional_ingredients:
            from src.data.models import MealComponent, NutritionInfo
            for ing_data in additional_ingredients:
                ingredient = MealComponent(
                    name=ing_data["name"],
                    category=ing_data["category"],
                    nutrition=NutritionInfo(
                        calories=ing_data.get("calories", 0),
                        protein_g=ing_data.get("protein_g", 0),
                        carbs_g=ing_data.get("carbs_g", 0),
                        fat_g=ing_data.get("fat_g", 0),
                        fiber_g=ing_data.get("fiber_g", 0),
                    ),
                    portion_size=ing_data.get("portion_size", ""),
                    tags=ing_data.get("tags", []),
                )
                self.ingredient_model.add_ingredient(ingredient)

        # Save model
        model_path = self.models_dir / "ingredient_substitution.pkl"
        self.ingredient_model.save(model_path)

        # Get category counts
        category_counts = {
            cat: len(self.ingredient_model.get_ingredients_by_category(cat))
            for cat in self.ingredient_model.get_categories()
        }

        results = {
            "model": "ingredient_substitution",
            "total_ingredients": len(self.ingredient_model.ingredients),
            "category_counts": category_counts,
            "model_path": str(model_path),
            "trained_at": datetime.now().isoformat(),
            "version": IngredientSubstitutionModel.MODEL_VERSION,
        }

        self.training_metadata["ingredient_substitution"] = results
        self._save_metadata()

        return results

    def train_all(
        self,
        pattern_logs: Optional[List[PatternLog]] = None,
        weight_entries: Optional[List[WeightEntry]] = None,
        target_weight: float = 200.0,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Train all models.

        Returns:
            Combined training results
        """
        results = {}

        results["pattern_recommender"] = self.train_pattern_recommender(
            pattern_logs=pattern_logs,
            **kwargs.get("pattern_recommender", {})
        )

        results["weight_predictor"] = self.train_weight_predictor(
            weight_entries=weight_entries,
            pattern_logs=pattern_logs,
            target_weight=target_weight,
            **kwargs.get("weight_predictor", {})
        )

        results["ingredient_substitution"] = self.train_ingredient_model(
            **kwargs.get("ingredient_model", {})
        )

        return results

    def load_models(self) -> Dict[str, bool]:
        """
        Load all trained models from disk.

        Returns:
            Dict indicating which models were loaded successfully
        """
        loaded = {}

        # Pattern recommender
        path = self.models_dir / "pattern_recommender.pkl"
        if path.exists():
            self.pattern_recommender = PatternRecommender(model_path=path)
            loaded["pattern_recommender"] = True
        else:
            loaded["pattern_recommender"] = False

        # Weight predictor
        path = self.models_dir / "weight_predictor.pkl"
        if path.exists():
            self.weight_predictor = WeightPredictor(model_path=path)
            loaded["weight_predictor"] = True
        else:
            loaded["weight_predictor"] = False

        # Ingredient model
        path = self.models_dir / "ingredient_substitution.pkl"
        if path.exists():
            self.ingredient_model = IngredientSubstitutionModel(model_path=path)
            loaded["ingredient_substitution"] = True
        else:
            loaded["ingredient_substitution"] = False

        return loaded

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models."""
        info = {}

        if self.pattern_recommender:
            info["pattern_recommender"] = {
                "version": PatternRecommender.MODEL_VERSION,
                "is_fitted": self.pattern_recommender.is_fitted,
                "feature_importance": self.pattern_recommender.get_feature_importance(),
            }

        if self.weight_predictor:
            info["weight_predictor"] = {
                "version": WeightPredictor.MODEL_VERSION,
                "is_fitted": self.weight_predictor.is_fitted,
                "target_weight": self.weight_predictor.target_weight,
            }

        if self.ingredient_model:
            info["ingredient_substitution"] = {
                "version": IngredientSubstitutionModel.MODEL_VERSION,
                "total_ingredients": len(self.ingredient_model.ingredients),
                "categories": self.ingredient_model.get_categories(),
            }

        return info

    def _save_metadata(self) -> None:
        """Save training metadata to disk."""
        metadata_path = self.models_dir / "training_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(self.training_metadata, f, indent=2, default=str)

    def _load_metadata(self) -> None:
        """Load training metadata from disk."""
        metadata_path = self.models_dir / "training_metadata.json"
        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                self.training_metadata = json.load(f)
