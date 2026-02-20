"""
Extract voyage/search data from SearchHistory and BookingData
"""

import pandas as pd
from sqlalchemy import text
from config.dataset_config import DATA_WINDOW_DAYS
from utils.db_connector import get_db_connector
from utils.logger import get_logger

logger = get_logger(__name__)

def extract_voyage_data(data_window_days=DATA_WINDOW_DAYS):
    """
    Extract search history and booking data

    Args:
        data_window_days: Number of days to look back

    Returns:
        pd.DataFrame: Search and booking data
    """
    logger.info(f"Extracting voyage data (window: {data_window_days} days)")

    db_connector = get_db_connector()
    engine = db_connector.get_engine()

    # Extract SearchHistory
    search_query = text("""
        SELECT
            sh.id as search_id,
            sh."userId" as user_id,
            sh.origin as search_origin,
            sh.destination as search_destination,
            sh."departureDate",
            sh."returnDate",
            sh.passengers as search_passengers,
            sh."cabinClass" as search_cabin_class,
            sh."searchedAt",
            sh."resultsCount"

        FROM search_history sh
        WHERE sh."searchedAt" >= NOW() - INTERVAL :window_days DAY
          AND sh."userId" IS NOT NULL

        ORDER BY sh."userId", sh."searchedAt" DESC
    """)

    try:
        searches_df = pd.read_sql(search_query, engine, params={'window_days': data_window_days})
        logger.info(f"Extracted {len(searches_df)} search records")

        # Keep only the most recent search per user
        searches_df['search_rank'] = searches_df.groupby('user_id')['searchedAt'].rank(method='first', ascending=False)
        recent_searches = searches_df[searches_df['search_rank'] == 1].drop(columns=['search_rank'])

        logger.info(f"Keeping most recent search per user: {len(recent_searches)} records")

        return recent_searches

    except Exception as e:
        logger.error(f"Error extracting voyage data: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    import os
    os.makedirs("data/raw", exist_ok=True)

    df = extract_voyage_data()
    output_path = "data/raw/searches.parquet"
    df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved {len(df)} search records to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
