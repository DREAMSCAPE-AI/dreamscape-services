"""
Feature engineering: unpack vectors, calculate temporal features
"""

import pandas as pd
import numpy as np
from config.dataset_config import SEASON_MAPPING, VECTOR_DIMENSIONS
from utils.logger import get_logger

logger = get_logger(__name__)

def unpack_8d_vectors(df: pd.DataFrame):
    """
    Unpack user_vector and item_vector into individual columns

    Args:
        df: DataFrame with vector columns

    Returns:
        pd.DataFrame: DataFrame with unpacked vectors
    """
    logger.info("Unpacking 8D vectors")

    # Unpack user_vector
    if 'user_vector' in df.columns:
        user_vectors = df['user_vector'].apply(lambda x: x if isinstance(x, list) else [0]*8)
        user_vector_df = pd.DataFrame(
            user_vectors.tolist(),
            index=df.index,
            columns=[f'user_{dim}' for dim in VECTOR_DIMENSIONS]
        )
        df = pd.concat([df, user_vector_df], axis=1)
        logger.info(f"Unpacked user_vector into {len(user_vector_df.columns)} columns")

    # Unpack item_vector
    if 'item_vector' in df.columns:
        item_vectors = df['item_vector'].apply(lambda x: x if isinstance(x, list) else [0]*8)
        item_vector_df = pd.DataFrame(
            item_vectors.tolist(),
            index=df.index,
            columns=[f'item_{dim}' for dim in VECTOR_DIMENSIONS]
        )
        df = pd.concat([df, item_vector_df], axis=1)
        logger.info(f"Unpacked item_vector into {len(item_vector_df.columns)} columns")

    return df

def calculate_temporal_features(df: pd.DataFrame):
    """
    Calculate temporal features (age, season, days_until_departure, etc.)

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame with temporal features
    """
    logger.info("Calculating temporal features")

    # Calculate user age from dateOfBirth
    if 'dateOfBirth' in df.columns:
        df['dateOfBirth'] = pd.to_datetime(df['dateOfBirth'], errors='coerce')
        df['user_age'] = (pd.Timestamp.now() - df['dateOfBirth']).dt.days // 365
        df['user_age'] = df['user_age'].clip(lower=18, upper=100)  # Sanity check
        logger.info(f"Calculated user_age (range: {df['user_age'].min()}-{df['user_age'].max()})")

    # Calculate timestamp
    if 'createdAt' in df.columns:
        df['timestamp'] = pd.to_datetime(df['createdAt'])

        # Season
        df['season'] = df['timestamp'].dt.month.map(SEASON_MAPPING)

        # Is weekend
        df['is_weekend'] = df['timestamp'].dt.dayofweek.isin([5, 6])

        logger.info(f"Calculated season and is_weekend")

    # Days until departure
    if 'departureDate' in df.columns and 'timestamp' in df.columns:
        df['departureDate'] = pd.to_datetime(df['departureDate'], errors='coerce')
        df['days_until_departure'] = (df['departureDate'] - df['timestamp']).dt.days
        df['days_until_departure'] = df['days_until_departure'].clip(lower=0, upper=365)
        logger.info(f"Calculated days_until_departure")

    # Recency features (days since last search/booking)
    # Note: This requires additional joins with historical data, simplified here
    df['days_since_last_search'] = 0  # Placeholder, calculate if historical data available
    df['days_since_last_booking'] = 0  # Placeholder

    return df

def transform_jsonb_fields(df: pd.DataFrame):
    """
    Transform JSONB fields (budgetRange, travelTypes, etc.)

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame with transformed fields
    """
    logger.info("Transforming JSONB fields")

    # Extract budget min/max from globalBudgetRange
    if 'globalBudgetRange' in df.columns:
        df['budget_min'] = df['globalBudgetRange'].apply(lambda x: x.get('min', 0) if isinstance(x, dict) and x else 0)
        df['budget_max'] = df['globalBudgetRange'].apply(lambda x: x.get('max', 5000) if isinstance(x, dict) and x else 5000)
        logger.info(f"Extracted budget_min and budget_max")

    # Convert travelTypes array to comma-separated string
    if 'travelTypes' in df.columns:
        df['travel_types'] = df['travelTypes'].apply(
            lambda x: ','.join(x) if isinstance(x, list) and x else ''
        )
        logger.info(f"Converted travelTypes to comma-separated string")

    return df

def engineer_features(df: pd.DataFrame):
    """
    Main feature engineering function

    Args:
        df: Merged DataFrame

    Returns:
        pd.DataFrame: DataFrame with engineered features
    """
    logger.info(f"Starting feature engineering on {len(df)} rows")

    df = unpack_8d_vectors(df)
    df = calculate_temporal_features(df)
    df = transform_jsonb_fields(df)

    logger.info(f"Feature engineering completed. Final columns: {len(df.columns)}")

    return df


if __name__ == "__main__":
    import os
    os.makedirs("data/processed", exist_ok=True)

    merged_df = pd.read_parquet("data/processed/merged.parquet")
    featured_df = engineer_features(merged_df)

    output_path = "data/processed/featured.parquet"
    featured_df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved featured dataset: {len(featured_df)} rows to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
