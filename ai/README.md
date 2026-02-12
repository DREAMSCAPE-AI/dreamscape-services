# 🧠 Dreamscape AI Service

Service d'intelligence artificielle pour le système de recommandations de destinations de voyage. Implémente des algorithmes de vectorisation, scoring, segmentation utilisateur et recommandations personnalisées avec gestion du cold start.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Services implémentés](#services-implémentés)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Tickets implémentés](#tickets-implémentés)
- [Roadmap](#roadmap)
- [Développement](#développement)

## 🎯 Vue d'ensemble

Le service AI est responsable de :
- **Vectorisation** : Conversion des préférences utilisateur en vecteurs 8D
- **Scoring** : Calcul de similarité entre utilisateurs et destinations
- **Segmentation** : Classification automatique des utilisateurs en segments comportementaux
- **Recommandations** : Génération de recommandations personnalisées
- **Cold Start** : Gestion des nouveaux utilisateurs sans historique

### Vecteurs de caractéristiques (8D)

Chaque utilisateur et destination est représenté par un vecteur à 8 dimensions :

| Dimension | Description | Plage |
|-----------|-------------|-------|
| 0 | Climate (froid → tropical) | 0.0 - 1.0 |
| 1 | Culture vs Nature (nature → culture) | 0.0 - 1.0 |
| 2 | Budget (économique → luxe) | 0.0 - 1.0 |
| 3 | Activity Level (détente → aventure) | 0.0 - 1.0 |
| 4 | Travel Group (solo → famille) | 0.0 - 1.0 |
| 5 | Urban vs Rural (campagne → ville) | 0.0 - 1.0 |
| 6 | Gastronomy (basique → gastronomie) | 0.0 - 1.0 |
| 7 | Popularity (hors-sentiers → mainstream) | 0.0 - 1.0 |

## 🏗️ Architecture

```
src/
├── services/
│   ├── ScoringService.ts          # Calculs de similarité (cosine, euclidean, hybrid)
│   └── VectorizationService.ts    # Conversion préférences → vecteurs
│
├── recommendations/
│   ├── cold-start.service.ts      # Orchestrateur cold start
│   ├── popularity.service.ts      # Gestion de la popularité
│   ├── popularity-cache.service.ts # Cache Redis pour performances
│   └── types/
│       ├── cold-start.types.ts    # Types cold start
│       └── popularity.types.ts    # Types popularité
│
├── segments/
│   ├── segment-engine.service.ts  # Moteur de segmentation
│   ├── segment-to-vector.service.ts # Conversion segments → vecteurs
│   └── types/
│       ├── segment.types.ts       # Énumérations segments
│       └── segment-profile.types.ts # Profils de segments
│
├── onboarding/
│   └── onboarding-to-vector.service.ts # Conversion onboarding → vecteurs enrichis
│
├── activities/                     # 🆕 US-IA-004
│   ├── services/
│   │   ├── activity-vectorizer.service.ts      # Vectorisation 8D activités
│   │   ├── activity-scoring.service.ts         # Scoring multi-facteurs
│   │   └── activity-recommendation.service.ts  # Orchestrateur
│   └── types/
│       └── activity-vector.types.ts # Types et interfaces activités
│
├── accommodations/                 # US-IA-003 (en cours)
│   ├── services/
│   │   ├── accommodation-vectorizer.service.ts
│   │   ├── accommodation-scoring.service.ts
│   │   └── accommodation-recommendation.service.ts
│   └── types/
│       └── accommodation-vector.types.ts
│
└── routes/
    ├── recommendations.ts          # Routes destinations + activités
    ├── accommodations.ts           # Routes hébergements
    ├── onboarding.ts              # Routes onboarding
    └── health.ts                  # Health checks
```

## 🔧 Services implémentés

### 1. **ScoringService**

Calcule la similarité entre vecteurs utilisateur/destination.

```typescript
import { ScoringService } from './services/ScoringService';

const scoringService = new ScoringService();

// Similarité cosinus (angle entre vecteurs)
const similarity = scoringService.cosineSimilarity(userVector, itemVector);

// Similarité euclidienne (distance normalisée)
const euclidean = scoringService.euclideanSimilarity(userVector, itemVector);

// Similarité hybride (70% cosine + 30% euclidean)
const hybrid = scoringService.hybridSimilarity(userVector, itemVector);

// Explainability - raisons de la correspondance
const reasons = scoringService.generateReasons(userVector, itemVector);
```

### 2. **VectorizationService**

Transforme les profils utilisateur en vecteurs de caractéristiques.

```typescript
import { VectorizationService } from './services/VectorizationService';

const vectorizationService = new VectorizationService();

// Générer vecteur pour un utilisateur
const userVector = await vectorizationService.generateUserVector(userId);

// Récupérer vecteur existant
const cachedVector = await vectorizationService.getUserVector(userId);

// Sauvegarder vecteur
await vectorizationService.saveUserVector(userId, 'onboarding');
```

### 3. **SegmentEngineService**

Assigne automatiquement les utilisateurs à des segments comportementaux.

**Segments disponibles** :
- `BUDGET_BACKPACKER` : Voyageurs à petit budget, aventureux
- `FAMILY_EXPLORER` : Familles, destinations sûres et family-friendly
- `LUXURY_TRAVELER` : Voyageurs premium, confort et service haut de gamme
- `ADVENTURE_SEEKER` : Amateurs d'adrénaline et d'activités outdoor
- `CULTURAL_ENTHUSIAST` : Passionnés de culture, musées, histoire
- `ROMANTIC_COUPLE` : Couples, destinations romantiques
- `BUSINESS_LEISURE` : Voyages d'affaires mixés avec loisirs
- `SENIOR_COMFORT` : Seniors, confort et accessibilité

```typescript
import { SegmentEngineService } from './segments/segment-engine.service';

const segmentEngine = new SegmentEngineService();

// Assigner segment(s) à un utilisateur
const segments = await segmentEngine.assignSegment(userProfile, {
  maxSegments: 3,
  minScore: 0.3,
  includeReasons: true
});

// Résultat: [{ segment: 'ADVENTURE_SEEKER', score: 0.85, reasons: [...] }, ...]
```

### 4. **SegmentToVectorService**

Convertit les segments en vecteurs typiques.

```typescript
import { SegmentToVectorService } from './segments/segment-to-vector.service';

const segmentToVector = new SegmentToVectorService();

// Générer vecteur typique pour un segment
const adventureVector = segmentToVector.generateVectorFromSegment(
  UserSegment.ADVENTURE_SEEKER
);

// Blender segment + préférences (adaptive blending)
const enrichedVector = segmentToVector.createEnrichedVector(
  segment,
  preferenceVector,
  confidence
);
```

### 5. **OnboardingToVectorService**

Service hybride combinant vectorisation traditionnelle et segments.

```typescript
import { OnboardingToVectorService } from './onboarding/onboarding-to-vector.service';

const onboardingService = new OnboardingToVectorService();

// Transformer profil onboarding en vecteur enrichi
const enrichedVector = await onboardingService.transformToEnrichedVector(
  userId,
  onboardingProfile
);

// Résultat: {
//   vector: [0.2, 0.8, 0.5, ...],
//   baseVector: [...],           // Vecteur depuis préférences
//   segmentVector: [...],         // Vecteur depuis segment
//   blendingWeight: 0.7,          // 70% préférences, 30% segment
//   confidence: 0.85,
//   primarySegment: 'ADVENTURE_SEEKER',
//   source: 'blended'
// }
```

### 6. **ColdStartService**

Orchestrateur principal pour les recommandations de nouveaux utilisateurs.

**Stratégies** :
- `POPULARITY_ONLY` : Pure popularité (pas de personnalisation)
- `HYBRID_SEGMENT` : Popularité + matching par segment
- `HYBRID_PREFERENCES` : Popularité + similarité vectorielle
- `ADAPTIVE` : Choisit automatiquement la meilleure stratégie

```typescript
import { ColdStartService } from './recommendations/cold-start.service';

const coldStart = new ColdStartService();

// Obtenir recommandations pour nouvel utilisateur
const recommendations = await coldStart.getRecommendationsForNewUser(
  userId,
  userProfile,
  {
    strategy: ColdStartStrategy.ADAPTIVE,
    limit: 20,
    diversityFactor: 0.3,
    includeReasons: true
  }
);

// Résultat: [
//   {
//     destinationId: '...',
//     destinationName: 'Bali',
//     score: 0.87,
//     confidence: 0.85,
//     reasons: ['Matches your preferences', 'Popular among adventure seekers'],
//     strategy: 'HYBRID_PREFERENCES',
//     rank: 1
//   },
//   ...
// ]
```

### 7. **PopularityService**

Gère le scoring de popularité basé sur les métriques d'engagement.

```typescript
import { PopularityService } from './recommendations/popularity.service';

const popularityService = new PopularityService();

// Top destinations globales
const topGlobal = await popularityService.getTopDestinations(20);

// Top destinations par segment
const topAdventure = await popularityService.getTopBySegment(
  UserSegment.ADVENTURE_SEEKER,
  20
);

// Analyse de tendance
const trend = await popularityService.calculateTrendAnalysis(destinationId);
// Résultat: { growthRate: 15.5, direction: 'rising', recentBookings: 450, ... }
```

## 📦 Installation

### Prérequis

- Node.js >= 18
- PostgreSQL (via Prisma)
- Redis (pour cache de popularité)
- Package `@dreamscape/db` installé

### Installation des dépendances

```bash
npm install
```

### Configuration TypeScript

Le service utilise TypeScript avec `tsconfig.json` configuré pour :
- Target: ES2020
- Module: CommonJS
- Strict mode activé
- Paths aliases : `@/`, `@ai/`, `@dreamscape/db`

## ⚙️ Configuration

### Variables d'environnement

Créer un fichier `.env` (si nécessaire) :

```env
# Server
PORT=3005

# Database (géré par @dreamscape/db)
DATABASE_URL="postgresql://..."

# Redis (pour cache popularité)
REDIS_URL="redis://localhost:6379"
REDIS_TTL_GLOBAL=3600
REDIS_TTL_SEGMENT=1800
```

### Configuration Prisma

Le schéma Prisma est géré dans `@dreamscape/db`. Les modèles utilisés :

- `TravelOnboardingProfile` : Données d'onboarding utilisateur
- `UserSettings` : Paramètres utilisateur
- `UserPreferences` : Préférences de voyage
- `UserVector` : Vecteurs utilisateur stockés
- `ItemVector` : Vecteurs destinations
- `Destination` : Informations destinations
- `Booking` : Historique réservations

## 🚀 Utilisation

### Intégration dans un endpoint API

```typescript
import { ColdStartService } from '@ai/recommendations/cold-start.service';
import { OnboardingToVectorService } from '@ai/onboarding/onboarding-to-vector.service';

// Endpoint: POST /api/recommendations/cold-start
export async function getColdStartRecommendations(req, res) {
  const { userId } = req.params;

  // 1. Récupérer profil utilisateur
  const userProfile = await getUserProfile(userId);

  // 2. Générer vecteur enrichi
  const onboardingService = new OnboardingToVectorService();
  const enrichedVector = await onboardingService.transformToEnrichedVector(
    userId,
    userProfile
  );

  // 3. Obtenir recommandations
  const coldStart = new ColdStartService();
  const recommendations = await coldStart.getRecommendationsForNewUser(
    userId,
    userProfile,
    { limit: 20, diversityFactor: 0.3 }
  );

  res.json({
    recommendations,
    userVector: enrichedVector,
    segment: enrichedVector.primarySegment
  });
}
```

## ✅ Tickets implémentés

### US-IA-001 : Basic Recommendations System ✅

**Fonctionnalités** :
- ✅ Service de scoring (cosine, euclidean, hybrid similarity)
- ✅ Service de vectorisation (8D feature vectors)
- ✅ Explainability (génération de raisons de match)
- ✅ Calcul de confiance
- ✅ Tests unitaires (13/13 passing)

**Fichiers** :
- `src/services/ScoringService.ts`
- `src/services/VectorizationService.ts`
- Tests : `dreamscape-tests/tests/US-IA-001-basic-recommendations/`

### US-IA-002 : Cold Start Management System ✅

**Fonctionnalités** :
- ✅ Segmentation utilisateur (8 segments)
- ✅ Stratégies cold start (4 stratégies)
- ✅ Service de popularité
- ✅ Conversion segment → vector
- ✅ Conversion onboarding → vector enrichi
- ✅ Service ColdStart orchestrateur
- ✅ Tests unitaires (24/24 passing)

**Fichiers** :
- `src/segments/segment-engine.service.ts`
- `src/segments/segment-to-vector.service.ts`
- `src/onboarding/onboarding-to-vector.service.ts`
- `src/recommendations/cold-start.service.ts`
- `src/recommendations/popularity.service.ts`
- `src/recommendations/popularity-cache.service.ts`
- Tests : `dreamscape-tests/tests/US-IA-002-cold-start/`

### US-IA-004 : Activity Recommendations ✅ (DR-76)

**Fonctionnalités** :
- ✅ Vectorisation d'activités (8D compatible avec UserVector)
- ✅ Scoring hybride (similarité + popularité + qualité + contexte)
- ✅ Prise en compte du contexte de voyage (durée, budget, compagnons)
- ✅ Segment boosts pour personnalisation
- ✅ Diversité via MMR (Maximum Marginal Relevance)
- ✅ Explainability avec raisons personnalisées
- ✅ API endpoints REST
- ✅ Tests unitaires (21 tests)

**Architecture** :
```
activities/
├── services/
│   ├── activity-vectorizer.service.ts      # Vectorisation 8D des activités
│   ├── activity-scoring.service.ts         # Scoring multi-facteurs
│   └── activity-recommendation.service.ts  # Orchestrateur principal
└── types/
    └── activity-vector.types.ts            # Types et interfaces
```

**Algorithme de scoring** :
```
finalScore = (
  50% × similarityScore +      // Cosine similarity avec UserVector
  25% × popularityScore +      // Rating, reviews, bookings
  15% × qualityScore +         // Instant confirmation, features
  10% × contextualScore        // Duration match, budget fit, companions
) × segmentBoost               // 0.3-1.4× selon segment utilisateur
```

**API Endpoints** :
- `GET /api/v1/recommendations/activities` - Recommandations personnalisées
  - Query params : `userId`, `cityCode`, `stayDuration`, `travelCompanions`, `budgetPerActivity`, etc.
- `POST /api/v1/recommendations/activities/interactions` - Tracking (view/click/book)
- `GET /api/v1/recommendations/activities/status` - Health check

**Exemple d'utilisation** :
```typescript
import { ActivityRecommendationService } from '@ai/activities/services/activity-recommendation.service';

const service = new ActivityRecommendationService();

const recommendations = await service.getRecommendations({
  userId: 'user123',
  searchParams: { cityCode: 'PAR' },
  tripContext: {
    stayDuration: 3,
    travelCompanions: 'family',
    budgetPerActivity: 60,
    timeAvailable: 180  // 3 hours
  },
  filters: {
    categories: ['MUSEUM', 'FOOD_TOUR'],
    childFriendly: true,
    maxPrice: 100
  },
  limit: 20
});

// Résultat: {
//   recommendations: [
//     {
//       activity: { name: 'Louvre Museum', category: 'MUSEUM', ... },
//       score: 0.92,
//       confidence: 0.88,
//       reasons: ['Perfect match for your preferences', 'Family-friendly', ...],
//       rank: 1
//     }
//   ],
//   metadata: { processingTime: 245, strategy: 'hybrid' }
// }
```

**Catégories d'activités** (40+) :
- **Culturel** : MUSEUM, HISTORICAL_SITE, ART_GALLERY, CULTURAL_TOUR
- **Nature** : HIKING, WILDLIFE, SAFARI, NATIONAL_PARK, BEACH
- **Aventure** : EXTREME_SPORTS, CLIMBING, DIVING, WATER_SPORTS
- **Gastronomie** : FOOD_TOUR, WINE_TASTING, COOKING_CLASS
- **Entertainment** : SHOW, CONCERT, THEATER, NIGHTLIFE
- **Famille** : THEME_PARK, AQUARIUM, ZOO, FAMILY_ACTIVITY
- **Wellness** : SPA, YOGA, MEDITATION

**Fichiers** :
- `src/activities/services/activity-vectorizer.service.ts`
- `src/activities/services/activity-scoring.service.ts`
- `src/activities/services/activity-recommendation.service.ts`
- `src/activities/types/activity-vector.types.ts`
- `src/routes/recommendations.ts` (endpoints)
- Tests : `dreamscape-tests/tests/DR-76-activity-recommendations/unit/`

**Performance** :
- Temps de réponse cible : < 500ms (p95)
- Vectorisation : < 50ms pour 100 activités
- Scoring : < 100ms pour 100 activités
- Cache Redis : 30 min TTL
- Batch processing optimisé

**À faire (Frontend)** :
- [ ] IA-004.4 : Composant React pour affichage des recommandations
- [ ] Filtres interactifs (catégories, prix, durée)
- [ ] Tracking des interactions utilisateur
- [ ] Intégration avec booking flow

---

### US-IA-004-bis : Recommandations de Vols Personnalisées ✈️

**Statut** : ✅ Implémenté (IA-004-bis.1, IA-004-bis.2, IA-004-bis.3)

Système de recommandation de vols basé sur la même architecture que les activités, mais adapté aux caractéristiques spécifiques des vols : classe de cabine, escales, compagnies aériennes, ponctualité.

**Fonctionnalités** :
- ✅ Vectorisation de vols (8D compatible avec UserVector)
- ✅ Scoring hybride (similarité + popularité + qualité + contexte)
- ✅ Prise en compte du contexte de voyage (business/loisir, préférences horaires, budget)
- ✅ Segment boosts pour classes de cabine
- ✅ Diversité via MMR (compagnies, alliances, horaires)
- ✅ Explainability avec raisons personnalisées
- ✅ API endpoints REST
- ✅ Tests unitaires (20 tests)

**Architecture** :
```
flights/
├── services/
│   ├── flight-vectorizer.service.ts      # Vectorisation 8D des vols
│   ├── flight-scoring.service.ts         # Scoring multi-facteurs
│   └── flight-recommendation.service.ts  # Orchestrateur principal
└── types/
    └── flight-vector.types.ts            # Types et interfaces
```

**Algorithme de scoring** :
```
finalScore = (
  45% × similarityScore +      // Cosine similarity avec UserVector
  25% × popularityScore +      // Airline rating, route, on-time
  20% × qualityScore +         // Amenities, baggage, flexibility
  10% × contextualScore        // Timing, duration fit, price fit
) × segmentBoost               // 0.3-1.4× selon segment et classe
```

**Dimensions du vecteur** :
1. **Climate** (0-1) : Climat destination (froid → tropical)
2. **Culture/Nature** (0-1) : Type destination (nature → culture)
3. **Budget** (0-1) : Classe cabine + prix (economy → first class)
4. **Activity Level** (0-1) : Style voyage (détendu/direct → aventureux/escales)
5. **Group Size** (0-1) : Adaptabilité groupe (solo → famille)
6. **Urban/Rural** (0-1) : Urbanisme destination (rural → urbain)
7. **Gastronomy** (0-1) : Réputation culinaire destination
8. **Popularity** (0-1) : Note compagnie + route + ponctualité

**API Endpoints** :
- `GET /api/v1/recommendations/flights` - Recommandations personnalisées
  - Query params : `userId`, `origin`, `destination`, `departureDate`, `adults`, `tripPurpose`, `budgetPerPerson`, `preferDirectFlights`, etc.
- `POST /api/v1/recommendations/flights/interactions` - Tracking (view/click/book/compare/save)
- `GET /api/v1/recommendations/flights/status` - Health check

**Exemple d'utilisation** :
```typescript
import { FlightRecommendationService } from '@ai/flights/services/flight-recommendation.service';

const service = new FlightRecommendationService();

const recommendations = await service.getRecommendations({
  userId: 'user123',
  searchParams: {
    origin: 'CDG',
    destination: 'JFK',
    departureDate: '2025-06-15',
    returnDate: '2025-06-22',
    adults: 2,
    travelClass: 'BUSINESS'
  },
  tripContext: {
    tripPurpose: 'BUSINESS',
    budgetPerPerson: 1500,
    preferDirectFlights: true,
    preferredDepartureTime: 'MORNING',
    avoidRedEye: true
  },
  filters: {
    maxStops: 1,
    airlines: ['AF', 'BA', 'LH'],
    requiredAmenities: ['wifi', 'power']
  },
  limit: 20
});

// Résultat: {
//   recommendations: [
//     {
//       flight: {
//         airline: { name: 'Air France', code: 'AF', rating: 4.5 },
//         flightClass: 'BUSINESS',
//         flightType: 'DIRECT',
//         duration: { total: 510, layover: 0 },
//         price: { amount: 1450, currency: 'EUR' }
//       },
//       score: 0.94,
//       confidence: 0.91,
//       reasons: [
//         'Business class recommended for your travel profile',
//         'Non-stop flight',
//         'Excellent airline (Air France)',
//         'Departs at your preferred time'
//       ],
//       rank: 1
//     }
//   ],
//   metadata: { processingTime: 850, strategy: 'hybrid' },
//   context: {
//     fastestFlight: { duration: 480, price: 1800 },
//     cheapestFlight: { duration: 720, price: 650 }
//   }
// }
```

**Classes de cabine** :
- **ECONOMY** : Budget-friendly, sièges standard
- **PREMIUM_ECONOMY** : Plus d'espace, services améliorés
- **BUSINESS** : Sièges-lits, lounges, priorité
- **FIRST_CLASS** : Suites privées, service complet

**Types de vol** :
- **DIRECT** : Sans escale
- **ONE_STOP** : 1 escale
- **TWO_PLUS_STOPS** : 2 escales ou plus

**Alliances aériennes** :
- **STAR_ALLIANCE** : Lufthansa, United, ANA, Singapore Airlines
- **ONEWORLD** : American Airlines, British Airways, Qantas
- **SKYTEAM** : Air France, KLM, Delta

**Segment Boosts par classe** :
```typescript
LUXURY_TRAVELER: {
  FIRST_CLASS: 1.4×,
  BUSINESS: 1.3×,
  PREMIUM_ECONOMY: 1.1×,
  ECONOMY: 0.6×
}

BUSINESS_TRAVELER: {
  BUSINESS: 1.4×,
  PREMIUM_ECONOMY: 1.2×,
  FIRST_CLASS: 1.1×,
  ECONOMY: 0.9×
}

BUDGET_BACKPACKER: {
  ECONOMY: 1.3×,
  PREMIUM_ECONOMY: 0.8×,
  BUSINESS: 0.5×,
  FIRST_CLASS: 0.3×
}
```

**Fichiers** :
- `src/flights/services/flight-vectorizer.service.ts`
- `src/flights/services/flight-scoring.service.ts`
- `src/flights/services/flight-recommendation.service.ts`
- `src/flights/types/flight-vector.types.ts`
- `src/routes/recommendations.ts` (endpoints)
- Tests : `dreamscape-tests/tests/DR-76-activity-recommendations/unit/flight-*.test.ts`

**Performance** :
- Temps de réponse cible : < 1000ms (p95)
- Vectorisation : < 80ms pour 100 vols
- Scoring : < 150ms pour 100 vols
- Cache Redis : 30 min TTL (prix volatiles)
- Timeout Amadeus : 8 secondes

**Contexte de scoring** :
- **Timing** : Heure de départ préférée, éviter red-eye
- **Duration Fit** : Préférence vol direct vs connexions, tolérance escales
- **Price Fit** : Courbe non-linéaire (70-100% du budget = optimal)

**À faire (Frontend)** :
- [ ] IA-004-bis.4 : Composant React pour affichage des vols
- [ ] Filtres avancés (horaires, escales, compagnies, alliances)
- [ ] Comparateur de vols (side-by-side)
- [ ] Intégration calendrier prix
- [ ] Alertes prix et disponibilité

## 🗺️ Roadmap

### Prochains tickets suggérés

#### US-IA-003 : Real-time Recommendations
- [ ] Service de mise à jour incrémentale des vecteurs
- [ ] API WebSocket pour recommandations temps réel
- [ ] Cache L1/L2 pour performances
- [ ] Batch processing pour vecteurs en masse

#### US-IA-004 : Collaborative Filtering
- [ ] Matrix factorization (SVD, ALS)
- [ ] User-user collaborative filtering
- [ ] Item-item collaborative filtering
- [ ] Hybrid CF + content-based

#### US-IA-005 : Deep Learning Models
- [ ] Neural collaborative filtering
- [ ] Wide & Deep model
- [ ] Embeddings pré-entraînés
- [ ] Fine-tuning sur données voyage

#### US-IA-006 : A/B Testing & Optimization
- [ ] Framework A/B testing
- [ ] Multi-armed bandit
- [ ] Métriques d'évaluation (NDCG, MAP, MRR)
- [ ] Dashboard analytics

#### US-IA-007 : Context-aware Recommendations
- [ ] Recommandations sensibles au contexte (saison, météo, événements)
- [ ] Time-series forecasting pour popularité
- [ ]] Géolocalisation et proximité
- [ ] Facteurs externes (prix, disponibilité)

## 🛠️ Développement

### Lancer les tests

```bash
# Tous les tests AI
cd ../dreamscape-tests
npm test -- --testPathPattern="US-IA"

# Tests US-IA-001 uniquement
npm test -- --testPathPattern="US-IA-001"

# Tests US-IA-002 uniquement
npm test -- --testPathPattern="US-IA-002"
```

### Conventions de code

- **TypeScript strict mode** : Toutes les erreurs TypeScript doivent être corrigées
- **Imports** : Utiliser les alias `@ai/*` pour imports internes
- **Nommage** :
  - Classes : `PascalCase` (ex: `ScoringService`)
  - Méthodes : `camelCase` (ex: `calculateSimilarity`)
  - Types/Interfaces : `PascalCase` (ex: `ColdStartOptions`)
  - Enums : `SCREAMING_SNAKE_CASE` pour valeurs (ex: `UserSegment.ADVENTURE_SEEKER`)

### Ajouter un nouveau service

1. Créer le fichier dans le bon dossier (`services/`, `recommendations/`, etc.)
2. Définir les types dans `types/`
3. Implémenter la classe avec JSDoc complet
4. Exporter proprement : `export class MonService { ... }`
5. Ajouter les tests dans `dreamscape-tests/tests/`
6. Documenter dans ce README

### Problèmes courants

#### Erreur : "Cannot find module @dreamscape/db"

Vérifier que le package est bien installé :
```bash
cd ../dreamscape-tests
npm install
```

Vérifier les paths dans `jest.config.js` et `tsconfig.json`.

#### Erreur : "VectorizationService is not a constructor"

Utiliser l'import nommé, pas l'import par défaut :
```typescript
// ✅ Correct
import { VectorizationService } from './services/VectorizationService';

// ❌ Incorrect
import VectorizationService from './services/VectorizationService';
```

#### Tests qui échouent avec erreurs TypeScript

1. Vérifier que `ts-jest` est installé
2. Vérifier les `moduleNameMapper` dans `jest.config.js`
3. Compiler pour voir les erreurs : `npx tsc --noEmit`

## 📚 Ressources

### Documentation externe

- [Prisma Docs](https://www.prisma.io/docs/)
- [Redis Docs](https://redis.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Articles recommandés

- [Collaborative Filtering](https://towardsdatascience.com/collaborative-filtering-based-recommendation-systems-exemplified-ecbffe1c20b1)
- [Cold Start Problem](https://medium.com/@cfpinela/recommender-systems-user-based-and-item-based-collaborative-filtering-5d5f375a127f)
- [Matrix Factorization](https://developers.google.com/machine-learning/recommendation/collaborative/matrix)

## 🤝 Contribution

Pour contribuer au service AI :

1. Créer une branche depuis `main` : `git checkout -b feature/US-IA-XXX`
2. Implémenter la fonctionnalité avec tests
3. Vérifier que tous les tests passent : `npm test`
4. Commit avec message conventionnel : `feat(ai): implement feature X`
5. Push et créer une PR

## 📞 Support

Pour questions ou problèmes :
- Créer une issue sur le repo
- Contacter l'équipe AI : `#team-ai` sur Slack
- Documentation complète : `docs/ai-service.md`

---

**Version** : 1.0.0
**Dernière mise à jour** : 2026-02-06
**Mainteneur** : Équipe Dreamscape AI
