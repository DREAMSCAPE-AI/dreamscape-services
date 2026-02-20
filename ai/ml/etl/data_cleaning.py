"""
Data cleaning: remove outliers, handle missing values, remove duplicates
"""

import pandas as pd
import numpy as np
from utils.logger import get_logger

logger = get_logger(__name__)

def remove_missing_required(df: pd.DataFrame):
    """
    Remove rows with missing values in critical columns

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: Cleaned DataFrame
    """
    logger.info("Removing rows with missing critical features")

    required_cols = [
        'user_id', 'user_climate_pref', 'recommendation_score', 'engagement_score'
    ]

    initial_count = len(df)

    for col in required_cols:
        if col in df.columns:
            before = len(df)
            df = df.dropna(subset=[col])
            removed = before - len(df)
            if removed > 0:
                logger.warning(f"Removed {removed} rows with missing '{col}'")

    logger.info(f"Rows after removing missing: {len(df)} (removed {initial_count - len(df)})")

    return df

def impute_missing_values(df: pd.DataFrame):
    """
    Impute missing values with median (numerical) or mode (categorical)

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: Imputed DataFrame
    """
    logger.info("Imputing missing values")

    # Numerical columns: fill with median
    num_cols = df.select_dtypes(include=['float32', 'float64', 'int32', 'int64']).columns
    for col in num_cols:
        missing_count = df[col].isna().sum()
        if missing_count > 0:
            median_val = df[col].median()
            df[col].fillna(median_val, inplace=True)
            logger.info(f"Imputed {missing_count} missing values in '{col}' with median {median_val:.2f}")

    # Categorical columns: fill with "UNKNOWN"
    cat_cols = df.select_dtypes(include=['object']).columns
    for col in cat_cols:
        missing_count = df[col].isna().sum()
        if missing_count > 0:
            df[col].fillna("UNKNOWN", inplace=True)
            logger.info(f"Imputed {missing_count} missing values in '{col}' with 'UNKNOWN'")

    return df

def remove_outliers(df: pd.DataFrame):
    """
    Remove outliers using 3-sigma rule for key numerical features

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame without outliers
    """
    logger.info("Removing outliers (3-sigma rule)")

    initial_count = len(df)

    outlier_cols = ['budget_max', 'user_age', 'item_booking_count']

    for col in outlier_cols:
        if col in df.columns:
            mean = df[col].mean()
            std = df[col].std()

            if std > 0:
                lower_bound = mean - 3 * std
                upper_bound = mean + 3 * std

                before = len(df)
                df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
                removed = before - len(df)

                if removed > 0:
                    logger.info(f"Removed {removed} outliers from '{col}' (bounds: {lower_bound:.2f} - {upper_bound:.2f})")

    logger.info(f"Rows after outlier removal: {len(df)} (removed {initial_count - len(df)})")

    return df

def validate_vector_ranges(df: pd.DataFrame):
    """
    Clip vector values to [0, 1] range

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: Validated DataFrame
    """
    logger.info("Validating and clipping vector ranges to [0, 1]")

    vector_cols = [c for c in df.columns if '_pref' in c or '_level' in c or c.startswith('user_') or c.startswith('item_')]

    for col in vector_cols:
        if col in df.columns and df[col].dtype in ['float32', 'float64']:
            out_of_range = ((df[col] < 0) | (df[col] > 1)).sum()
            if out_of_range > 0:
                logger.warning(f"Clipping {out_of_range} out-of-range values in '{col}'")
                df[col] = df[col].clip(0, 1)

    return df

def remove_duplicates(df: pd.DataFrame):
    """
    Remove duplicate rows

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: Deduplicated DataFrame
    """
    logger.info("Removing duplicate rows")

    initial_count = len(df)

    # Remove duplicates based on user_id and recommendation_id
    if 'user_id' in df.columns and 'recommendation_id' in df.columns:
        df = df.drop_duplicates(subset=['user_id', 'recommendation_id'])

    removed = initial_count - len(df)
    if removed > 0:
        logger.warning(f"Removed {removed} duplicate rows")

    return df

def clean_dataset(df: pd.DataFrame):
    """
    Main data cleaning function

    Args:
        df: Balanced DataFrame

    Returns:
        pd.DataFrame: Cleaned DataFrame
    """
    logger.info(f"Starting data cleaning on {len(df)} rows")

    df = remove_missing_required(df)
    df = impute_missing_values(df)
    df = remove_outliers(df)
    df = validate_vector_ranges(df)
    df = remove_duplicates(df)

    logger.info(f"Data cleaning completed. Final rows: {len(df)}")

    return df


if __name__ == "__main__":
    import os
    os.makedirs("data/processed", exist_ok=True)

    balanced_df = pd.read_parquet("data/processed/balanced.parquet")
    cleaned_df = clean_dataset(balanced_df)

    output_path = "data/processed/cleaned.parquet"
    cleaned_df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved cleaned dataset: {len(cleaned_df)} rows to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
