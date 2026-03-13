"""
US-IA-012 - ML Model Manager

Loads and manages SVD collaborative filtering models for real-time serving.

Features:
- Model loading from joblib (.pkl) files
- Version management (v1.0, v1.1, etc.)
- Hot reload capability
- Prediction interface for gRPC service
- Cold start handling

@module ml/serve
"""

import os
import joblib
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ModelManager:
    """
    Manages ML models for recommendation serving.

    Responsibilities:
    - Load model from disk at startup
    - Provide prediction interface
    - Handle model versioning
    - Support hot reload
    """

    def __init__(self, models_dir: str = "/app/models"):
        """
        Initialize ModelManager.

        Args:
            models_dir: Directory containing model files
        """
        self.models_dir = Path(models_dir)
        self.models: Dict[str, Dict] = {}  # version -> model_data
        self.active_version: Optional[str] = None
        self.loaded_at: Optional[datetime] = None

        logger.info(f"ModelManager initialized with models_dir: {models_dir}")

    def load_model(self, version: str = "v1.0") -> bool:
        """
        Load a specific model version from disk.

        Expected file structure:
            models/
                v1.0/
                    model.pkl         (main model object)
                    metadata.json     (optional: training info)

        Args:
            version: Model version to load (e.g., "v1.0")

        Returns:
            True if loaded successfully

        Raises:
            FileNotFoundError: If model file doesn't exist
            Exception: If model loading fails
        """
        model_path = self.models_dir / version / "model.pkl"

        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        logger.info(f"Loading model {version} from {model_path}")

        try:
            # Load model with joblib
            model_data = joblib.load(model_path)

            # Validate model structure
            self._validate_model(model_data)

            # Store model
            self.models[version] = model_data
            self.active_version = version
            self.loaded_at = datetime.now()

            logger.info(f"✅ Model {version} loaded successfully")
            logger.info(f"   - Users: {model_data.get('n_users', 'unknown')}")
            logger.info(f"   - Items: {model_data.get('n_items', 'unknown')}")
            logger.info(f"   - Model type: {model_data.get('model_type', 'SVD')}")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to load model {version}: {e}")
            raise

    def _validate_model(self, model_data: Dict) -> None:
        """
        Validate loaded model has required fields.

        Args:
            model_data: Loaded model dictionary

        Raises:
            ValueError: If model is invalid
        """
        required_fields = [
            'user_factors',    # User embeddings (n_users x n_factors)
            'item_factors',    # Item embeddings (n_items x n_factors)
            'user_ids',        # User ID mapping
            'item_ids',        # Item ID mapping
        ]

        for field in required_fields:
            if field not in model_data:
                raise ValueError(f"Model missing required field: {field}")

        # Validate dimensions
        n_users = model_data['user_factors'].shape[0]
        n_items = model_data['item_factors'].shape[0]
        n_factors = model_data['user_factors'].shape[1]

        assert model_data['item_factors'].shape[1] == n_factors, \
            "User and item factors must have same dimension"

        logger.debug(f"Model validation passed: {n_users} users, {n_items} items, {n_factors} factors")

    def predict_for_user(
        self,
        user_id: str,
        exclude_seen: Optional[Set[str]] = None,
        top_k: int = 20,
        model_version: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        """
        Generate top-K predictions for a user.

        Algorithm:
        1. Get user embedding from model
        2. Compute scores: item_factors @ user_vector
        3. Filter out exclude_seen items
        4. Return top-K (item_id, score) pairs

        Args:
            user_id: User ID (must exist in training data)
            exclude_seen: Item IDs to exclude from results
            top_k: Number of recommendations to return
            model_version: Specific version to use (default: active)

        Returns:
            List of (item_id, score) tuples, sorted by score descending

        Raises:
            ValueError: If user_id not found in model
            RuntimeError: If no model loaded
        """
        # Get model
        version = model_version or self.active_version
        if version not in self.models:
            raise RuntimeError(f"Model {version} not loaded")

        model = self.models[version]

        # Get user index
        user_ids = model['user_ids']
        if user_id not in user_ids:
            raise ValueError(f"User '{user_id}' not found in model (cold start)")

        user_idx = user_ids.index(user_id)

        # Get user embedding
        user_vector = model['user_factors'][user_idx]  # shape: (n_factors,)

        # Compute scores for all items
        item_factors = model['item_factors']  # shape: (n_items, n_factors)
        scores = item_factors @ user_vector  # shape: (n_items,)

        # Build (item_id, score) pairs
        item_ids = model['item_ids']
        predictions = []

        for item_idx, score in enumerate(scores):
            item_id = item_ids[item_idx]

            # Filter excluded items
            if exclude_seen and item_id in exclude_seen:
                continue

            predictions.append((item_id, float(score)))

        # Sort by score descending and take top-K
        predictions.sort(key=lambda x: x[1], reverse=True)
        top_predictions = predictions[:top_k]

        logger.debug(f"Generated {len(top_predictions)} predictions for user {user_id}")

        return top_predictions

    def get_model_info(self, version: Optional[str] = None) -> Dict:
        """
        Get metadata about a loaded model.

        Args:
            version: Model version (default: active)

        Returns:
            Dictionary with model metadata
        """
        version = version or self.active_version
        if version not in self.models:
            raise ValueError(f"Model {version} not loaded")

        model = self.models[version]

        return {
            'model_version': version,
            'model_type': model.get('model_type', 'SVD'),
            'n_users': len(model['user_ids']),
            'n_items': len(model['item_ids']),
            'n_factors': model['user_factors'].shape[1],
            'trained_at': model.get('trained_at', 'unknown'),
            'hyperparameters': model.get('hyperparameters', {}),
            'metrics': model.get('metrics', {}),
            'loaded_at': self.loaded_at.isoformat() if self.loaded_at else None,
        }

    def is_ready(self) -> bool:
        """Check if at least one model is loaded and ready."""
        return self.active_version is not None and len(self.models) > 0

    def list_available_versions(self) -> List[str]:
        """List all model versions available on disk."""
        versions = []

        if not self.models_dir.exists():
            return versions

        for version_dir in self.models_dir.iterdir():
            if version_dir.is_dir():
                model_file = version_dir / "model.pkl"
                if model_file.exists():
                    versions.append(version_dir.name)

        return sorted(versions)

    def reload_model(self, version: Optional[str] = None) -> bool:
        """
        Hot reload a model (useful for A/B testing or updates).

        Args:
            version: Version to reload (default: current active)

        Returns:
            True if reload successful
        """
        version = version or self.active_version

        if version is None:
            raise ValueError("No version specified and no active model")

        logger.info(f"🔄 Hot reloading model {version}")

        # Remove from cache
        if version in self.models:
            del self.models[version]

        # Reload
        return self.load_model(version)


# Global model manager instance (initialized in gRPC server)
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """Get global ModelManager instance."""
    global _model_manager
    if _model_manager is None:
        raise RuntimeError("ModelManager not initialized. Call initialize_model_manager() first.")
    return _model_manager


def initialize_model_manager(models_dir: str = "/app/models") -> ModelManager:
    """
    Initialize global ModelManager instance.

    Args:
        models_dir: Directory containing model files

    Returns:
        Initialized ModelManager
    """
    global _model_manager
    _model_manager = ModelManager(models_dir=models_dir)
    return _model_manager
