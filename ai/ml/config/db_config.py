"""
Database configuration
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL from environment
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://dreamscape:password@localhost:5432/dreamscape'
)

def get_database_url():
    """Get database URL from environment"""
    return DATABASE_URL

# Database connection settings
DB_CONFIG = {
    'pool_size': 5,
    'max_overflow': 10,
    'pool_timeout': 30,
    'pool_recycle': 3600,
    'echo': False  # Set to True for SQL query logging
}
