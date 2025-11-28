"""
Configuration settings for the Meal Assistant ML system.
"""
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class MLSettings:
    """ML model settings."""
    models_dir: Path = Path(__file__).parent.parent / "models"
    pattern_recommender_model: str = "pattern_recommender.pkl"
    weight_predictor_model: str = "weight_predictor.pkl"
    ingredient_model: str = "ingredient_substitution.pkl"

    # Training settings
    min_training_samples: int = 30
    synthetic_samples: int = 500

    # Prediction settings
    min_weight_entries: int = 7
    reliable_weight_entries: int = 20
    default_forecast_days: int = 30


@dataclass
class UserSettings:
    """User-specific settings (Brandon's profile)."""
    target_calories: int = 1900  # 1800-2000 range
    target_protein_g: int = 137  # 130-145 range
    target_weight_lbs: float = 200.0
    starting_weight_lbs: float = 250.0
    height_inches: int = 70  # 5'10"
    age: int = 37


@dataclass
class APISettings:
    """API settings."""
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    cors_origins: list = None

    def __post_init__(self):
        if self.cors_origins is None:
            self.cors_origins = ["*"]


@dataclass
class Settings:
    """Main settings container."""
    ml: MLSettings = None
    user: UserSettings = None
    api: APISettings = None

    def __post_init__(self):
        if self.ml is None:
            self.ml = MLSettings()
        if self.user is None:
            self.user = UserSettings()
        if self.api is None:
            self.api = APISettings()


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the global settings instance."""
    return settings
