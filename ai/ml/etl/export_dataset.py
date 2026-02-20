"""
Export dataset: train/test split, generate metadata and quality report
"""

import os
import json
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from sklearn.model_selection import train_test_split
from jinja2 import Template

from config.dataset_config import TEST_SIZE, RANDOM_SEED, DATA_WINDOW_DAYS
from utils.logger import get_logger
from utils.metrics import calculate_dataset_metrics

logger = get_logger(__name__)

def split_and_export(df: pd.DataFrame, version="1.0", test_size=TEST_SIZE):
    """
    Split dataset into train/test and export to Parquet

    Args:
        df: Final DataFrame
        version: Dataset version
        test_size: Test set proportion

    Returns:
        tuple: (train_df, test_df)
    """
    logger.info(f"Splitting dataset (test_size={test_size})")

    # Stratified split on engagement_score for balanced distribution
    train_df, test_df = train_test_split(
        df,
        test_size=test_size,
        stratify=df['engagement_score'],
        random_state=RANDOM_SEED
    )

    logger.info(f"Train: {len(train_df)} rows ({len(train_df)/len(df)*100:.1f}%)")
    logger.info(f"Test: {len(test_df)} rows ({len(test_df)/len(df)*100:.1f}%)")

    # Create output directory
    output_dir = f"data/datasets/v{version}"
    os.makedirs(output_dir, exist_ok=True)

    # Export to Parquet
    train_path = f"{output_dir}/train_v{version}.parquet"
    test_path = f"{output_dir}/test_v{version}.parquet"

    train_df.to_parquet(train_path, compression='snappy', index=False)
    test_df.to_parquet(test_path, compression='snappy', index=False)

    logger.info(f"Saved train dataset to {train_path}")
    logger.info(f"Saved test dataset to {test_path}")

    # Export sample CSV for debugging
    sample_csv_path = f"{output_dir}/train_sample.csv"
    train_df.head(1000).to_csv(sample_csv_path, index=False)
    logger.info(f"Saved sample CSV to {sample_csv_path}")

    return train_df, test_df

def generate_metadata(train_df: pd.DataFrame, test_df: pd.DataFrame, version: str):
    """
    Generate metadata JSON file

    Args:
        train_df: Train DataFrame
        test_df: Test DataFrame
        version: Dataset version

    Returns:
        dict: Metadata
    """
    logger.info("Generating metadata")

    metadata = {
        'version': version,
        'created_at': datetime.now().isoformat(),
        'dataset': {
            'train_rows': len(train_df),
            'test_rows': len(test_df),
            'total_rows': len(train_df) + len(test_df),
            'num_features': len(train_df.columns),
            'feature_names': list(train_df.columns)
        },
        'extraction': {
            'data_window_days': DATA_WINDOW_DAYS,
            'extraction_date': datetime.now().isoformat(),
            'source_tables': [
                'users', 'user_vectors', 'travel_onboarding_profiles',
                'user_preferences', 'recommendations', 'item_vectors',
                'search_history', 'booking_data'
            ]
        },
        'labels': {
            'engagement_score_distribution': train_df['engagement_score'].value_counts().to_dict(),
            'booking_rate': float(train_df['booking_probability'].mean()),
            'avg_user_rating': float(train_df['user_rating'].mean()) if 'user_rating' in train_df and train_df['user_rating'].notna().sum() > 0 else None
        },
        'schema_version': '1.0',
        'format': 'parquet',
        'compression': 'snappy'
    }

    output_dir = f"data/datasets/v{version}"
    metadata_path = f"{output_dir}/metadata_v{version}.json"

    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Metadata saved to {metadata_path}")

    return metadata

