"""
GDPR anonymization: hash userId, remove PII, generalize data
"""

import pandas as pd
import hashlib
from config.dataset_config import COUNTRY_TO_REGION, AGE_BINS, AGE_LABELS
from utils.logger import get_logger

logger = get_logger(__name__)

def hash_user_ids(df: pd.DataFrame):
    """
    Hash userId with SHA256 for anonymization

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame with hashed user IDs
    """
    logger.info("Hashing user IDs with SHA256")

    if 'user_id' in df.columns:
        df['user_hash'] = df['user_id'].apply(
            lambda x: hashlib.sha256(str(x).encode()).hexdigest()
        )
        logger.info(f"Hashed {len(df)} user IDs")

    return df

def remove_pii(df: pd.DataFrame):
    """
    Remove personally identifiable information

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame without PII
    """
    logger.info("Removing PII columns")

    pii_cols = [
        'user_id', 'email', 'firstName', 'lastName', 'phoneNumber', 'phone',
        'dateOfBirth', 'avatar', 'recommendation_id'
    ]

    columns_to_drop = [col for col in pii_cols if col in df.columns]

    if columns_to_drop:
        df = df.drop(columns=columns_to_drop)
        logger.info(f"Removed PII columns: {columns_to_drop}")

    return df

def generalize_nationality(df: pd.DataFrame):
    """
    Generalize nationality to region for privacy

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame with generalized nationality
    """
    logger.info("Generalizing nationality to regions")

    if 'user_nationality' in df.columns:
        df['user_region'] = df['user_nationality'].map(COUNTRY_TO_REGION).fillna('Other')

        region_dist = df['user_region'].value_counts()
        logger.info(f"Region distribution:\n{region_dist}")

        # Drop original nationality column
        df = df.drop(columns=['user_nationality'])

    return df

def bin_age(df: pd.DataFrame):
    """
    Bin age into groups instead of exact values

    Args:
        df: DataFrame

    Returns:
        pd.DataFrame: DataFrame with age groups
    """
    logger.info("Binning age into groups")

    if 'user_age' in df.columns:
        df['user_age_group'] = pd.cut(
            df['user_age'],
            bins=AGE_BINS,
            labels=AGE_LABELS,
            include_lowest=True
        )

        age_group_dist = df['user_age_group'].value_counts()
        logger.info(f"Age group distribution:\n{age_group_dist}")

        # Drop exact age column
        df = df.drop(columns=['user_age'])

    return df

def remove_rare_categories(df: pd.DataFrame, threshold=10):
    """
    Replace rare categorical values with "OTHER" for privacy

    Args:
        df: DataFrame
        threshold: Minimum count to keep category

    Returns:
        pd.DataFrame: DataFrame with generalized categories
    """
    logger.info(f"Removing rare categories (threshold: {threshold})")

    cat_cols = df.select_dtypes(include=['object']).columns

    for col in cat_cols:
        value_counts = df[col].value_counts()
        rare_values = value_counts[value_counts < threshold].index.tolist()

        if rare_values:
            df[col] = df[col].apply(lambda x: 'OTHER' if x in rare_values else x)
            logger.info(f"Generalized {len(rare_values)} rare values in '{col}'")

    return df

def anonymize_dataset(df: pd.DataFrame):
    """
    Main GDPR anonymization function

    Args:
        df: Cleaned DataFrame

    Returns:
        pd.DataFrame: Anonymized DataFrame
    """
    logger.info(f"Starting GDPR anonymization on {len(df)} rows")

    df = hash_user_ids(df)
    df = generalize_nationality(df)
    df = bin_age(df)
    df = remove_rare_categories(df, threshold=10)
    df = remove_pii(df)  # Remove PII last after using for hashing

    logger.info(f"GDPR anonymization completed. Columns: {len(df.columns)}")

    return df


if __name__ == "__main__":
    import os
    os.makedirs("data/processed", exist_ok=True)

    cleaned_df = pd.read_parquet("data/processed/cleaned.parquet")
    final_df = anonymize_dataset(cleaned_df)

    output_path = "data/processed/final.parquet"
    final_df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved anonymized dataset: {len(final_df)} rows to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
