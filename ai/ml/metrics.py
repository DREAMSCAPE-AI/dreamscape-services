"""
US-IA-008 - Métriques d'évaluation du modèle de recommandation

Métriques implémentées :
  - precision_at_k  : pertinence des K premières recommandations
  - recall_at_k     : couverture des items pertinents
  - ndcg_at_k       : TODO(human) - Normalized Discounted Cumulative Gain
  - auc_roc         : capacité de discrimination binaire
"""

import numpy as np
from sklearn.metrics import roc_auc_score


def precision_at_k(recommended: list, relevant: set, k: int) -> float:
    """
    Proportion des k premières recommandations qui sont pertinentes.

    Args:
        recommended : liste ordonnée des item_ids recommandés
        relevant    : ensemble des item_ids réellement pertinents (ex: bookés)
        k           : nombre de recommandations à considérer

    Returns:
        float in [0, 1]
    """
    if k == 0:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / k


def recall_at_k(recommended: list, relevant: set, k: int) -> float:
    """
    Proportion des items pertinents couverts dans les k premières recommandations.

    Args:
        recommended : liste ordonnée des item_ids recommandés
        relevant    : ensemble des item_ids réellement pertinents
        k           : nombre de recommandations à considérer

    Returns:
        float in [0, 1]
    """
    if not relevant:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / len(relevant)


def ndcg_at_k(recommended: list, relevant: set, k: int) -> float:
    """
    Normalized Discounted Cumulative Gain @K.

    Mesure la qualité du ranking : un item pertinent en position 1 vaut
    plus qu'en position 10 (discount logarithmique).

    Args:
        recommended : liste ordonnée des item_ids recommandés
        relevant    : ensemble des item_ids réellement pertinents
        k           : nombre de recommandations à considérer

    Returns:
        float in [0, 1] (1.0 = ranking parfait)

    Formule :
        DCG@K  = sum_{i=1}^{K} rel_i / log2(i + 1)
        IDCG@K = DCG du ranking idéal (tous les pertinents en premier)
        NDCG@K = DCG@K / IDCG@K
    """
    # TODO(human): Implémenter cette fonction
    # Étapes :
    #   1. Calculer DCG : pour chaque position i (1 à k), si recommended[i-1]
    #      est dans relevant, ajouter 1.0 / log2(i + 1) au gain cumulé.
    #   2. Calculer IDCG : le DCG parfait où tous les items relevant sont
    #      placés en premiers (min(len(relevant), k) items pertinents).
    #   3. Retourner DCG / IDCG (ou 0.0 si IDCG == 0).
    pass


def auc_roc(y_true: np.ndarray, y_scores: np.ndarray) -> float:
    """
    AUC-ROC pour évaluer la capacité de discrimination binaire.

    Args:
        y_true   : labels binaires (1 = pertinent, 0 = non pertinent)
        y_scores : scores de prédiction du modèle

    Returns:
        float in [0.5, 1.0] (0.5 = aléatoire, 1.0 = parfait)
    """
    if len(np.unique(y_true)) < 2:
        return 0.5
    return roc_auc_score(y_true, y_scores)


def evaluate_model(
    predictions: dict[str, list],
    ground_truth: dict[str, set],
    k: int = 10,
) -> dict[str, float]:
    """
    Évalue le modèle sur l'ensemble de validation.

    Args:
        predictions  : {user_id -> liste ordonnée d'item_ids recommandés}
        ground_truth : {user_id -> ensemble d'item_ids pertinents (réels)}
        k            : cutoff des métriques

    Returns:
        dict avec precision@k, recall@k, ndcg@k moyennés sur tous les users
    """
    precisions, recalls, ndcgs = [], [], []

    for user_id, recommended in predictions.items():
        relevant = ground_truth.get(user_id, set())
        if not relevant:
            continue

        precisions.append(precision_at_k(recommended, relevant, k))
        recalls.append(recall_at_k(recommended, relevant, k))
        ndcgs.append(ndcg_at_k(recommended, relevant, k))

    return {
        f"precision@{k}": float(np.mean(precisions)) if precisions else 0.0,
        f"recall@{k}": float(np.mean(recalls)) if recalls else 0.0,
        f"ndcg@{k}": float(np.mean(ndcgs)) if ndcgs else 0.0,
    }
