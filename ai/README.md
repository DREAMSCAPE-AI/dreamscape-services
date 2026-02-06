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
└── onboarding/
    └── onboarding-to-vector.service.ts # Conversion onboarding → vecteurs enrichis
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
