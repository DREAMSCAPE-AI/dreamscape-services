# DREAMSCAPE ML Training Dataset Pipeline

Pipeline ETL pour créer le dataset d'entraînement du modèle de recommandation ML.

## 📋 Vue d'ensemble

Ce pipeline extrait les données de PostgreSQL (UserVector, Recommendations, ItemVector, etc.), les transforme en features ML, et génère un dataset prêt à l'entraînement au format Parquet.

**Sorties** :
- `train_v1.0.parquet` - Dataset d'entraînement (80%)
- `test_v1.0.parquet` - Dataset de test (20%)
- `metadata_v1.0.json` - Métadonnées du dataset
- `quality_report_v1.0.html` - Rapport qualité avec graphiques

## 🎯 Features du Dataset

### User Features (8D vector)
- `user_climate_pref`, `user_culture_pref`, `user_budget_level`, `user_activity_level`
- `user_group_type`, `user_urban_pref`, `user_gastronomy_pref`, `user_popularity_pref`

### User Metadata
- `primary_segment` (BUDGET_BACKPACKER, FAMILY_EXPLORER, LUXURY_TRAVELER, etc.)
- `user_age_group`, `user_region`, `user_category`

### Item Features (8D vector)
- `item_climate`, `item_culture`, `item_budget`, `item_activity`, etc.
- `item_popularity_score`, `item_booking_count`, `item_search_count`

### Context Features
- `season`, `is_weekend`, `days_until_departure`, `search_passengers`

### Labels
- `engagement_score` : 0 (not_viewed), 1 (viewed), 3 (clicked), 5 (booked), -1 (rejected)
- `booking_probability` : 1 (booked), 0 (not_booked)

## 🚀 Utilisation

### Installation locale

```bash
cd dreamscape-services/ai

# Créer environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer dépendances
pip install -r ml/requirements.txt

# Configurer DATABASE_URL
export DATABASE_URL="postgresql://dreamscape:password@localhost:5432/dreamscape"

# Lancer le pipeline
bash ml/scripts/run_etl.sh 1.0 90

# Ou directement en Python
python ml/scripts/run_etl.py --version 1.0 --window-days 90
```

### Docker

```bash
cd dreamscape-infra

# Build l'image ML
docker-compose build ai-ml-trainer

# Lancer le pipeline ETL
docker-compose run --rm ai-ml-trainer

# Avec paramètres personnalisés
docker-compose run --rm ai-ml-trainer python ml/scripts/run_etl.py --version 1.1 --window-days 180

# Vérifier les outputs
docker-compose run --rm ai-ml-trainer ls -lh /app/data/datasets/v1.0/
```

## 📊 Pipeline ETL (10 étapes)

1. **Extract User Data** - Extraction User + UserVector + TravelOnboardingProfile
2. **Extract Recommendations** - Extraction Recommendation + ItemVector
3. **Extract Voyage Data** - Extraction SearchHistory + BookingData
4. **Merge Datasets** - Fusion des 3 sources
5. **Feature Engineering** - Unpacking 8D vectors, calculs temporels
6. **Label Construction** - engagement_score, booking_probability
7. **Negative Sampling** - Ajout échantillons négatifs (ratio 2:1)
8. **Data Cleaning** - Outliers, missing values, duplicates
9. **GDPR Anonymization** - Hash userId, suppression PII
10. **Export** - Train/test split, Parquet, metadata, rapport

## 📁 Structure des Fichiers

```
ml/
├── etl/                          # Scripts ETL
│   ├── extract_user_data.py      # Extraction users
│   ├── extract_recommendations.py # Extraction recommendations
│   ├── extract_voyage_data.py    # Extraction searches
│   ├── merge_datasets.py         # Fusion datasets
│   ├── feature_engineering.py    # Feature engineering
│   ├── label_construction.py     # Construction labels
│   ├── negative_sampling.py      # Negative sampling
│   ├── data_cleaning.py          # Nettoyage
│   ├── gdpr_anonymization.py     # Anonymisation
│   └── export_dataset.py         # Export final
│
├── config/                       # Configuration
│   ├── dataset_config.py         # Schéma dataset
│   ├── db_config.py              # Configuration DB
│   └── logging_config.py         # Configuration logs
│
├── utils/                        # Utilitaires
│   ├── logger.py                 # Logger
│   ├── db_connector.py           # Connexion PostgreSQL
│   ├── validators.py             # Validation dataset
│   └── metrics.py                # Calcul métriques
│
├── scripts/                      # Scripts d'exécution
│   ├── run_etl.py                # Orchestrateur Python
│   └── run_etl.sh                # Script shell
│
└── requirements.txt              # Dépendances Python
```

