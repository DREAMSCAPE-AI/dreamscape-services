"""
PostgreSQL database connector utility
"""

from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from config.db_config import get_database_url, DB_CONFIG
from utils.logger import get_logger

logger = get_logger(__name__)

class DatabaseConnector:
    """PostgreSQL database connector with connection pooling"""

    def __init__(self):
        self.database_url = get_database_url()
        self.engine = None

    def get_engine(self):
        """
        Get SQLAlchemy engine with connection pooling

        Returns:
            SQLAlchemy Engine
        """
        if self.engine is None:
            logger.info(f"Creating database engine")

            self.engine = create_engine(
                self.database_url,
                poolclass=QueuePool,
                pool_size=DB_CONFIG['pool_size'],
                max_overflow=DB_CONFIG['max_overflow'],
                pool_timeout=DB_CONFIG['pool_timeout'],
                pool_recycle=DB_CONFIG['pool_recycle'],
                echo=DB_CONFIG['echo']
            )

            logger.info("Database engine created successfully")

        return self.engine

    def test_connection(self):
        """
        Test database connection

        Returns:
            bool: True if connection successful
        """
        try:
            engine = self.get_engine()
            with engine.connect() as conn:
                result = conn.execute("SELECT 1")
                logger.info("Database connection test successful")
                return True
        except Exception as e:
            logger.error(f"Database connection test failed: {str(e)}")
            return False

    def close(self):
        """Close database connection pool"""
        if self.engine:
            self.engine.dispose()
            logger.info("Database connection pool closed")


# Singleton instance
_db_connector = None

def get_db_connector():
    """
    Get singleton database connector instance

    Returns:
        DatabaseConnector instance
    """
    global _db_connector
    if _db_connector is None:
        _db_connector = DatabaseConnector()
    return _db_connector
