#!/bin/bash
# DREAMSCAPE ML ETL Pipeline Runner

set -e  # Exit on error

echo "================================================================================"
echo "  DREAMSCAPE ML ETL PIPELINE"
echo "================================================================================"
echo "Starting at $(date)"
echo ""

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export PYTHONUNBUFFERED=1

# Default parameters
VERSION="${1:-1.0}"
WINDOW_DAYS="${2:-90}"

echo "Configuration:"
echo "  Dataset version: v${VERSION}"
echo "  Data window: ${WINDOW_DAYS} days"
echo "  Database: ${DATABASE_URL:-<not set>}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL environment variable not set"
    echo "   Using default: postgresql://dreamscape:password@localhost:5432/dreamscape"
    echo ""
fi

# Run ETL pipeline
echo "================================================================================"
echo "  RUNNING PIPELINE"
echo "================================================================================"
echo ""

python ml/scripts/run_etl.py --version "$VERSION" --window-days "$WINDOW_DAYS"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "================================================================================"
    echo "  ✅ ETL PIPELINE COMPLETED SUCCESSFULLY"
    echo "================================================================================"
    echo "Output: data/datasets/v${VERSION}/"
    echo ""
    echo "Files generated:"
    ls -lh "data/datasets/v${VERSION}/" 2>/dev/null || echo "  (files not found - check logs)"
    echo ""
    echo "Finished at $(date)"
    echo "================================================================================"
    exit 0
else
    echo ""
    echo "================================================================================"
    echo "  ❌ ETL PIPELINE FAILED"
    echo "================================================================================"
    echo "Check logs for details: logs/etl.log"
    echo "================================================================================"
    exit 1
fi
