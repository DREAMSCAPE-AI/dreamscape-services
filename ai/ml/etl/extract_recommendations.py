"""
Extract recommendation interactions from Recommendation table
Includes user/item features via joins
"""

import pandas as pd
from sqlalchemy import text
from config.dataset_config import DATA_WINDOW_DAYS
from utils.db_connector import get_db_connector
from utils.logger import get_logger

logger = get_logger(__name__)

def extract_recommendations(data_window_days=DATA_WINDOW_DAYS):
    """
    Extract recommendation interactions with user/item features

    Args:
        data_window_days: Number of days to look back

    Returns:
        pd.DataFrame: Recommendation interactions
    """
    logger.info(f"Extracting recommendations (window: {data_window_days} days)")

    db_connector = get_db_connector()
    engine = db_connector.get_engine()

    # Calculate cutoff date in Python to avoid INTERVAL parameter issues
    from datetime import datetime, timedelta
    cutoff_date = (datetime.now() - timedelta(days=data_window_days)).strftime('%Y-%m-%d %H:%M:%S')

    # Build query with cutoff_date directly in SQL (safe since we control the value)
    query_str = f"""
        SELECT
            r.id as recommendation_id,
            r."userId" as user_id,
            r."itemVectorId",
            r."destinationId",
            r."destinationName",
            r."destinationType",
            r.score as recommendation_score,
            r.confidence as recommendation_confidence,
            r."contextType",
            r."contextData",
            r.status,
            r."viewedAt",
            r."clickedAt",
            r."bookedAt",
            r."rejectedAt",
            r."userRating",
            r."createdAt",

            -- UserVector
            uv.vector as user_vector,
            uv."primarySegment",

            -- ItemVector
            iv.vector as item_vector,
            iv.country as item_country,
            iv."popularityScore" as item_popularity_score,
            iv."bookingCount" as item_booking_count,
            iv."searchCount" as item_search_count

        FROM recommendations r
        INNER JOIN user_vectors uv ON uv."userId" = r."userId"
        LEFT JOIN item_vectors iv ON iv.id = r."itemVectorId"

        WHERE r."createdAt" >= '{cutoff_date}'
    """

    try:
        df = pd.read_sql(query_str, engine)

        logger.info(f"Extracted {len(df)} recommendations")
        logger.info(f"Status distribution:\n{df['status'].value_counts()}")

        # Log sample statistics
        has_item_vector = df['item_vector'].notna().sum()
        has_user_rating = df['userRating'].notna().sum()
        logger.info(f"Recommendations with item vectors: {has_item_vector}")
        logger.info(f"Recommendations with user rating: {has_user_rating}")

        # Convert contextData JSONB to JSON string for Parquet compatibility
        # Parquet cannot serialize empty struct types, so we convert to string
        import json
        if 'contextData' in df.columns:
            df['contextData'] = df['contextData'].apply(
                lambda x: json.dumps(x) if pd.notna(x) and x != {} else None
            )
            logger.info("Converted contextData JSONB to JSON string for Parquet compatibility")

        return df

    except Exception as e:
        logger.error(f"Error extracting recommendations: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    import os
    os.makedirs("data/raw", exist_ok=True)

    df = extract_recommendations()
    output_path = "data/raw/recommendations.parquet"
    df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved {len(df)} recommendations to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