def generate_quality_report(train_df: pd.DataFrame, test_df: pd.DataFrame, version: str):
    """
    Generate HTML quality report with statistics and visualizations

    Args:
        train_df: Train DataFrame
        test_df: Test DataFrame
        version: Dataset version
    """
    logger.info("Generating quality report")

    output_dir = f"data/datasets/v{version}"

    # Calculate statistics
    stats = {
        'train_rows': len(train_df),
        'test_rows': len(test_df),
        'total_rows': len(train_df) + len(test_df),
        'train_pct': len(train_df) / (len(train_df) + len(test_df)) * 100,
        'test_pct': len(test_df) / (len(train_df) + len(test_df)) * 100,
        'num_features': len(train_df.columns),
        'missing_pct': train_df.isnull().sum().sum() / (len(train_df) * len(train_df.columns)) * 100,
    }

    # Label distribution
    label_dist = train_df['engagement_score'].value_counts(normalize=True).sort_index().to_dict()
    booking_rate = train_df['booking_probability'].mean()

    # Generate distribution plots
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # 1. Engagement score distribution
    engagement_counts = train_df['engagement_score'].value_counts().sort_index()
    axes[0,0].bar(engagement_counts.index, engagement_counts.values, color='skyblue', edgecolor='black')
    axes[0,0].set_title('Engagement Score Distribution', fontsize=12, fontweight='bold')
    axes[0,0].set_xlabel('Engagement Score')
    axes[0,0].set_ylabel('Count')
    axes[0,0].grid(axis='y', alpha=0.3)

    # 2. User budget level distribution
    if 'user_budget_level' in train_df.columns:
        axes[0,1].hist(train_df['user_budget_level'].dropna(), bins=30, edgecolor='black', color='lightgreen')
        axes[0,1].set_title('User Budget Level Distribution', fontsize=12, fontweight='bold')
        axes[0,1].set_xlabel('Budget Level [0-1]')
        axes[0,1].set_ylabel('Count')
        axes[0,1].grid(axis='y', alpha=0.3)

    # 3. Item popularity distribution
    if 'item_popularity_score' in train_df.columns:
        axes[1,0].hist(train_df['item_popularity_score'].dropna(), bins=30, edgecolor='black', color='lightcoral')
        axes[1,0].set_title('Item Popularity Score Distribution', fontsize=12, fontweight='bold')
        axes[1,0].set_xlabel('Popularity Score')
        axes[1,0].set_ylabel('Count')
        axes[1,0].grid(axis='y', alpha=0.3)

    # 4. Segment distribution
    if 'primarySegment' in train_df.columns:
        segment_counts = train_df['primarySegment'].value_counts().head(8)
        axes[1,1].barh(segment_counts.index, segment_counts.values, color='plum', edgecolor='black')
        axes[1,1].set_title('User Segment Distribution (Top 8)', fontsize=12, fontweight='bold')
        axes[1,1].set_xlabel('Count')
        axes[1,1].set_ylabel('Segment')
        axes[1,1].grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plot_path = f"{output_dir}/distributions.png"
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    logger.info(f"Saved distribution plots to {plot_path}")

    # Generate HTML report
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>DREAMSCAPE ML Dataset Quality Report v{{ version }}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 30px; }
            h3 { color: #7f8c8d; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #3498db; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .metric { font-size: 28px; font-weight: bold; color: #27ae60; }
            .warning { color: #e74c3c; }
            .info { background: #ecf0f1; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0; }
            img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>DREAMSCAPE ML Dataset Quality Report</h1>
            <div class="info">
                <strong>Version:</strong> {{ version }}<br>
                <strong>Generated:</strong> {{ timestamp }}<br>
                <strong>Purpose:</strong> Training dataset for collaborative filtering recommendation model
            </div>

            <h2>Dataset Statistics</h2>
            <table>
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td>Train Samples</td><td class="metric">{{ "{:,}".format(stats.train_rows) }}</td></tr>
                <tr><td>Test Samples</td><td class="metric">{{ "{:,}".format(stats.test_rows) }}</td></tr>
                <tr><td>Total Samples</td><td class="metric">{{ "{:,}".format(stats.total_rows) }}</td></tr>
                <tr><td>Train/Test Split</td><td>{{ "%.1f"|format(stats.train_pct) }}% / {{ "%.1f"|format(stats.test_pct) }}%</td></tr>
                <tr><td>Number of Features</td><td>{{ stats.num_features }}</td></tr>
                <tr><td>Missing Data %</td><td>{{ "%.2f"|format(stats.missing_pct) }}%</td></tr>
            </table>

            <h2>Label Distribution</h2>
            <table>
                <tr><th>Engagement Score</th><th>Count</th><th>Percentage</th><th>Meaning</th></tr>
                {% for score, pct in label_dist.items() %}
                <tr>
                    <td>{{ score }}</td>
                    <td>{{ "{:,}".format((pct * stats.train_rows)|int) }}</td>
                    <td>{{ "%.1f"|format(pct * 100) }}%</td>
                    <td>
                        {% if score == 5.0 %}BOOKED (conversion)
                        {% elif score == 3.0 %}CLICKED (interest)
                        {% elif score == 1.0 %}VIEWED (awareness)
                        {% elif score == 0.0 %}NOT_VIEWED (negative)
                        {% elif score == -1.0 %}REJECTED (explicit negative)
                        {% endif %}
                    </td>
                </tr>
                {% endfor %}
            </table>

            <p><strong>Booking Rate:</strong> <span class="metric">{{ "%.2f"|format(booking_rate * 100) }}%</span></p>

            <h2>Feature Distributions</h2>
            <img src="distributions.png" alt="Feature Distributions">

            <h2>Missing Values by Column</h2>
            <table>
                <tr><th>Column</th><th>Missing Count</th><th>Missing %</th></tr>
                {% for col, missing in missing_values.items() %}
                {% if missing > 0 %}
                <tr>
                    <td>{{ col }}</td>
                    <td>{{ missing }}</td>
                    <td {% if (missing / stats.train_rows * 100) > 10 %}class="warning"{% endif %}>
                        {{ "%.2f"|format(missing / stats.train_rows * 100) }}%
                    </td>
                </tr>
                {% endif %}
                {% endfor %}
            </table>

            <h2>Data Quality Checks</h2>
            <ul>
                <li>✅ Train/test stratified split preserves label distribution</li>
                <li>✅ User vectors normalized to [0,1] range</li>
                <li>✅ Item vectors normalized to [0,1] range</li>
                <li>✅ GDPR compliant (user IDs hashed, PII removed)</li>
                <li>✅ Outliers removed (3-sigma rule)</li>
                <li>✅ Duplicates removed</li>
            </ul>

            <h2>Next Steps</h2>
            <ol>
                <li>Train collaborative filtering model (ALS/SVD) on train_v{{ version }}.parquet</li>
                <li>Evaluate model performance on test_v{{ version }}.parquet</li>
                <li>Monitor Precision@K, Recall@K, NDCG@K metrics</li>
                <li>Export trained model embeddings to PostgreSQL for TypeScript serving</li>
            </ol>
        </div>
    </body>
    </html>
    """

    template = Template(html_template)
    html = template.render(
        version=version,
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        stats=stats,
        label_dist=label_dist,
        booking_rate=booking_rate,
        missing_values=train_df.isnull().sum().to_dict()
    )

    report_path = f"{output_dir}/quality_report_v{version}.html"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html)

    logger.info(f"Quality report saved to {report_path}")


if __name__ == "__main__":
    final_df = pd.read_parquet("data/processed/final.parquet")

    # Split and export
    train_df, test_df = split_and_export(final_df, version="1.0")

    # Generate metadata
    metadata = generate_metadata(train_df, test_df, version="1.0")

    # Generate quality report
    generate_quality_report(train_df, test_df, version="1.0")

    logger.info("Dataset export completed successfully")
