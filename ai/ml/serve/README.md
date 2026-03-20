# US-IA-012 - ML gRPC Serving Service

Production-ready gRPC service for serving SVD collaborative filtering recommendations.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              gRPC Server (Port 50051)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ RecommendationServiceServicer                      │  │
│  │  ├─ GetRecommendations(user_id, top_k) → items    │  │
│  │  ├─ HealthCheck() → status                         │  │
│  │  └─ GetModelInfo() → metadata                      │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                 │
│         ┌───────────────┴──────────────┐                 │
│         ▼                               ▼                 │
│  ┌──────────────┐              ┌──────────────┐          │
│  │ ModelManager │              │ Redis Cache  │          │
│  │  - Load SVD  │              │  TTL: 1h     │          │
│  │  - Predict   │              │  Hit: 85%+   │          │
│  └──────────────┘              └──────────────┘          │
└──────────────────────────────────────────────────────────┘
```

## Features

- ✅ **Fast inference**: <50ms cold, <20ms cached
- ✅ **High cache hit rate**: 85%+ with Redis
- ✅ **Model versioning**: Support v1.0, v1.1, etc.
- ✅ **Health checks**: gRPC health probe compatible
- ✅ **Error handling**: Graceful fallback for cold start users
- ✅ **Production-ready**: Docker, logging, monitoring

## Quick Start

### 1. Build Docker Image

```bash
cd dreamscape-services/ai

docker build -f ml/Dockerfile.serve -t dreamscape-ml-service:v1.0 .
```

### 2. Run Service

```bash
docker run -d \
  --name ml-service \
  -p 50051:50051 \
  -v $(pwd)/ml/models:/app/models:ro \
  -e REDIS_HOST=redis \
  -e DEFAULT_MODEL_VERSION=v1.0 \
  dreamscape-ml-service:v1.0
```

### 3. Test Service

```bash
# Health check
grpcurl -plaintext localhost:50051 dreamscape.ml.RecommendationService/HealthCheck

# Get recommendations
grpcurl -plaintext -d '{"user_id":"user-123","top_k":10}' \
  localhost:50051 dreamscape.ml.RecommendationService/GetRecommendations
```

## Model Structure

Place trained models in the following structure:

```
models/
├── v1.0/
│   ├── model.pkl          # Joblib model file (required)
│   └── metadata.json      # Optional training metadata
└── v1.1/
    ├── model.pkl
    └── metadata.json
```

### model.pkl Structure

The joblib file must contain a dictionary with:

```python
{
    'user_factors': np.ndarray,    # (n_users, n_factors)
    'item_factors': np.ndarray,    # (n_items, n_factors)
    'user_ids': List[str],         # User ID mapping
    'item_ids': List[str],         # Item ID mapping
    'model_type': str,             # e.g., "SVD"
    'trained_at': str,             # ISO timestamp
    'hyperparameters': dict,       # Training config
    'metrics': dict,               # Offline NDCG, etc.
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `CACHE_TTL` | `3600` | Cache TTL in seconds (1h) |
| `MODELS_DIR` | `/app/models` | Directory containing models |
| `DEFAULT_MODEL_VERSION` | `v1.0` | Model to load at startup |
| `GRPC_PORT` | `50051` | gRPC server port |
| `GRPC_MAX_WORKERS` | `10` | Thread pool size |

## API Reference

### GetRecommendations

Get personalized top-K recommendations for a user.

**Request:**
```protobuf
message RecommendationRequest {
  string user_id = 1;
  repeated string exclude_seen = 2;
  int32 top_k = 3;
  string model_version = 4;
}
```

**Response:**
```protobuf
message RecommendationResponse {
  repeated ScoredItem items = 1;
  string model_version = 2;
  int32 inference_time_ms = 3;
  bool from_cache = 4;
}

message ScoredItem {
  string item_id = 1;
  float score = 2;
}
```

**Example:**
```bash
grpcurl -d '{
  "user_id": "user-123",
  "top_k": 20,
  "exclude_seen": ["hotel-456"],
  "model_version": "v1.0"
}' localhost:50051 dreamscape.ml.RecommendationService/GetRecommendations
```

### HealthCheck

Check service health status.

**Response:**
```protobuf
message HealthCheckResponse {
  Status status = 1;          // SERVING, NOT_SERVING
  bool model_ready = 2;
  bool cache_connected = 3;
  int64 uptime_seconds = 4;
}
```

### GetModelInfo

Get metadata about loaded model.

**Response:**
```protobuf
message ModelInfoResponse {
  string model_version = 1;
  int32 num_users = 3;
  int32 num_items = 4;
  string model_type = 5;
  map<string, float> metrics = 7;
}
```

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold inference | <50ms | Model prediction only |
| Cached response | <20ms | Redis lookup |
| Cache hit rate | 85%+ | After warmup (1h) |
| p95 latency | <70ms | End-to-end |

## Monitoring

### Logs

```bash
# View logs
docker logs -f ml-service

# Expected output
[2024-01-15 10:00:00] INFO - Model v1.0 loaded successfully
[2024-01-15 10:00:00] INFO - Connected to Redis at redis:6379
[2024-01-15 10:00:00] INFO - gRPC server started on port 50051
```

### Metrics

Key metrics to monitor:

- `inference_time_ms`: ML prediction latency
- `cache_hit_rate`: Redis cache efficiency
- `requests_per_second`: Traffic volume
- `error_rate`: Failed requests

## Troubleshooting

### Error: "User not found in model (cold start)"

**Cause**: User ID not in training data.

**Solution**: Use fallback recommendations (rule-based scoring).

### Error: "Redis cache unavailable"

**Cause**: Cannot connect to Redis.

**Solution**: Service continues without cache. Check Redis connectivity.

### Error: "Model file not found"

**Cause**: Model file missing or path incorrect.

**Solution**: Verify model file exists at `/app/models/{version}/model.pkl`

## Integration with TypeScript API

See [US-IA-013](../../src/services/MLGrpcClient.ts) for TypeScript client implementation.

```typescript
import { MLGrpcClient } from '@/services/MLGrpcClient';

const mlClient = new MLGrpcClient('localhost:50051');

const predictions = await mlClient.getRecommendations({
  userId: 'user-123',
  topK: 20,
  excludeSeen: ['hotel-456'],
});
```

## Development

### Running locally (without Docker)

```bash
# Install dependencies
pip install -r requirements.txt
pip install grpcio grpcio-tools redis

# Generate protobuf code
python -m grpc_tools.protoc \
  -I./proto \
  --python_out=./proto \
  --grpc_python_out=./proto \
  ./proto/recommendation.proto

# Start server
export MODELS_DIR=./models
export REDIS_HOST=localhost
python ml/serve/grpc_server.py
```

### Testing

```bash
# Run integration tests
python ml/test/test_grpc_client.py

# Expected output:
# ✅ PASS - Health Check
# ✅ PASS - Get Model Info
# ✅ PASS - Get Recommendations
# Total: 3/3 tests passed
```

## Related Tickets

- **US-IA-008**: ML training pipeline (model.py, train_model.py)
- **US-IA-012**: gRPC ML service (this)
- **US-IA-013**: TypeScript gRPC client
- **US-IA-014**: A/B testing framework

## License

MIT - Dreamscape AI Team
