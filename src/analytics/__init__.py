"""
Analytics package for Meal Assistant.
Contains pattern effectiveness analysis, insights generation, and dashboards.
"""
from .pattern_effectiveness import PatternEffectivenessAnalyzer
from .insights import InsightsGenerator

__all__ = [
    "PatternEffectivenessAnalyzer",
    "InsightsGenerator",
]
