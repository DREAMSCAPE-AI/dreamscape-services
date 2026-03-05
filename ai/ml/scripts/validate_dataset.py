"""
Dataset validation script - Check coherence and quality
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))
from utils.logger import get_logger

logger = get_logger(__name__)


def validate_dataset(train_path: str, test_path: str):
    """
    Validate dataset coherence and quality

    Args:
        train_path: Path to train parquet
        test_path: Path to test parquet

    Returns:
        dict: Validation results
    """
    logger.info("=" * 80)
    logger.info("DATASET VALIDATION")
    logger.info("=" * 80)

    # Load datasets
    train_df = pd.read_parquet(train_path)
    test_df = pd.read_parquet(test_path)

    logger.info(f"\n📊 Dataset Size:")
    logger.info(f"  Train: {len(train_df)} rows, {len(train_df.columns)} columns")
    logger.info(f"  Test: {len(test_df)} rows, {len(test_df.columns)} columns")
    logger.info(f"  Total: {len(train_df) + len(test_df)} rows")

    results = {
        'valid': True,
        'errors': [],
        'warnings': [],
        'stats': {}
    }

    # ========== TEST 1: Check Required Columns ==========
    logger.info("\n✓ TEST 1: Required Columns")
    required_cols = [
        'user_hash', 'engagement_score', 'booking_probability',
        'user_climate_pref', 'user_culture_pref', 'user_budget_level',
        'item_climate_pref', 'item_culture_pref', 'item_budget_level'
    ]

    missing_train = [col for col in required_cols if col not in train_df.columns]
    missing_test = [col for col in required_cols if col not in test_df.columns]

    if missing_train or missing_test:
        results['valid'] = False
        results['errors'].append(f"Missing required columns - Train: {missing_train}, Test: {missing_test}")
        logger.error(f"  ❌ Missing columns - Train: {missing_train}, Test: {missing_test}")
    else:
        logger.info(f"  ✓ All {len(required_cols)} required columns present")

    # ========== TEST 2: Check for Missing Values in Critical Columns ==========
    logger.info("\n✓ TEST 2: Missing Values in Critical Columns")

    for col in required_cols:
        if col in train_df.columns:
            train_missing = train_df[col].isna().sum()
            test_missing = test_df[col].isna().sum()

            if train_missing > 0 or test_missing > 0:
                results['valid'] = False
                results['errors'].append(f"Missing values in '{col}' - Train: {train_missing}, Test: {test_missing}")
                logger.error(f"  ❌ '{col}': Train {train_missing} missing, Test {test_missing} missing")
            else:
                logger.info(f"  ✓ '{col}': No missing values")

    # ========== TEST 3: Validate 8D Vector Ranges [0, 1] ==========
    logger.info("\n✓ TEST 3: 8D Vector Ranges [0, 1]")

    vector_cols = [
        'user_climate_pref', 'user_culture_pref', 'user_budget_level', 'user_activity_level',
        'user_group_type', 'user_urban_pref', 'user_gastronomy_pref', 'user_popularity_pref',
        'item_climate_pref', 'item_culture_pref', 'item_budget_level', 'item_activity_level',
        'item_group_type', 'item_urban_pref', 'item_gastronomy_pref', 'item_popularity_pref'
    ]

    vector_issues = []
    for col in vector_cols:
        if col in train_df.columns:
            train_out_of_range = ((train_df[col] < 0) | (train_df[col] > 1)).sum()
            test_out_of_range = ((test_df[col] < 0) | (test_df[col] > 1)).sum()

            if train_out_of_range > 0 or test_out_of_range > 0:
                vector_issues.append(f"{col}: Train {train_out_of_range}, Test {test_out_of_range}")
                results['warnings'].append(f"Out-of-range values in '{col}'")

    if vector_issues:
        logger.warning(f"  ⚠ Out-of-range values found:")
        for issue in vector_issues:
            logger.warning(f"    - {issue}")
    else:
        logger.info(f"  ✓ All vector values in [0, 1] range")

    # ========== TEST 4: Validate Engagement Score Distribution ==========
    logger.info("\n✓ TEST 4: Engagement Score Distribution")

    valid_scores = {-1.0, 0.0, 1.0, 3.0, 5.0}

    train_engagement = train_df['engagement_score'].value_counts().sort_index()
    test_engagement = test_df['engagement_score'].value_counts().sort_index()

    train_invalid = ~train_df['engagement_score'].isin(valid_scores)
    test_invalid = ~test_df['engagement_score'].isin(valid_scores)

    if train_invalid.sum() > 0 or test_invalid.sum() > 0:
        results['valid'] = False
        results['errors'].append(f"Invalid engagement_score values")
        logger.error(f"  ❌ Invalid values - Train: {train_invalid.sum()}, Test: {test_invalid.sum()}")
    else:
        logger.info(f"  ✓ All engagement_score values are valid")
        logger.info(f"\n  Train Distribution:")
        for score, count in train_engagement.items():
            pct = count / len(train_df) * 100
            logger.info(f"    {score:4.1f}: {count:4d} ({pct:5.2f}%)")

        logger.info(f"\n  Test Distribution:")
        for score, count in test_engagement.items():
            pct = count / len(test_df) * 100
            logger.info(f"    {score:4.1f}: {count:4d} ({pct:5.2f}%)")

    results['stats']['engagement_distribution'] = {
        'train': train_engagement.to_dict(),
        'test': test_engagement.to_dict()
    }

    # ========== TEST 5: Validate Booking Probability ==========
    logger.info("\n✓ TEST 5: Booking Probability")

    train_booking = train_df['booking_probability'].isin([0, 1]).all()
    test_booking = test_df['booking_probability'].isin([0, 1]).all()

    if not train_booking or not test_booking:
        results['valid'] = False
        results['errors'].append(f"booking_probability must be 0 or 1")
        logger.error(f"  ❌ Invalid booking_probability values")
    else:
        train_rate = train_df['booking_probability'].mean() * 100
        test_rate = test_df['booking_probability'].mean() * 100
        logger.info(f"  ✓ Booking probability is binary")
        logger.info(f"    Train booking rate: {train_rate:.2f}%")
        logger.info(f"    Test booking rate: {test_rate:.2f}%")

        results['stats']['booking_rate'] = {
            'train': train_rate,
            'test': test_rate
        }

    # ========== TEST 6: Check Coherence Between Labels ==========
    logger.info("\n✓ TEST 6: Label Coherence (booking_probability ↔ engagement_score)")

    # Rule: If booking_probability == 1, then engagement_score should be 5.0
    train_incoherent = train_df[(train_df['booking_probability'] == 1) & (train_df['engagement_score'] != 5.0)]
    test_incoherent = test_df[(test_df['booking_probability'] == 1) & (test_df['engagement_score'] != 5.0)]

    if len(train_incoherent) > 0 or len(test_incoherent) > 0:
        results['valid'] = False
        results['errors'].append(f"Incoherent labels: booking=1 but engagement≠5.0")
        logger.error(f"  ❌ Incoherent labels - Train: {len(train_incoherent)}, Test: {len(test_incoherent)}")
    else:
        logger.info(f"  ✓ Labels are coherent (booking=1 → engagement=5.0)")

    # ========== TEST 7: Check Feature Statistics ==========
    logger.info("\n✓ TEST 7: Feature Statistics")

    numerical_cols = ['recommendation_score', 'recommendation_confidence', 'user_age_group']

    logger.info(f"\n  Numerical Features:")
    for col in numerical_cols:
        if col in train_df.columns:
            train_mean = train_df[col].mean() if col != 'user_age_group' else None
            test_mean = test_df[col].mean() if col != 'user_age_group' else None

            if train_mean is not None:
                logger.info(f"    {col}: Train μ={train_mean:.3f}, Test μ={test_mean:.3f}")

    # ========== TEST 8: Check for Duplicates ==========
    logger.info("\n✓ TEST 8: Duplicate Rows")

    # Exclude array columns (user_vector, item_vector) for duplicate detection
    non_array_cols = [col for col in train_df.columns
                      if col not in ['user_vector', 'item_vector']
                      and not isinstance(train_df[col].iloc[0] if len(train_df) > 0 else None, (list, np.ndarray))]

    try:
        train_dupes = train_df[non_array_cols].duplicated().sum() if non_array_cols else 0
        test_dupes = test_df[non_array_cols].duplicated().sum() if non_array_cols else 0

        if train_dupes > 0 or test_dupes > 0:
            results['warnings'].append(f"Duplicate rows found - Train: {train_dupes}, Test: {test_dupes}")
            logger.warning(f"  ⚠ Duplicates - Train: {train_dupes}, Test: {test_dupes}")
        else:
            logger.info(f"  ✓ No duplicate rows (checked {len(non_array_cols)} columns)")
    except Exception as e:
        logger.warning(f"  ⚠ Could not check duplicates: {str(e)}")

    # ========== TEST 9: Check User Distribution ==========
    logger.info("\n✓ TEST 9: User Distribution")

    train_users = train_df['user_hash'].nunique()
    test_users = test_df['user_hash'].nunique()
    overlap = len(set(train_df['user_hash']) & set(test_df['user_hash']))

    logger.info(f"  Unique users - Train: {train_users}, Test: {test_users}")
    logger.info(f"  User overlap: {overlap} users ({overlap/test_users*100:.1f}% of test)")

    if overlap / test_users > 0.5:
        results['warnings'].append(f"High user overlap between train/test: {overlap/test_users*100:.1f}%")
        logger.warning(f"  ⚠ High overlap may cause data leakage")

    results['stats']['user_distribution'] = {
        'train_unique': train_users,
        'test_unique': test_users,
        'overlap': overlap
    }

    # ========== TEST 10: Check Segment Distribution ==========
    logger.info("\n✓ TEST 10: Segment Distribution")

    if 'primarySegment' in train_df.columns:
        train_segments = train_df['primarySegment'].value_counts()
        test_segments = test_df['primarySegment'].value_counts()

        logger.info(f"\n  Train Segments:")
        for segment, count in train_segments.items():
            logger.info(f"    {segment}: {count} ({count/len(train_df)*100:.1f}%)")

        logger.info(f"\n  Test Segments:")
        for segment, count in test_segments.items():
            logger.info(f"    {segment}: {count} ({count/len(test_df)*100:.1f}%)")

    # ========== FINAL SUMMARY ==========
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 80)

    if results['valid'] and len(results['errors']) == 0:
        logger.info("✅ DATASET IS VALID AND COHERENT")
    else:
        logger.error("❌ DATASET HAS ERRORS")
        for error in results['errors']:
            logger.error(f"  - {error}")

    if results['warnings']:
        logger.warning(f"\n⚠ {len(results['warnings'])} WARNINGS:")
        for warning in results['warnings']:
            logger.warning(f"  - {warning}")

    logger.info("=" * 80)

    return results


if __name__ == "__main__":
    train_path = "/app/data/datasets/v1.0/train_v1.0.parquet"
    test_path = "/app/data/datasets/v1.0/test_v1.0.parquet"

    results = validate_dataset(train_path, test_path)

    # Exit with error code if validation failed
    sys.exit(0 if results['valid'] else 1)
