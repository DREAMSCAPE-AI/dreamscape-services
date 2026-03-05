"""
Quality metrics calculation utilities
"""

import pandas as pd
from typing import Dict
from utils.logger import get_logger

logger = get_logger(__name__)

def calculate_missing_values(df: pd.DataFrame) -> Dict[str, float]:
    """
    Calculate missing value percentages

    Args:
        df: DataFrame

    Returns:
        Dict mapping column name to missing percentage
    """
    missing = df.isnull().sum()
    missing_pct = (missing / len(df) * 100).round(2)
    return missing_pct[missing_pct > 0].to_dict()

def calculate_label_distribution(df: pd.DataFrame) -> Dict:
    """
    Calculate engagement score and booking probability distributions

    Args:
        df: DataFrame

    Returns:
        Dict with label statistics
    """
    stats = {}

    if 'engagement_score' in df.columns:
        engagement_dist = df['engagement_score'].value_counts(normalize=True).to_dict()
        stats['engagement_distribution'] = {str(k): round(v, 4) for k, v in engagement_dist.items()}

    if 'booking_probability' in df.columns:
        booking_rate = df['booking_probability'].mean()
        stats['booking_rate'] = round(booking_rate, 4)

    if 'user_rating' in df.columns:
        avg_rating = df['user_rating'].mean()
        stats['avg_user_rating'] = round(avg_rating, 2) if pd.notna(avg_rating) else None

    return stats

def calculate_feature_stats(df: pd.DataFrame, columns: list = None) -> Dict:
    """
    Calculate basic statistics for numerical features

    Args:
        df: DataFrame
        columns: Columns to analyze (default: all numerical)

    Returns:
        Dict with feature statistics
    """
    if columns is None:
        columns = df.select_dtypes(include=['float32', 'float64', 'int32', 'int64']).columns.tolist()

    stats = {}
    for col in columns:
        if col in df.columns:
            stats[col] = {
                'mean': round(df[col].mean(), 4),
                'std': round(df[col].std(), 4),
                'min': round(df[col].min(), 4),
                'max': round(df[col].max(), 4),
                '25%': round(df[col].quantile(0.25), 4),
                '50%': round(df[col].quantile(0.50), 4),
                '75%': round(df[col].quantile(0.75), 4),
            }

    return stats

def calculate_dataset_metrics(df: pd.DataFrame) -> Dict:
    """
    Calculate comprehensive dataset metrics

    Args:
        df: DataFrame

    Returns:
        Dict with all metrics
    """
    logger.info("Calculating dataset metrics")

    metrics = {
        'row_count': len(df),
        'column_count': len(df.columns),
        'missing_values': calculate_missing_values(df),
        'labels': calculate_label_distribution(df),
        'memory_usage_mb': round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2)
    }

    logger.info(f"Dataset metrics calculated: {metrics['row_count']} rows, {metrics['column_count']} columns")

    return metrics
