"""
Orchestration script for complete ETL pipeline
Executes all 10 steps in sequence
"""

import os
import sys
import argparse
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from etl.extract_user_data import extract_user_data
from etl.extract_recommendations import extract_recommendations
from etl.extract_voyage_data import extract_voyage_data
from etl.merge_datasets import merge_datasets
from etl.feature_engineering import engineer_features
from etl.label_construction import construct_labels
from etl.negative_sampling import add_negative_samples
from etl.data_cleaning import clean_dataset
from etl.gdpr_anonymization import anonymize_dataset
from etl.export_dataset import split_and_export, generate_metadata, generate_quality_report
from config.dataset_config import DATASET_VERSION, DATA_WINDOW_DAYS
from utils.logger import get_logger
from utils.validators import validate_dataset

logger = get_logger(__name__)

def run_etl_pipeline(version=DATASET_VERSION, window_days=DATA_WINDOW_DAYS):
    """
    Run complete ETL pipeline

    Args:
        version: Dataset version (e.g., "1.0")
        window_days: Data window in days (default 90)

    Returns:
        dict: Metadata of generated dataset
    """
    logger.info("=" * 80)
    logger.info(f"DREAMSCAPE ML ETL PIPELINE v{version}")
    logger.info("=" * 80)
    logger.info(f"Data window: {window_days} days")
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)

    start_time = datetime.now()

    try:
        # Create directories
        os.makedirs("data/raw", exist_ok=True)
        os.makedirs("data/processed", exist_ok=True)
        os.makedirs(f"data/datasets/v{version}", exist_ok=True)

        # ========== STEP 1: Extract User Data ==========
        logger.info("\n[1/10] Extracting user data from PostgreSQL")
        users_df = extract_user_data(window_days)
        users_df.to_parquet("data/raw/users.parquet", compression='snappy', index=False)
        logger.info(f"✓ Saved {len(users_df)} users to data/raw/users.parquet")

        # ========== STEP 2: Extract Recommendations ==========
        logger.info("\n[2/10] Extracting recommendation data from PostgreSQL")
        recs_df = extract_recommendations(window_days)
        recs_df.to_parquet("data/raw/recommendations.parquet", compression='snappy', index=False)
        logger.info(f"✓ Saved {len(recs_df)} recommendations to data/raw/recommendations.parquet")

        # ========== STEP 3: Extract Voyage/Search Data ==========
        logger.info("\n[3/10] Extracting voyage/search data from PostgreSQL")
        searches_df = extract_voyage_data(window_days)
        searches_df.to_parquet("data/raw/searches.parquet", compression='snappy', index=False)
        logger.info(f"✓ Saved {len(searches_df)} searches to data/raw/searches.parquet")

        # ========== STEP 4: Merge Datasets ==========
        logger.info("\n[4/10] Merging datasets")
        merged_df = merge_datasets()
        merged_df.to_parquet("data/processed/merged.parquet", compression='snappy', index=False)
        logger.info(f"✓ Saved merged dataset with {len(merged_df)} rows")

        # ========== STEP 5: Feature Engineering ==========
        logger.info("\n[5/10] Engineering features")
        featured_df = engineer_features(merged_df)
        featured_df.to_parquet("data/processed/featured.parquet", compression='snappy', index=False)
        logger.info(f"✓ Saved featured dataset with {len(featured_df.columns)} columns")

        # ========== STEP 6: Construct Labels ==========
        logger.info("\n[6/10] Constructing labels")
        labeled_df = construct_labels(featured_df)
        labeled_df.to_parquet("data/processed/labeled.parquet", compression='snappy', index=False)
        logger.info(f"✓ Labels constructed: engagement_score, booking_probability")

        # ========== STEP 7: Add Negative Samples ==========
        logger.info("\n[7/10] Adding negative samples")
        balanced_df = add_negative_samples(labeled_df)
        balanced_df.to_parquet("data/processed/balanced.parquet", compression='snappy', index=False)
        logger.info(f"✓ Balanced dataset with {len(balanced_df)} rows")

        # ========== STEP 8: Data Cleaning ==========
        logger.info("\n[8/10] Cleaning dataset")
        cleaned_df = clean_dataset(balanced_df)
        cleaned_df.to_parquet("data/processed/cleaned.parquet", compression='snappy', index=False)
        logger.info(f"✓ Cleaned dataset with {len(cleaned_df)} rows")

        # ========== STEP 9: GDPR Anonymization ==========
        logger.info("\n[9/10] Anonymizing dataset (GDPR)")
        final_df = anonymize_dataset(cleaned_df)
        final_df.to_parquet("data/processed/final.parquet", compression='snappy', index=False)
        logger.info(f"✓ Anonymized dataset ready")

        # ========== STEP 10: Train/Test Split & Export ==========
        logger.info("\n[10/10] Exporting final datasets")
        train_df, test_df = split_and_export(final_df, version=version)

        # Validate datasets
        logger.info("Validating train dataset")
        validate_dataset(train_df)
        logger.info("Validating test dataset")
        validate_dataset(test_df)

        # Generate metadata
        metadata = generate_metadata(train_df, test_df, version)

        # Generate quality report
        generate_quality_report(train_df, test_df, version)

        # ========== PIPELINE COMPLETED ==========
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        logger.info("=" * 80)
        logger.info("ETL PIPELINE COMPLETED SUCCESSFULLY")
        logger.info("=" * 80)
        logger.info(f"Duration: {duration:.2f} seconds ({duration/60:.1f} minutes)")
        logger.info(f"Train samples: {len(train_df):,}")
        logger.info(f"Test samples: {len(test_df):,}")
        logger.info(f"Total features: {len(train_df.columns)}")
        logger.info(f"Booking rate: {train_df['booking_probability'].mean():.2%}")
        logger.info(f"\nOutput directory: data/datasets/v{version}/")
        logger.info("Files generated:")
        logger.info(f"  - train_v{version}.parquet")
        logger.info(f"  - test_v{version}.parquet")
        logger.info(f"  - metadata_v{version}.json")
        logger.info(f"  - quality_report_v{version}.html")
        logger.info("=" * 80)

        return metadata

    except Exception as e:
        logger.error("=" * 80)
        logger.error("ETL PIPELINE FAILED")
        logger.error("=" * 80)
        logger.error(f"Error: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='DREAMSCAPE ML ETL Pipeline - Generate training dataset',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_etl.py                          # Use default version 1.0, 90-day window
  python run_etl.py --version 1.1            # Create version 1.1
  python run_etl.py --window-days 180        # Use 180-day window
  python run_etl.py --version 2.0 --window-days 180  # Major version with larger window
        """
    )

    parser.add_argument(
        '--version',
        type=str,
        default=DATASET_VERSION,
        help=f'Dataset version (default: {DATASET_VERSION})'
    )

    parser.add_argument(
        '--window-days',
        type=int,
        default=DATA_WINDOW_DAYS,
        help=f'Data window in days (default: {DATA_WINDOW_DAYS})'
    )

    args = parser.parse_args()

    try:
        run_etl_pipeline(version=args.version, window_days=args.window_days)
        sys.exit(0)
    except Exception:
        sys.exit(1)
