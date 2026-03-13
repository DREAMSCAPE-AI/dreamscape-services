"""
US-IA-012 - ML Serving Module

Production gRPC service for serving collaborative filtering predictions.

Components:
- model_manager.py: Model loading and prediction
- grpc_server.py: gRPC service implementation

@module ml/serve
"""

from .model_manager import ModelManager, initialize_model_manager, get_model_manager

__all__ = [
    'ModelManager',
    'initialize_model_manager',
    'get_model_manager',
]
