"""
Database configuration

Uses DATABASE_URL from environment (set by docker-compose or .env)
Compatible with @dreamscape/db Prisma configuration
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL from environment (same as Prisma in @dreamscape/db)
# In production: Set by docker-compose from shared PostgreSQL service
# In development: Can be set in .env file for local testing
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "It should be automatically set by docker-compose. "
        "For local development, create a .env file with DATABASE_URL."
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
