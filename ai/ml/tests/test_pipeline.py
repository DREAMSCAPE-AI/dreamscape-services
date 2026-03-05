"""
Test local du pipeline DR-415 avec données synthétiques.
Permet de valider le pipeline sans DB ni ETL.

Usage :
    python tests/test_pipeline.py
"""

import os
import sys
import tempfile
import numpy as np
import pandas as pd

# Ajoute le dossier parent au path pour importer les modules ml/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def generate_mock_parquet(output_dir: str, version: str = "test", n_users: int = 50, n_items: int = 30):
    """Génère un Parquet synthétique au format DR-414."""
    rng = np.random.default_rng(42)

    user_ids = [f"user-{i:03d}" for i in range(n_users)]
    item_ids = [f"item-{i:03d}" for i in range(n_items)]
    scores = [5.0, 3.0, 1.0, -1.0]  # BOOKED, CLICKED, VIEWED, REJECTED

    rows = []
    for user_id in user_ids:
        n_interactions = rng.integers(2, 8)
        sampled_items = rng.choice(item_ids, size=n_interactions, replace=False)
        for item_id in sampled_items:
            rows.append({
                "user_id": user_id,
                "itemVectorId": item_id,
                "engagement_score": rng.choice(scores, p=[0.1, 0.2, 0.5, 0.2]),
            })

    df = pd.DataFrame(rows)
    path = os.path.join(output_dir, f"v{version}", f"train_v{version}.parquet")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_parquet(path, index=False)
    print(f"✓ Mock dataset : {len(df)} interactions → {path}")
    return path, version


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Génère les données de test
        _, version = generate_mock_parquet(tmp_dir)

        # Configure l'env pour pointer vers le répertoire temporaire
        os.environ["ML_DATA_DIR"] = tmp_dir
        os.environ["MLFLOW_TRACKING_URI"] = f"sqlite:///{tmp_dir}/mlflow.db"

        # Lance le pipeline complet
        from train_model import run_training

        metrics = run_training(version="v0.0-test", n_factors=10, k=5, dataset_version=version)

        print("\n=== Résultats ===")
        for name, value in metrics.items():
            print(f"  {name:20s} = {value:.4f}")
        print("\n✓ Pipeline OK")
