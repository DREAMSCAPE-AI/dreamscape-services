"""
Add negative samples (not viewed recommendations) with ratio control
"""

import pandas as pd
from config.dataset_config import NEGATIVE_SAMPLE_RATIO
from utils.logger import get_logger

logger = get_logger(__name__)

def add_negative_samples(df: pd.DataFrame, ratio=NEGATIVE_SAMPLE_RATIO):
    """
    Add negative samples (not viewed recommendations) with ratio control

    For each positive interaction (viewed/clicked/booked), include N negatives

    Args:
        df: Labeled DataFrame
        ratio: Ratio of negatives to positives (default 2.0)

    Returns:
        pd.DataFrame: Balanced dataset
    """
    logger.info(f"Adding negative samples with ratio {ratio}:1")

    # Positive samples (engagement_score > 0)
    positives = df[df['engagement_score'] > 0]
    n_positives = len(positives)

    # Negative samples (not viewed, engagement_score = 0)
    negatives = df[df['engagement_score'] == 0]
    n_negatives_available = len(negatives)

    # Calculate target negative count
    n_target_negatives = int(n_positives * ratio)

    logger.info(f"Positives: {n_positives}, Available negatives: {n_negatives_available}")

    # Sample negatives
    if n_negatives_available > n_target_negatives:
        negatives_sampled = negatives.sample(n=n_target_negatives, random_state=42)
        logger.info(f"Sampled {n_target_negatives} negatives from {n_negatives_available}")
    else:
        negatives_sampled = negatives
        logger.warning(f"Not enough negatives. Using all {n_negatives_available} available")

    # Combine positives and negatives
    balanced_df = pd.concat([positives, negatives_sampled], ignore_index=True)

    # Shuffle
    balanced_df = balanced_df.sample(frac=1, random_state=42).reset_index(drop=True)

    logger.info(f"Balanced dataset: {len(balanced_df)} rows ({n_positives} positives, {len(negatives_sampled)} negatives)")

    # Log final distribution
    logger.info(f"Final engagement_score distribution:\n{balanced_df['engagement_score'].value_counts()}")

    return balanced_df


if __name__ == "__main__":
    import os
    os.makedirs("data/processed", exist_ok=True)

    labeled_df = pd.read_parquet("data/processed/labeled.parquet")
    balanced_df = add_negative_samples(labeled_df)

    output_path = "data/processed/balanced.parquet"
    balanced_df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved balanced dataset: {len(balanced_df)} rows to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
