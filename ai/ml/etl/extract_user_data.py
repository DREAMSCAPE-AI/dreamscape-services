"""
Extract user data from PostgreSQL (dreamscape_core + dreamscape_business)
Combines User, UserVector, TravelOnboardingProfile, UserPreferences
"""

import pandas as pd
from sqlalchemy import text
from config.db_config import get_database_url
from config.dataset_config import DATA_WINDOW_DAYS
from utils.db_connector import get_db_connector
from utils.logger import get_logger

logger = get_logger(__name__)

def extract_user_data(data_window_days=DATA_WINDOW_DAYS):
    """
    Extract user features from PostgreSQL

    Args:
        data_window_days: Number of days to look back for searches/bookings

    Returns:
        pd.DataFrame: User features dataset
    """
    logger.info(f"Extracting user data (window: {data_window_days} days)")

    db_connector = get_db_connector()
    engine = db_connector.get_engine()

    query = text("""
        SELECT
            u.id as user_id,
            u."dateOfBirth",
            u.nationality,
            u."userCategory",
            u."createdAt" as user_created_at,

            -- UserVector (8D features)
            uv.vector as user_vector,
            uv."primarySegment",
            uv."segmentConfidence",
            uv."updatedAt" as vector_updated_at,

            -- TravelOnboardingProfile
            top."travelTypes",
            top."globalBudgetRange",
            top."budgetFlexibility",
            top."activityLevel",
            top."accommodationLevel",
            top."travelWithChildren",
            top."climatePreferences",
            top."riskTolerance",

            -- UserPreferences
            up."budgetRange",
            up."preferredCabinClass",

            -- Aggregated history
            COUNT(DISTINCT sh.id) as search_count_90d,
            COUNT(DISTINCT CASE WHEN bd.status IN ('CONFIRMED', 'COMPLETED') THEN bd.id END) as booking_count_lifetime,
            AVG(CASE WHEN bd.status IN ('CONFIRMED', 'COMPLETED') THEN bd."totalAmount" END) as avg_booking_value

        FROM users u
        LEFT JOIN user_vectors uv ON uv."userId" = u.id
        LEFT JOIN travel_onboarding_profiles top ON top."userId" = u.id
        LEFT JOIN user_preferences up ON up."userId" = u.id
        LEFT JOIN search_history sh ON sh."userId" = u.id
            AND sh."searchedAt" >= NOW() - INTERVAL :window_days DAY
        LEFT JOIN booking_data bd ON bd."userId" = u.id

        WHERE u."onboardingCompleted" = TRUE
          AND uv.id IS NOT NULL

        GROUP BY u.id, uv.id, top.id, up.id
    """)

    try:
        df = pd.read_sql(query, engine, params={'window_days': data_window_days})

        logger.info(f"Extracted {len(df)} users")
        logger.info(f"Columns: {list(df.columns)}")

        # Log sample statistics
        users_with_vector = df['user_vector'].notna().sum()
        users_with_onboarding = df['travelTypes'].notna().sum()
        logger.info(f"Users with vectors: {users_with_vector}")
        logger.info(f"Users with onboarding: {users_with_onboarding}")

        return df

    except Exception as e:
        logger.error(f"Error extracting user data: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    import os
    os.makedirs("data/raw", exist_ok=True)

    df = extract_user_data()
    output_path = "data/raw/users.parquet"
    df.to_parquet(output_path, compression='snappy', index=False)

    logger.info(f"Saved {len(df)} users to {output_path}")
    logger.info(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
