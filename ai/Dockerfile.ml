# DREAMSCAPE ML Training Pipeline Docker Container
# Python 3.11 for ML training and ETL

FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies for PostgreSQL and ML libraries
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY ml/requirements.txt ./ml/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ml/requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy ML pipeline code
COPY ml/ ./ml/

# Create directories for data and models
RUN mkdir -p /app/data/raw /app/data/processed /app/data/datasets /app/logs && \
    chmod -R 755 /app/data /app/logs

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DATA_DIR=/app/data \
    LOG_LEVEL=INFO

# Default command: run ETL pipeline
CMD ["python", "ml/scripts/run_etl.py"]
