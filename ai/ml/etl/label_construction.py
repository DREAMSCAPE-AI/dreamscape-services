"""
Construct labels: engagement_score, booking_probability, time_to_interaction
"""

import pandas as pd
from config.dataset_config import ENGAGEMENT_SCORES
from utils.logger import get_logger

logger = get_logger(__name__)

def calculate_engagement_score(row):
    """
    Calculate engagement score from recommendation status

    Args:
        row: DataFrame row

    Returns:
        float: Engagement score (0, 1, 3, 5, or -1)
    """
    status = row['status']

    # Check timestamps for more accurate classification
    if pd.notna(row.get('bookedAt')) or status == 'BOOKED':
        return ENGAGEMENT_SCORES['BOOKED']
    elif pd.notna(row.get('clickedAt')) or status == 'CLICKED':
        return ENGAGEMENT_SCORES['CLICKED']
    elif pd.notna(row.get('viewedAt')) or status == 'VIEWED':
        return ENGAGEMENT_SCORES['VIEWED']
    elif pd.notna(row.get('rejectedAt')) or status == 'REJECTED':
        return ENGAGEMENT_SCORES['REJECTED']
    else:  # GENERATED (not viewed)
        return ENGAGEMENT_SCORES['NOT_VIEWED']

def calculate_time_to_interaction(row):
    """
    Calculate time from recommendation generation to user interaction (in seconds)

    Args:
        row: DataFrame row

    Returns:
        int or None: Time to interaction in seconds
    """
    created_at = row.get('createdAt')
    if pd.isna(created_at):
        return None

    # Check which interaction happened
    interaction_time = None
    if pd.notna(row.get('viewedAt')):
        interaction_time = row['viewedAt']
    elif pd.notna(row.get('clickedAt')):
        interaction_time = row['clickedAt']
    elif pd.notna(row.get('bookedAt')):
        interaction_time = row['bookedAt']

    if interaction_time is None or pd.isna(interaction_time):
        return None

    # Calculate difference in seconds
    try:
        delta = pd.to_datetime(interaction_time) - pd.to_datetime(created_at)
        return int(delta.total_seconds())
    except:
        return None

def construct_labels(df: pd.DataFrame):
    """
    Construct all label columns

    Args:
        df: Featured DataFrame

    Returns:
        pd.DataFrame: DataFrame with labels
    """
    logger.info(f"Constructing labels for {len(df)} rows")

    # Calculate engagement_score
    df['engagement_score'] = df.apply(calculate_engagement_score, axis=1)
    logger.info(f"Engagement score distribution:\n{df['engagement_score'].value_counts()}")

    # Calculate booking_probability (binary)
    df['booking_probability'] = (df['engagement_score'] == ENGAGEMENT_SCORES['BOOKED']).astype(int)
    booking_rate = df['booking_probability'].mean()
    logger.info(f"Booking probability: {booking_rate:.2%}")

    # Calculate time_to_interaction
    df['time_to_interaction'] = df.apply(calculate_time_to_interaction, axis=1)
    has_interaction_time = df['time_to_interaction'].notna().sum()
    logger.info(f"Rows with time_to_interaction: {has_interaction_time}")

    # Interaction type (categorical)
    def get_interaction_type(row):
        score = row['engagement_score']
        if score == 5.0:
            return 'BOOKED'
        elif score == 3.0:
            return 'CLICKED'
        elif score == 1.0:
            return 'VIEWED'
        elif score == -1.0:
            return 'REJECTED'
        else:
            return 'NOT_VIEWED'

    df['interaction_type'] = df.apply(get_interaction_type, axis=1)
    logger.info(f"Interaction type distribution:\n{df['interaction_type'].value_counts()}")

    # Generate unique interaction_id
    df['interaction_id'] = df['recommendation_id'].astype(str)

    logger.info("Label construction completed")

    return df


if __name__ == "__main__":
    import os
    os.makedirs("data/processed", exist_ok=True)

    featured_df = pd.read_parquet("data/processed/featured.parquet")
    labeled_df = construct_labels(featured_df)

    output_path = "data/processed/labeled.parquet"
    labeled_df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved labeled dataset: {len(labeled_df)} rows to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
