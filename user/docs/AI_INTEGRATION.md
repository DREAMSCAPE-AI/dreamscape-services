# 🤖 AI Integration Documentation - User Service

Documentation pour l'intégration entre le service User et le service IA pour les recommandations de voyage personnalisées.

## 📋 Vue d'ensemble

Le service User expose des endpoints spécialisés pour que le service IA puisse récupérer les préférences utilisateur dans un format optimisé pour les algorithmes de recommandation.

## 🔗 Endpoints disponibles

### 1. Récupérer les préférences d'un utilisateur

```http
GET /api/v1/ai/users/{userId}/preferences
```

**Description :** Récupère les préférences d'un utilisateur dans un format standardisé pour l'IA.

**Paramètres :**
- `userId` (string) : ID de l'utilisateur

**Réponse :**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "isOnboardingCompleted": true,
    "onboardingCompletedAt": "2025-01-15T10:30:00Z",
    "lastUpdated": "2025-01-15T10:30:00Z",
    "preferences": {
      "destinations": {
        "regions": ["Europe", "Asia"],
        "countries": ["France", "Japan"],
        "climates": ["temperate", "mediterranean"]
      },
      "budget": {
        "globalRange": {
          "min": 1000,
          "max": 5000,
          "currency": "EUR"
        },
        "flexibility": "flexible"
      },
      "travel": {
        "types": ["CULTURAL", "RELAXATION"],
        "purposes": ["leisure", "education"],
        "style": "planned",
        "groupTypes": ["couple", "solo"],
        "travelWithChildren": false,
        "childrenAges": []
      },
      // ... autres préférences
    },
    "metadata": {
      "completedSteps": ["destinations", "budget", "travel_types"],
      "profileVersion": 1,
      "dataQuality": {
        "completeness": 85,
        "confidence": 90
      }
    }
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### 2. Récupération en lot (batch)

```http
POST /api/v1/ai/users/preferences/batch
```

**Description :** Récupère les préférences de plusieurs utilisateurs en une seule requête.

**Body :**
```json
{
  "userIds": ["user_1", "user_2", "user_3"]
}
```

**Limites :**
- Maximum 100 utilisateurs par requête
- Timeout : 30 secondes

**Réponse :**
```json
{
  "success": true,
  "data": {
    "users": [
      // Array d'objets préférences (même format que endpoint individuel)
    ],
    "meta": {
      "requested": 3,
      "found": 2,
      "notFound": ["user_3"]
    }
  }
}
```

### 3. Santé de l'intégration

```http
GET /api/v1/ai/health
```

**Description :** Statistiques sur la disponibilité des données et l'état de l'intégration.

**Réponse :**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "onboardingStats": {
      "usersWithCompletedOnboarding": 850,
      "usersWithOnboardingProfile": 950,
      "profilesCompleted": 800,
      "completionRate": 68
    },
    "aiIntegration": {
      "requestsLast24h": 324,
      "dataAvailabilityRate": 76,
      "lastUpdated": "2025-01-15T10:30:00Z"
    },
    "healthStatus": {
      "overall": "healthy",
      "dataQuality": "good",
      "apiAvailability": "operational"
    }
  }
}
```

## 🎯 Format des données standardisé

### Structure des préférences

Le format `AIUserPreferences` est optimisé pour les algorithmes de recommandation :

```typescript
interface AIUserPreferences {
  userId: string;
  isOnboardingCompleted: boolean;
  onboardingCompletedAt?: Date;
  lastUpdated: Date;

  preferences: {
    destinations: {
      regions?: string[];      // ["Europe", "Asia", "North America"]
      countries?: string[];    // ["France", "Japan", "Italy"]
      climates?: string[];     // ["tropical", "temperate", "mediterranean"]
    };

    budget: {
      globalRange?: {
        min: number;           // Montant minimum
        max: number;           // Montant maximum
        currency: string;      // "EUR", "USD", etc.
      };
      byCategory?: {
        transport?: { min: number; max: number; currency: string };
        accommodation?: { min: number; max: number; currency: string };
        // ...
      };
      flexibility: 'strict' | 'flexible' | 'very_flexible' | null;
    };

    travel: {
      types: string[];         // ["CULTURAL", "ADVENTURE", "RELAXATION"]
      purposes: string[];      // ["leisure", "business", "education"]
      style: 'planned' | 'spontaneous' | 'mixed' | null;
      groupTypes: string[];    // ["solo", "couple", "family"]
      travelWithChildren: boolean;
      childrenAges: number[];
    };

    // ... autres sections
  };

