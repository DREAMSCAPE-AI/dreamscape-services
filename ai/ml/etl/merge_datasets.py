"""
Merge extracted datasets (users + recommendations + searches)
"""

import pandas as pd
from utils.logger import get_logger

logger = get_logger(__name__)

def merge_datasets(
    users_path="data/raw/users.parquet",
    recommendations_path="data/raw/recommendations.parquet",
    searches_path="data/raw/searches.parquet"
):
    """
    Merge user, recommendation, and search data

    Args:
        users_path: Path to users parquet
        recommendations_path: Path to recommendations parquet
        searches_path: Path to searches parquet

    Returns:
        pd.DataFrame: Merged dataset
    """
    logger.info("Loading extracted datasets")

    users_df = pd.read_parquet(users_path)
    recommendations_df = pd.read_parquet(recommendations_path)
    searches_df = pd.read_parquet(searches_path)

    logger.info(f"Users: {len(users_df)}, Recommendations: {len(recommendations_df)}, Searches: {len(searches_df)}")

    # Merge recommendations with user features
    # Note: recommendations already have user_vector from join, but we want additional user fields
    merged = recommendations_df.merge(
        users_df,
        on='user_id',
        how='left',
        suffixes=('_rec', '_user')
    )

    logger.info(f"After user merge: {len(merged)} rows")

    # Handle duplicate vector columns (keep from recommendation since it's more recent)
    if 'user_vector_rec' in merged.columns and 'user_vector_user' in merged.columns:
        merged['user_vector'] = merged['user_vector_rec'].fillna(merged['user_vector_user'])
        merged = merged.drop(columns=['user_vector_rec', 'user_vector_user'])
    elif 'user_vector_rec' in merged.columns:
        merged = merged.rename(columns={'user_vector_rec': 'user_vector'})
    elif 'user_vector_user' in merged.columns:
        merged = merged.rename(columns={'user_vector_user': 'user_vector'})

    # Handle duplicate primarySegment columns
    if 'primarySegment_rec' in merged.columns and 'primarySegment_user' in merged.columns:
        merged['primarySegment'] = merged['primarySegment_rec'].fillna(merged['primarySegment_user'])
        merged = merged.drop(columns=['primarySegment_rec', 'primarySegment_user'])
    elif 'primarySegment' not in merged.columns:
        # Rename if exists
        for col in merged.columns:
            if 'primarySegment' in col:
                merged = merged.rename(columns={col: 'primarySegment'})
                break

    # Add search context (most recent search per user)
    merged = merged.merge(
        searches_df,
        on='user_id',
        how='left',
        suffixes=('', '_search')
    )

    logger.info(f"Final merged dataset: {len(merged)} rows, {len(merged.columns)} columns")
    logger.info(f"Columns: {list(merged.columns)[:20]}...")  # Log first 20 columns

    return merged


if __name__ == "__main__":
    import os
    os.makedirs("data/processed", exist_ok=True)

    df = merge_datasets()
    output_path = "data/processed/merged.parquet"
    df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved merged dataset: {len(df)} rows to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
