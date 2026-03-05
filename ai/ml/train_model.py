"""
US-IA-008 - Pipeline d'Entraînement du Modèle ML
Dreamscape AI Service — Livrable principal du ticket DR-415

Pipeline complet :
  1. Chargement des données (Parquet ETL DR-414 ou PostgreSQL en fallback)
  2. Construction de la matrice user-item
  3. Split train/validation 80/20 (leave-one-out)
  4. Entraînement SVD (Matrix Factorization)
  5. Évaluation (Precision@10, Recall@10, NDCG@10)
  6. Sauvegarde du modèle si seuil de qualité atteint (ndcg@10 >= 0.7)
  7. Logging MLflow

Usage :
  python train_model.py                              # charge depuis PostgreSQL
  python train_model.py --dataset-version 1.0        # charge depuis Parquet ETL
  python train_model.py --version v1.1 --n-factors 100 --k 10
"""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

import mlflow
import numpy as np
import pandas as pd

from data_loader import (
    build_interaction_matrix,
    load_from_parquet,
    load_interactions,
    load_item_vectors,
    load_user_vectors,
)
from metrics import evaluate_model
from model import RecommendationModel

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("train_model")

# ─── Seuil de qualité minimum pour sauvegarder le modèle ─────────────────────

NDCG_THRESHOLD = 0.7


# ─── Helpers ──────────────────────────────────────────────────────────────────


def train_val_split(
    interactions,
    val_ratio: float = 0.2,
    random_state: int = 42,
) -> tuple:
    """
    Split train/validation 80/20 au niveau utilisateur.

    Pour chaque user ayant ≥ 2 interactions positives, le dernier item
    interagi positivement est mis en validation (leave-one-out).
    Le reste sert à l'entraînement.

    Returns:
        train_df : interactions d'entraînement
        val_gt   : {user_id -> set(item_id)} ground truth validation
    """
    rng = np.random.default_rng(random_state)
    positive = interactions[interactions["rating"] > 0].copy()

    val_rows = []
    train_mask = np.ones(len(interactions), dtype=bool)

    for user_id, group in positive.groupby("user_id"):
        if len(group) < 2:
            continue

        # Sélection aléatoire d'un item pour la validation
        val_idx = rng.choice(group.index)
        val_rows.append((user_id, interactions.loc[val_idx, "item_id"]))
        train_mask[val_idx] = False

    train_df = interactions[train_mask].reset_index(drop=True)
    val_gt = {}
    for user_id, item_id in val_rows:
        val_gt.setdefault(user_id, set()).add(item_id)

    logger.info(
        f"Split — train: {len(train_df)} interactions, "
        f"val: {len(val_gt)} users avec ground truth"
    )
    return train_df, val_gt


def generate_predictions(
    model: RecommendationModel,
    user_ids: list,
    train_interactions,
    k: int,
) -> dict[str, list]:
    """
    Génère les top-k prédictions pour chaque utilisateur de validation.

    Les items vus en train sont exclus des recommandations.
    """
    # Construit le set d'items vus par user (depuis le train)
    seen_per_user = (
        train_interactions[train_interactions["rating"] > 0]
        .groupby("user_id")["item_id"]
        .apply(set)
        .to_dict()
    )

    predictions = {}
    for user_id in user_ids:
        exclude = seen_per_user.get(user_id, set())
        recs = model.predict_for_user(user_id, exclude_seen=exclude, top_k=k)
        predictions[user_id] = [item_id for item_id, _ in recs]

    return predictions


# ─── Pipeline principal ───────────────────────────────────────────────────────


