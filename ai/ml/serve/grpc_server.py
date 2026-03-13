"""
US-IA-012 - gRPC Recommendation Server

Production-ready gRPC server for serving SVD collaborative filtering predictions.

Features:
- Loads model at startup via ModelManager
- Redis caching (85%+ hit rate target)
- Health checks and monitoring
- Request timeout handling
- Error recovery and fallback

Server: dreamscape-ml-service
Port: 50051

Usage:
    python grpc_server.py

@module ml/serve
"""

import os
import sys
import time
import json
import logging
from concurrent import futures
from typing import Optional

import grpc
import redis
from google.protobuf import json_format

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from serve.model_manager import ModelManager, initialize_model_manager

# Import generated protobuf code (will be generated from .proto)
# TODO: Generate with: python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. proto/recommendation.proto
try:
    import proto.recommendation_pb2 as pb2
    import proto.recommendation_pb2_grpc as pb2_grpc
except ImportError:
    logger.error("Protobuf code not generated. Run: python -m grpc_tools.protoc ...")
    raise

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))
CACHE_TTL = int(os.getenv('CACHE_TTL', '3600'))  # 1 hour
MODELS_DIR = os.getenv('MODELS_DIR', '/app/models')
DEFAULT_MODEL_VERSION = os.getenv('DEFAULT_MODEL_VERSION', 'v1.0')
SERVER_PORT = int(os.getenv('GRPC_PORT', '50051'))
MAX_WORKERS = int(os.getenv('GRPC_MAX_WORKERS', '10'))


