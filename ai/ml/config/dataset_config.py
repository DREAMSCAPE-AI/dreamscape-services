"""
Dataset configuration and schema definitions
"""

# Dataset version
DATASET_VERSION = "1.0"

# Data extraction parameters
DATA_WINDOW_DAYS = 90  # Extract last 90 days of data
NEGATIVE_SAMPLE_RATIO = 2.0  # 2 negatives per 1 positive

# Train/test split
TEST_SIZE = 0.2
RANDOM_SEED = 42

# Schema definition - Complete feature list
SCHEMA = {
    # === UNIQUE IDENTIFIERS ===
    'user_hash': 'string',
    'interaction_id': 'string',
    'timestamp': 'datetime64[ns]',

    # === USER FEATURES (8D vector) ===
    'user_climate_pref': 'float32',      # [0-1] Index 0: Climate preference
    'user_culture_pref': 'float32',      # [0-1] Index 1: Culture vs Nature
    'user_budget_level': 'float32',      # [0-1] Index 2: Budget level
    'user_activity_level': 'float32',    # [0-1] Index 3: Activity level
    'user_group_type': 'float32',        # [0-1] Index 4: Travel group
    'user_urban_pref': 'float32',        # [0-1] Index 5: Urban vs Rural
    'user_gastronomy_pref': 'float32',   # [0-1] Index 6: Gastronomy importance
    'user_popularity_pref': 'float32',   # [0-1] Index 7: Popularity preference

    # === USER SEGMENT ===
    'primary_segment': 'string',
    'segment_confidence': 'float32',

    # === USER DEMOGRAPHICS ===
    'user_age': 'int32',
    'user_nationality': 'string',
    'user_category': 'string',

    # === USER PREFERENCES ===
    'travel_types': 'string',
    'accommodation_level': 'string',
    'activity_level_enum': 'string',
    'budget_min': 'float32',
    'budget_max': 'float32',
    'budget_flexibility': 'string',
    'travel_with_children': 'bool',

    # === ITEM FEATURES (8D vector) ===
    'item_destination_id': 'string',
    'item_destination_name': 'string',
    'item_destination_type': 'string',
    'item_country': 'string',
    'item_climate': 'float32',
    'item_culture': 'float32',
    'item_budget': 'float32',
    'item_activity': 'float32',
    'item_group': 'float32',
    'item_urban': 'float32',
    'item_gastronomy': 'float32',
    'item_popularity_score': 'float32',
    'item_booking_count': 'int32',
    'item_search_count': 'int32',

    # === CONTEXT FEATURES ===
    'context_type': 'string',
    'search_origin': 'string',
    'search_passengers': 'int32',
    'search_cabin_class': 'string',
    'days_until_departure': 'int32',
    'season': 'string',
    'is_weekend': 'bool',

    # === INTERACTION FEATURES ===
    'recommendation_score': 'float32',
    'recommendation_confidence': 'float32',
    'user_search_count': 'int32',
    'user_booking_count': 'int32',
    'user_avg_booking_value': 'float32',
    'days_since_last_search': 'int32',
    'days_since_last_booking': 'int32',

    # === LABELS (Target Variables) ===
    'interaction_type': 'string',
    'engagement_score': 'float32',
    'booking_probability': 'int32',
    'user_rating': 'int32',
    'time_to_interaction': 'int32',
}

# Required columns (must not be null)
REQUIRED_COLUMNS = [
    'user_hash',
    'user_climate_pref',
    'user_culture_pref',
    'user_budget_level',
    'user_activity_level',
    'item_destination_id',
    'recommendation_score',
    'engagement_score',
    'booking_probability'
]

# Categorical columns (for encoding)
CATEGORICAL_COLUMNS = [
    'primary_segment',
    'user_nationality',
    'user_category',
    'travel_types',
    'accommodation_level',
    'activity_level_enum',
    'budget_flexibility',
    'item_destination_type',
    'item_country',
    'context_type',
    'search_cabin_class',
    'season',
    'interaction_type'
]

# Numerical columns (for normalization)
NUMERICAL_COLUMNS = [
    'user_climate_pref', 'user_culture_pref', 'user_budget_level',
    'user_activity_level', 'user_group_type', 'user_urban_pref',
    'user_gastronomy_pref', 'user_popularity_pref',
    'item_climate', 'item_culture', 'item_budget', 'item_activity',
    'item_group', 'item_urban', 'item_gastronomy',
    'recommendation_score', 'recommendation_confidence',
    'item_popularity_score', 'segment_confidence'
]

# 8D vector dimension names
VECTOR_DIMENSIONS = [
    'climate_pref', 'culture_pref', 'budget_level', 'activity_level',
    'group_type', 'urban_pref', 'gastronomy_pref', 'popularity_pref'
]

# Engagement score mapping
ENGAGEMENT_SCORES = {
    'NOT_VIEWED': 0.0,
    'VIEWED': 1.0,
    'CLICKED': 3.0,
    'BOOKED': 5.0,
    'REJECTED': -1.0
}

# Season mapping (month → season)
SEASON_MAPPING = {
    12: 'winter', 1: 'winter', 2: 'winter',
    3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'autumn', 10: 'autumn', 11: 'autumn'
}

# Country to region mapping (for GDPR anonymization)
COUNTRY_TO_REGION = {
    # Europe
    'FR': 'Europe', 'DE': 'Europe', 'IT': 'Europe', 'ES': 'Europe', 'UK': 'Europe',
    'PT': 'Europe', 'NL': 'Europe', 'BE': 'Europe', 'CH': 'Europe', 'AT': 'Europe',
    'GR': 'Europe', 'SE': 'Europe', 'NO': 'Europe', 'DK': 'Europe', 'FI': 'Europe',

    # North America
    'US': 'North America', 'CA': 'North America', 'MX': 'North America',

    # Asia
    'CN': 'Asia', 'JP': 'Asia', 'KR': 'Asia', 'IN': 'Asia', 'TH': 'Asia',
    'VN': 'Asia', 'ID': 'Asia', 'MY': 'Asia', 'SG': 'Asia', 'PH': 'Asia',

    # Middle East
    'AE': 'Middle East', 'SA': 'Middle East', 'IL': 'Middle East', 'TR': 'Middle East',

    # Oceania
    'AU': 'Oceania', 'NZ': 'Oceania',

    # South America
    'BR': 'South America', 'AR': 'South America', 'CL': 'South America', 'PE': 'South America',

    # Africa
    'ZA': 'Africa', 'EG': 'Africa', 'MA': 'Africa', 'KE': 'Africa',
}

# Age bins for GDPR anonymization
AGE_BINS = [0, 25, 35, 50, 65, 100]
AGE_LABELS = ['18-25', '26-35', '36-50', '51-65', '65+']