def run_training(version: str, n_factors: int, k: int, dataset_version: str | None = None) -> dict:
    """
    Exécute le pipeline complet d'entraînement et retourne les métriques.

    Args:
        version         : version du modèle (ex: "v1.0")
        n_factors       : nombre de facteurs latents SVD
        k               : cutoff des métriques (Precision@k, Recall@k, NDCG@k)
        dataset_version : si fourni, charge depuis le Parquet ETL DR-414
                          (ex: "1.0") ; sinon charge depuis PostgreSQL
    """
    logger.info(f"=== Démarrage pipeline US-IA-008 — modèle {version} ===")
    run_name = f"dreamscape-svd-{version}-{datetime.now():%Y%m%d_%H%M}"

    mlflow.set_experiment("dreamscape-recommendation")

    with mlflow.start_run(run_name=run_name):
        # ── 1. Chargement des données ──────────────────────────────────────
        logger.info("Étape 1/6 — Chargement des données")

        if dataset_version is not None:
            logger.info(f"Source : Parquet ETL (dataset v{dataset_version})")
            interactions = load_from_parquet(dataset_version)
            user_ids = interactions["user_id"].unique().tolist()
            item_ids = interactions["item_id"].unique().tolist()
            # DataFrames légers juste pour les comptages MLflow
            user_df = pd.DataFrame({"user_id": user_ids})
            item_df = pd.DataFrame({"item_id": item_ids})
        else:
            logger.info("Source : PostgreSQL (chargement direct)")
            user_df = load_user_vectors()
            item_df = load_item_vectors()
            interactions = load_interactions()
            user_ids = user_df["user_id"].tolist()
            item_ids = item_df["item_id"].tolist()

        if interactions.empty:
            logger.warning("Aucune interaction trouvée — impossible d'entraîner le modèle.")
            logger.warning("Vérifiez que US-IA-007 (Dataset) est bien complété.")
            sys.exit(1)

        mlflow.log_params({
            "n_users": user_df["user_id"].nunique(),
            "n_items": item_df["item_id"].nunique(),
            "n_interactions": len(interactions),
            "n_factors": n_factors,
            "k": k,
            "version": version,
        })

        # ── 2. Split train/validation ──────────────────────────────────────
        logger.info("Étape 2/6 — Split train/validation 80/20")
        train_df, val_gt = train_val_split(interactions, val_ratio=0.2)

        # ── 3. Construction de la matrice user-item ───────────────────────
        logger.info("Étape 3/6 — Construction de la matrice user-item")
        train_matrix, user_index, item_index = build_interaction_matrix(
            train_df, user_ids, item_ids
        )

        density = (train_matrix != 0).sum() / train_matrix.size
        mlflow.log_metric("matrix_density", density)
        logger.info(f"Matrice {train_matrix.shape} — densité {density:.4%}")

        # ── 4. Entraînement ───────────────────────────────────────────────
        logger.info(f"Étape 4/6 — Entraînement SVD (n_factors={n_factors})")
        model = RecommendationModel(n_factors=n_factors)
        model.fit(train_matrix, user_index, item_index)

        explained = model.svd.explained_variance_ratio_.sum()
        mlflow.log_metric("explained_variance", explained)
        logger.info(f"Variance expliquée par les {n_factors} facteurs : {explained:.2%}")

        # ── 5. Évaluation ─────────────────────────────────────────────────
        logger.info(f"Étape 5/6 — Évaluation sur validation (k={k})")
        val_users = list(val_gt.keys())
        predictions = generate_predictions(model, val_users, train_df, k=k)

        metrics = evaluate_model(predictions, val_gt, k=k)
        mlflow.log_metrics(metrics)

        logger.info("─── Métriques de validation ───────────────────────")
        for name, value in metrics.items():
            logger.info(f"  {name:20s} = {value:.4f}")
        logger.info("───────────────────────────────────────────────────")

        # ── 6. Sauvegarde conditionnelle ──────────────────────────────────
        ndcg_score = metrics.get(f"ndcg_at_{k}", 0.0)

        if ndcg_score >= NDCG_THRESHOLD:
            logger.info(
                f"Étape 6/6 — NDCG@{k}={ndcg_score:.4f} ≥ {NDCG_THRESHOLD} "
                f"→ Sauvegarde du modèle {version}"
            )
            model_path = model.save(version=version)
            mlflow.log_artifact(str(model_path))
            mlflow.log_param("model_saved", True)
        else:
            logger.warning(
                f"Étape 6/6 — NDCG@{k}={ndcg_score:.4f} < {NDCG_THRESHOLD} "
                f"→ Modèle non sauvegardé (qualité insuffisante)"
            )
            mlflow.log_param("model_saved", False)

        logger.info(f"=== Pipeline terminé — run MLflow : {run_name} ===")
        return metrics


# ─── Point d'entrée ───────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="US-IA-008 — Pipeline d'entraînement du modèle de recommandation"
    )
    parser.add_argument(
        "--version",
        default="v1.0",
        help="Version du modèle à entraîner (défaut: v1.0)",
    )
    parser.add_argument(
        "--n-factors",
        type=int,
        default=50,
        help="Nombre de facteurs latents SVD (défaut: 50)",
    )
    parser.add_argument(
        "--k",
        type=int,
        default=10,
        help="Cutoff pour les métriques Precision/Recall/NDCG (défaut: 10)",
    )
    parser.add_argument(
        "--dataset-version",
        default=None,
        help="Version du dataset ETL DR-414 à charger depuis Parquet (ex: 1.0). "
             "Sans cet argument, charge directement depuis PostgreSQL.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_training(
        version=args.version,
        n_factors=args.n_factors,
        k=args.k,
        dataset_version=args.dataset_version,
    )