class RecommendationServiceServicer(pb2_grpc.RecommendationServiceServicer):
    """
    gRPC service implementation for ML recommendations.
    """

    def __init__(self):
        """Initialize service with ModelManager and Redis cache."""
        self.model_manager = initialize_model_manager(models_dir=MODELS_DIR)
        self.start_time = time.time()

        # Redis cache connection
        try:
            self.cache = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=False,  # Store binary data
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            self.cache.ping()
            logger.info(f"✅ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
            self.cache_available = True
        except Exception as e:
            logger.warning(f"⚠️  Redis cache unavailable: {e}. Running without cache.")
            self.cache = None
            self.cache_available = False

        # Load default model
        try:
            self.model_manager.load_model(DEFAULT_MODEL_VERSION)
            logger.info(f"✅ Model {DEFAULT_MODEL_VERSION} loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load model {DEFAULT_MODEL_VERSION}: {e}")
            raise

    def GetRecommendations(
        self,
        request: pb2.RecommendationRequest,
        context: grpc.ServicerContext
    ) -> pb2.RecommendationResponse:
        """
        Get personalized recommendations for a user.

        Flow:
        1. Check Redis cache (key: "pred:{user_id}:{top_k}:{model_version}")
        2. If cache miss: Generate predictions via ModelManager
        3. Cache result and return

        Args:
            request: RecommendationRequest protobuf
            context: gRPC context

        Returns:
            RecommendationResponse with scored items
        """
        user_id = request.user_id
        top_k = request.top_k or 20
        model_version = request.model_version or self.model_manager.active_version
        exclude_seen = set(request.exclude_seen) if request.exclude_seen else None

        logger.debug(f"GetRecommendations for user={user_id}, top_k={top_k}, version={model_version}")

        # Build cache key
        exclude_hash = hash(frozenset(exclude_seen)) if exclude_seen else 0
        cache_key = f"pred:{user_id}:{top_k}:{model_version}:{exclude_hash}"

        # Check cache
        from_cache = False
        if self.cache_available and self.cache:
            try:
                cached = self.cache.get(cache_key)
                if cached:
                    logger.debug(f"🎯 Cache HIT for {cache_key}")
                    response = pb2.RecommendationResponse()
                    response.ParseFromString(cached)
                    response.from_cache = True
                    return response
            except Exception as e:
                logger.warning(f"Cache read error: {e}")

        # Cache miss: Generate predictions
        logger.debug(f"Cache MISS for {cache_key}")

        start_time = time.time()
        warnings = []

        try:
            # Get predictions from model
            predictions = self.model_manager.predict_for_user(
                user_id=user_id,
                exclude_seen=exclude_seen,
                top_k=top_k,
                model_version=model_version
            )

            inference_time_ms = int((time.time() - start_time) * 1000)

            # Build response
            items = [
                pb2.ScoredItem(
                    item_id=item_id,
                    score=score,
                    confidence=0.8  # TODO: Calculate actual confidence
                )
                for item_id, score in predictions
            ]

            response = pb2.RecommendationResponse(
                items=items,
                model_version=model_version,
                inference_time_ms=inference_time_ms,
                from_cache=False,
                total_candidates=len(predictions),
                warnings=warnings
            )

            # Cache result
            if self.cache_available and self.cache:
                try:
                    self.cache.setex(
                        cache_key,
                        CACHE_TTL,
                        response.SerializeToString()
                    )
                    logger.debug(f"💾 Cached result for {cache_key} (TTL={CACHE_TTL}s)")
                except Exception as e:
                    logger.warning(f"Cache write error: {e}")

            logger.info(f"✅ Generated {len(items)} predictions for {user_id} in {inference_time_ms}ms")

            return response

        except ValueError as e:
            # Cold start user (not in training data)
            logger.warning(f"Cold start user: {user_id}")
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"User {user_id} not found in model (cold start)")
            return pb2.RecommendationResponse(
                items=[],
                model_version=model_version,
                from_cache=False,
                warnings=[f"Cold start user: {user_id}"]
            )

        except Exception as e:
            # Internal error
            logger.error(f"Prediction error for {user_id}: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Prediction failed: {str(e)}")
            return pb2.RecommendationResponse(items=[], warnings=[str(e)])

    def HealthCheck(
        self,
        request: pb2.HealthCheckRequest,
        context: grpc.ServicerContext
    ) -> pb2.HealthCheckResponse:
        """
        Health check endpoint for monitoring.

        Returns:
            HealthCheckResponse with service status
        """
        model_ready = self.model_manager.is_ready()
        cache_connected = self.cache_available

        if model_ready:
            status = pb2.HealthCheckResponse.SERVING
        else:
            status = pb2.HealthCheckResponse.NOT_SERVING

        uptime = int(time.time() - self.start_time)

        # Metadata
        metadata = {
            'active_model': self.model_manager.active_version or 'none',
            'cache_host': REDIS_HOST,
            'models_dir': MODELS_DIR,
        }

        return pb2.HealthCheckResponse(
            status=status,
            model_ready=model_ready,
            cache_connected=cache_connected,
            uptime_seconds=uptime,
            metadata=metadata
        )

    def GetModelInfo(
        self,
        request: pb2.ModelInfoRequest,
        context: grpc.ServicerContext
    ) -> pb2.ModelInfoResponse:
        """
        Get information about loaded model.

        Args:
            request: ModelInfoRequest
            context: gRPC context

        Returns:
            ModelInfoResponse with model metadata
        """
        try:
            model_version = request.model_version or self.model_manager.active_version
            info = self.model_manager.get_model_info(version=model_version)

            # Convert metrics dict to protobuf map
            hyperparameters = {k: str(v) for k, v in info['hyperparameters'].items()}
            metrics = {k: float(v) for k, v in info['metrics'].items()}

            return pb2.ModelInfoResponse(
                model_version=info['model_version'],
                trained_at=info.get('trained_at', 'unknown'),
                num_users=info['n_users'],
                num_items=info['n_items'],
                model_type=info['model_type'],
                hyperparameters=hyperparameters,
                metrics=metrics
            )

        except Exception as e:
            logger.error(f"GetModelInfo error: {e}")
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(str(e))
            return pb2.ModelInfoResponse()


def serve():
    """
    Start gRPC server.

    Blocks until interrupted (Ctrl+C).
    """
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=MAX_WORKERS),
        options=[
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.max_send_message_length', 50 * 1024 * 1024),
        ]
    )

    # Add service
    pb2_grpc.add_RecommendationServiceServicer_to_server(
        RecommendationServiceServicer(),
        server
    )

    # Start server
    server.add_insecure_port(f'[::]:{SERVER_PORT}')
    server.start()

    logger.info(f"🚀 gRPC server started on port {SERVER_PORT}")
    logger.info(f"   - Workers: {MAX_WORKERS}")
    logger.info(f"   - Models dir: {MODELS_DIR}")
    logger.info(f"   - Redis: {REDIS_HOST}:{REDIS_PORT}")
    logger.info(f"   - Cache TTL: {CACHE_TTL}s")
    logger.info("")
    logger.info("Ready to serve predictions ✨")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down gRPC server...")
        server.stop(grace=5)
        logger.info("Server stopped.")


if __name__ == '__main__':
    serve()
