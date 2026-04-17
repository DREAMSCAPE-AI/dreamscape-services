"""
US-IA-008 - Modèle de Collaborative Filtering (SVD)

Architecture :
  - Matrix Factorization via TruncatedSVD (scikit-learn)
  - Factorisation de la matrice user-item en facteurs latents
  - Prédiction = produit scalaire des facteurs user × item

Pourquoi SVD vs ALS ?
  SVD (via sklearn) : simple, rapide, pas de dépendances externes.
  ALS (via implicit) : meilleur pour grandes matrices sparses.
  Pour le MVP avec ~1K users, SVD suffit largement.
"""

import logging
from pathlib import Path

import joblib
import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


class RecommendationModel:
    """
    Modèle SVD pour le collaborative filtering.

    Décompose la matrice user-item R ≈ U × Σ × Vᵀ
      - U  : facteurs latents utilisateurs  (n_users × n_factors)
      - Vᵀ : facteurs latents items         (n_factors × n_items)
    """

    def __init__(self, n_factors: int = 50, random_state: int = 42):
        self.n_factors = n_factors
        self.random_state = random_state
        self.svd = TruncatedSVD(n_components=n_factors, random_state=random_state)

        # Remplis après fit()
        self.user_factors: np.ndarray | None = None
        self.item_factors: np.ndarray | None = None
        self.user_index: dict | None = None
        self.item_index: dict | None = None
        self.item_ids: list | None = None

    def fit(
        self,
        matrix: np.ndarray,
        user_index: dict,
        item_index: dict,
    ) -> None:
        """
        Entraîne le modèle SVD sur la matrice user-item.

        Args:
            matrix     : np.ndarray (n_users, n_items) de ratings implicites
            user_index : {user_id -> row_index}
            item_index : {item_id -> col_index}
        """
        logger.info(f"Entraînement SVD (n_factors={self.n_factors}) sur matrice {matrix.shape}")

        # Factorisation : user_factors = U × Σ, item_factors = Vᵀ
        self.user_factors = self.svd.fit_transform(matrix)
        self.item_factors = self.svd.components_  # shape: (n_factors, n_items)

        # Normalisation L2 pour que le produit scalaire ≈ cosine similarity
        self.user_factors = normalize(self.user_factors, norm="l2")
        self.item_factors = normalize(self.item_factors.T, norm="l2")  # (n_items, n_factors)

        self.user_index = user_index
        self.item_index = item_index
        self.item_ids = list(item_index.keys())

        explained = self.svd.explained_variance_ratio_.sum()
        logger.info(f"SVD fit terminé — variance expliquée : {explained:.2%}")

    def predict_for_user(
        self,
        user_id: str,
        exclude_seen: set | None = None,
        top_k: int = 20,
    ) -> list[tuple[str, float]]:
        """
        Génère les top_k recommandations pour un utilisateur.

        Args:
            user_id      : ID de l'utilisateur
            exclude_seen : item_ids déjà vus/bookés à exclure
            top_k        : nombre de recommandations à retourner

        Returns:
            Liste de (item_id, score) triée par score décroissant
        """
        if self.user_factors is None:
            raise RuntimeError("Le modèle n'est pas encore entraîné. Appeler fit() d'abord.")

        row = self.user_index.get(user_id)
        if row is None:
            logger.warning(f"User {user_id} inconnu du modèle (cold start)")
            return []

        user_vec = self.user_factors[row]  # (n_factors,)
        scores = self.item_factors @ user_vec  # (n_items,) via produit scalaire

        # Exclure les items déjà interagis
        if exclude_seen:
            for item_id in exclude_seen:
                col = self.item_index.get(item_id)
                if col is not None:
                    scores[col] = -np.inf

        # Top-K par score décroissant
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(self.item_ids[i], float(scores[i])) for i in top_indices]

    def save(self, version: str = "v1.0") -> Path:
        """
        Sauvegarde le modèle sur disque (format joblib).

        Sauvegarde un dictionnaire avec les composants essentiels pour le serving,
        compatible avec model_manager.py qui attend {user_factors, item_factors, user_ids, item_ids}.
        """
        path = MODELS_DIR / f"recommendation_model_{version}.pkl"

        # Format dict pour compatibilité avec model_manager.py
        model_data = {
            'user_factors': self.user_factors,
            'item_factors': self.item_factors,
            'user_ids': list(self.user_index.keys()),
            'item_ids': self.item_ids,
            'user_index': self.user_index,
            'item_index': self.item_index,
            'n_users': len(self.user_index),
            'n_items': len(self.item_index),
            'n_factors': self.n_factors,
            'model_type': 'SVD',
            'version': version,
        }

        joblib.dump(model_data, path)
        logger.info(f"Modèle sauvegardé : {path}")
        return path

    @classmethod
    def load(cls, version: str = "v1.0") -> "RecommendationModel":
        """Charge un modèle depuis disque."""
        path = MODELS_DIR / f"recommendation_model_{version}.pkl"
        model = joblib.load(path)
        logger.info(f"Modèle chargé : {path}")
        return model
