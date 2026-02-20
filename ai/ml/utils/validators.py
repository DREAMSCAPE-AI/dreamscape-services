"""
Data validation utilities
"""

import pandas as pd
from config.dataset_config import REQUIRED_COLUMNS, SCHEMA
from utils.logger import get_logger

logger = get_logger(__name__)

def validate_required_columns(df: pd.DataFrame) -> bool:
    """
    Validate that all required columns are present and non-null

    Args:
        df: DataFrame to validate

    Returns:
        bool: True if valid

    Raises:
        ValueError: If validation fails
    """
    missing_cols = set(REQUIRED_COLUMNS) - set(df.columns)
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    for col in REQUIRED_COLUMNS:
        null_count = df[col].isnull().sum()
        if null_count > 0:
            raise ValueError(f"Column '{col}' has {null_count} null values (required column)")

    logger.info(f"Required columns validation passed")
    return True

def validate_vector_ranges(df: pd.DataFrame) -> bool:
    """
    Validate that vector values are in [0, 1] range

    Args:
        df: DataFrame to validate

    Returns:
        bool: True if valid
    """
    vector_cols = [c for c in df.columns if c.endswith('_pref') or c.endswith('_level') or c.endswith('_type')]

    for col in vector_cols:
        if col in df.columns:
            out_of_range = ((df[col] < 0) | (df[col] > 1)).sum()
            if out_of_range > 0:
                logger.warning(f"Column '{col}' has {out_of_range} values out of [0,1] range. Clipping...")
                df[col] = df[col].clip(0, 1)

    logger.info("Vector range validation completed")
    return True

def validate_engagement_scores(df: pd.DataFrame) -> bool:
    """
    Validate engagement_score values

    Args:
        df: DataFrame to validate

    Returns:
        bool: True if valid
    """
    if 'engagement_score' in df.columns:
        valid_scores = {-1.0, 0.0, 1.0, 3.0, 5.0}
        invalid = ~df['engagement_score'].isin(valid_scores)
        if invalid.sum() > 0:
            raise ValueError(f"Invalid engagement_score values found: {df[invalid]['engagement_score'].unique()}")

    logger.info("Engagement score validation passed")
    return True

def validate_booking_probability(df: pd.DataFrame) -> bool:
    """
    Validate booking_probability is binary

    Args:
        df: DataFrame to validate

    Returns:
        bool: True if valid
    """
    if 'booking_probability' in df.columns:
        if not df['booking_probability'].isin([0, 1]).all():
            raise ValueError("booking_probability must be 0 or 1")

    logger.info("Booking probability validation passed")
    return True

def validate_dataset(df: pd.DataFrame) -> bool:
    """
    Run all validations

    Args:
        df: DataFrame to validate

    Returns:
        bool: True if all validations pass
    """
    logger.info(f"Validating dataset with {len(df)} rows and {len(df.columns)} columns")

    validate_required_columns(df)
    validate_vector_ranges(df)
    validate_engagement_scores(df)
    validate_booking_probability(df)

    logger.info("Dataset validation completed successfully")
    return True