## ⚙️ Configuration

### Variables d'environnement

```bash
DATABASE_URL=postgresql://dreamscape:password@postgres:5432/dreamscape
DATASET_VERSION=1.0
DATA_WINDOW_DAYS=90
NEGATIVE_SAMPLE_RATIO=2.0
TEST_SIZE=0.2
RANDOM_SEED=42
LOG_LEVEL=INFO
LOG_FILE=logs/etl.log
```

### Fichier de configuration

Voir [config/dataset_config.py](config/dataset_config.py) pour :
- Schéma complet (52+ colonnes)
- Mapping des colonnes
- Constantes (window, ratio, seed)

## ✅ Validation du Dataset

Après génération, vérifier :

```bash
# Vérifier les fichiers
ls -lh data/datasets/v1.0/

# Vérifier le contenu (Python)
python -c "
import pandas as pd
df = pd.read_parquet('data/datasets/v1.0/train_v1.0.parquet')
print(f'Rows: {len(df):,}')
print(f'Columns: {len(df.columns)}')
print(f'Booking rate: {df["booking_probability"].mean():.2%}')
print(f'Engagement distribution:\n{df["engagement_score"].value_counts()}')
"

# Ouvrir rapport qualité
open data/datasets/v1.0/quality_report_v1.0.html  # macOS
# start data/datasets/v1.0/quality_report_v1.0.html  # Windows
```

Vérifications critiques :
- ✅ `train_v1.0.parquet` > 10 MB
- ✅ `test_v1.0.parquet` > 2 MB
- ✅ Booking rate entre 5-15%
- ✅ Engagement score balanced
- ✅ Pas de valeurs manquantes dans colonnes requises
- ✅ Vecteurs dans [0, 1]

## 🔄 Versioning du Dataset

### Convention de nommage

- **v1.0** - Version initiale (90 jours)
- **v1.1** - Refresh hebdomadaire (data refresh)
- **v2.0** - Changement majeur (schema, window)

### Créer nouvelle version

```bash
# Refresh hebdomadaire
bash ml/scripts/run_etl.sh 1.1 90

# Changement de window
bash ml/scripts/run_etl.sh 2.0 180
```

## 📈 Métriques du Dataset

Le rapport qualité (`quality_report_v1.0.html`) inclut :
- Distribution engagement_score
- Distribution user budget
- Distribution item popularity
- Distribution segments
- Taux de booking
- Missing values par colonne
- Statistiques train/test

## 🐛 Dépannage

### Erreur de connexion DB

```bash
# Vérifier que PostgreSQL est accessible
psql $DATABASE_URL -c "SELECT 1"

# Vérifier la configuration
echo $DATABASE_URL
```

### Pas assez de données

```bash
# Vérifier les données sources
psql $DATABASE_URL -c "SELECT COUNT(*) FROM recommendations WHERE \"createdAt\" >= NOW() - INTERVAL '90 days'"
```

### Erreur de mémoire

```python
# Réduire la fenêtre de données
python ml/scripts/run_etl.py --window-days 30
```

## 📚 Documentation

- [Plan d'implémentation](../../.claude/plans/) - Plan détaillé du pipeline
- [Schema dataset](config/dataset_config.py) - Schéma complet
- [Documentation Prisma](../../db/prisma/schema.prisma) - Schéma base de données

## 🔗 Prochaines étapes

Après génération du dataset :

1. **US-IA-008** - Entraînement du modèle ML (Collaborative Filtering)
2. Export embeddings vers PostgreSQL
3. Intégration avec serveur TypeScript pour serving
4. A/B testing ML vs règles actuelles

## 📝 Livrables (US-IA-007)

✅ Script ETL : `ml/etl/*.py` (10 scripts)
✅ Dataset v1.0 : Format Parquet (train + test)
✅ Documentation schema : `config/dataset_config.py`
✅ Rapport qualité : `quality_report_v1.0.html`

**Story Points** : 8
