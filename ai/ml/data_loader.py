"""
US-IA-008 - Data Loader
Charge les données pour l'entraînement du modèle ML.

Sources supportées :
  1. Parquet (recommandé) : sortie du pipeline ETL DR-414 (Paulin)
       /app/data/datasets/v{version}/train_v{version}.parquet
  2. PostgreSQL (fallback) : chargement direct depuis les tables
       user_vectors, item_vectors, recommendations, favorites
"""

import os
import json
import logging

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Poids du feedback implicite par type d'interaction
INTERACTION_WEIGHTS = {
    "BOOKED": 5.0,
    "CLICKED": 1.0,
    "VIEWED": 0.3,
    "REJECTED": -1.0,
    "FAVORITE": 3.0,
}


def _get_connection():
    """Ouvre une connexion PostgreSQL depuis DATABASE_URL."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise EnvironmentError("DATABASE_URL non définie dans .env")
    return psycopg2.connect(url)


def load_user_vectors() -> pd.DataFrame:
    """
    Charge tous les UserVector depuis la DB.
    Retourne un DataFrame avec colonnes : user_id, vector (list[float])
    """
    query = """
        SELECT "userId" AS user_id, vector
        FROM user_vectors
    """
    with _get_connection() as conn:
        df = pd.read_sql(query, conn)

    df["vector"] = df["vector"].apply(
        lambda v: json.loads(v) if isinstance(v, str) else v
    )
    logger.info(f"Chargé {len(df)} user vectors")
    return df


def load_item_vectors() -> pd.DataFrame:
    """
    Charge tous les ItemVector depuis la DB.
    Retourne un DataFrame avec colonnes :
      item_id, destination_type, name, vector, popularity_score
    """
    query = """
        SELECT
            id               AS item_id,
            "destinationId"  AS destination_id,
            "destinationType" AS destination_type,
            name,
            vector,
            "popularityScore" AS popularity_score,
            "bookingCount"    AS booking_count
        FROM item_vectors
    """
    with _get_connection() as conn:
        df = pd.read_sql(query, conn)

    df["vector"] = df["vector"].apply(
        lambda v: json.loads(v) if isinstance(v, str) else v
    )
    logger.info(f"Chargé {len(df)} item vectors")
    return df


def load_interactions() -> pd.DataFrame:
    """
    Charge les interactions user-item depuis la table recommendations et favorites.
    Combine les deux sources avec pondération du feedback implicite.

    Retourne un DataFrame avec colonnes : user_id, item_id, rating
    """
    # Interactions depuis recommendations (BOOKED, CLICKED, VIEWED, REJECTED)
    reco_query = """
        SELECT
            r."userId"        AS user_id,
            iv.id             AS item_id,
            r.status
        FROM recommendations r
        JOIN item_vectors iv
            ON iv."destinationId" = r."destinationId"
        WHERE r.status IN ('BOOKED', 'CLICKED', 'VIEWED', 'REJECTED')
    """

    # Favoris (signal positif fort, distinct du pipeline recommendation)
    fav_query = """
        SELECT
            f."userId"  AS user_id,
            iv.id       AS item_id,
            'FAVORITE'  AS status
        FROM favorites f
        JOIN item_vectors iv
            ON iv."destinationId" = f."entityId"
        WHERE f."entityType" = 'DESTINATION'
    """

    with _get_connection() as conn:
        df_reco = pd.read_sql(reco_query, conn)
        df_fav = pd.read_sql(fav_query, conn)

    df = pd.concat([df_reco, df_fav], ignore_index=True)
    df["rating"] = df["status"].map(INTERACTION_WEIGHTS)

    # Agrège les ratings si un user a plusieurs interactions sur le même item
    df = (
        df.groupby(["user_id", "item_id"], as_index=False)["rating"]
        .sum()
        .assign(rating=lambda x: x["rating"].clip(-1.0, 5.0))
    )

    logger.info(
        f"Chargé {len(df)} interactions ({df['user_id'].nunique()} users, "
        f"{df['item_id'].nunique()} items)"
    )
    return df


def load_from_parquet(dataset_version: str = "1.0") -> pd.DataFrame:
    """
    Charge les interactions depuis la sortie Parquet du pipeline ETL (DR-414).

    Lit `/app/data/datasets/v{version}/train_v{version}.parquet` produit par
    Paulin et le traduit en DataFrame (user_id, item_id, rating) attendu par
    train_model.py.

    Args:
        dataset_version : version du dataset ETL (ex: "1.0")

    Returns:
        DataFrame avec colonnes : user_id, item_id, rating
    """
    data_dir = os.getenv("ML_DATA_DIR", "/app/data/datasets")
    parquet_path = f"{data_dir}/v{dataset_version}/train_v{dataset_version}.parquet"

    if not os.path.exists(parquet_path):
        raise FileNotFoundError(
            f"Dataset ETL introuvable : {parquet_path}\n"
            f"Lancez d'abord le pipeline DR-414 : python scripts/run_etl.py"
        )

    df = pd.read_parquet(parquet_path, columns=["user_id", "itemVectorId", "engagement_score"])

    # Exclure les NON_VIEWED (engagement_score == 0) — pas d'information utile
    df = df[df["engagement_score"] != 0].copy()

    df = df.rename(columns={"itemVectorId": "item_id", "engagement_score": "rating"})
    df = df.dropna(subset=["user_id", "item_id"])

    # Agréger si un user a plusieurs interactions sur le même item
    df = (
        df.groupby(["user_id", "item_id"], as_index=False)["rating"]
        .sum()
        .assign(rating=lambda x: x["rating"].clip(-1.0, 5.0))
    )

    logger.info(
        f"[Parquet v{dataset_version}] {len(df)} interactions — "
        f"{df['user_id'].nunique()} users, {df['item_id'].nunique()} items"
    )
    return df


def build_interaction_matrix(
    interactions: pd.DataFrame,
    user_ids: list,
    item_ids: list,
) -> tuple[np.ndarray, dict, dict]:
    """
    Construit la matrice user-item (dense) à partir des interactions.

    Args:
        interactions : DataFrame avec colonnes user_id, item_id, rating
        user_ids     : liste ordonnée des IDs utilisateurs
        item_ids     : liste ordonnée des IDs items

    Returns:
        matrix       : np.ndarray de shape (n_users, n_items)
        user_index   : dict {user_id -> row_index}
        item_index   : dict {item_id -> col_index}
    """
    user_index = {uid: i for i, uid in enumerate(user_ids)}
    item_index = {iid: i for i, iid in enumerate(item_ids)}

    matrix = np.zeros((len(user_ids), len(item_ids)), dtype=np.float32)

    for _, row in interactions.iterrows():
        u = user_index.get(row["user_id"])
        it = item_index.get(row["item_id"])
        if u is not None and it is not None:
            matrix[u, it] = row["rating"]

    logger.info(
        f"Matrice construite : {matrix.shape}, "
        f"densité = {(matrix != 0).sum() / matrix.size:.2%}"
    )
    return matrix, user_index, item_index