  metadata: {
    completedSteps: string[];
    profileVersion: number;
    dataQuality: {
      completeness: number;    // 0-100%
      confidence: number;      // 0-100%
    };
  };
}
```

### Métriques de qualité des données

- **Completeness** (0-100%) : Pourcentage de champs remplis
- **Confidence** (0-100%) : Niveau de confiance basé sur :
  - Profil d'onboarding complété (+20%)
  - Nombre d'étapes complétées
  - Cohérence des données

## 🔧 Utilisation depuis le service IA

### Configuration recommandée

```typescript
// Configuration du client HTTP
const userServiceClient = axios.create({
  baseURL: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  timeout: 30000, // 30 secondes
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'DreamScape-AI-Service/1.0'
  }
});

// Fonction helper
async function getUserPreferences(userId: string): Promise<AIUserPreferences> {
  const response = await userServiceClient.get(`/api/v1/ai/users/${userId}/preferences`);
  return response.data.data;
}

async function getBatchUserPreferences(userIds: string[]): Promise<AIUserPreferences[]> {
  const response = await userServiceClient.post('/api/v1/ai/users/preferences/batch', {
    userIds
  });
  return response.data.data.users;
}
```

### Gestion des erreurs

```typescript
try {
  const preferences = await getUserPreferences(userId);
} catch (error) {
  if (error.response?.status === 404) {
    // Utilisateur non trouvé ou pas de profil d'onboarding
    console.log('User has no preferences yet');
  } else if (error.response?.status === 500) {
    // Erreur serveur - retry avec backoff
    console.error('User service error:', error.response.data);
  }
}
```

### Optimisations recommandées

1. **Cache côté IA** : Les préférences ne changent pas souvent
   ```typescript
   // Cache Redis recommandé avec TTL de 1 heure
   const cacheKey = `user_preferences:${userId}`;
   const cachedPrefs = await redis.get(cacheKey);
   ```

2. **Requêtes en lot** : Pour les recommandations massives
   ```typescript
   // Traiter par chunks de 100 utilisateurs max
   const chunks = chunkArray(userIds, 100);
   const allPreferences = await Promise.all(
     chunks.map(chunk => getBatchUserPreferences(chunk))
   );
   ```

3. **Filtrage par qualité** : Utiliser les métriques de qualité
   ```typescript
   const highQualityUsers = preferences.filter(p =>
     p.metadata.dataQuality.confidence > 70
   );
   ```

## 📊 Monitoring et Analytics

### Métriques à surveiller

1. **Latence des endpoints** : < 200ms pour requête simple, < 2s pour batch
2. **Taux de succès** : > 99.5%
3. **Qualité des données** : Completeness moyenne > 60%
4. **Volume de requêtes** : Pic attendu pendant les heures de pointe

### Logs disponibles

Le service User log automatiquement :
- `ai_preferences_requested` : Requête individuelle
- `ai_batch_preferences_requested` : Requête en lot
- Métriques de qualité des données

### Alertes recommandées

- Latence > 2s sur les endpoints IA
- Taux d'erreur > 1% sur 5 minutes
- Qualité des données < 50% pour les nouveaux utilisateurs

## 🔄 Évolution du format

### Versioning

Le champ `metadata.profileVersion` permet de gérer l'évolution du schéma :
- Version 1 : Format initial
- Versions futures : Ajouts rétrocompatibles

### Migration des données legacy

Pour les utilisateurs migrés depuis l'ancien système :
```json
{
  "metadata": {
    "migrationInfo": {
      "migratedFromLegacy": true,
      "legacyDataSources": ["user_preferences", "user_settings"]
    }
  }
}
```

## 🚀 Mise en production

### Checklist pré-déploiement

- [ ] Tests d'intégration entre services User et IA
- [ ] Validation du format des données avec l'équipe IA
- [ ] Configuration du monitoring
- [ ] Documentation des endpoints dans Swagger/OpenAPI
- [ ] Tests de charge sur les endpoints batch

### Configuration environnement

```env
# Service IA
USER_SERVICE_URL=http://user-service:3002
AI_USER_CACHE_TTL=3600  # 1 heure
AI_BATCH_SIZE=100
AI_REQUEST_TIMEOUT=30000
```

## 📞 Support

- **Équipe User Service** : Pour les bugs liés aux endpoints
- **Équipe IA** : Pour l'optimisation des algorithmes de recommandation
- **DevOps** : Pour le monitoring et la performance

---

**Version :** 1.0
**Dernière mise à jour :** 2025-01-15
**Contacts :** user-service-team@dreamscape.ai