# Auth Service

> **Service d'authentification** — Gestion des JWT, sessions Redis et autorisations

- **Port** : 3001 (hardcodé dans `src/server.ts`)
- **Base de route** : `/api/v1/auth`
- **Health check** : `/health`, `/api/health`

## Responsabilités

- Inscription et connexion des utilisateurs
- Émission et validation des tokens JWT (access + refresh)
- Gestion des sessions via Redis
- Blacklist des tokens révoqués
- Publication des événements Kafka d'authentification

## Stack

| Technologie | Rôle |
|-------------|------|
| Express 4 + TypeScript | Framework HTTP |
| Prisma + PostgreSQL | Persistance (via `@dreamscape/db`) |
| Redis | Sessions & blacklist JWT |
| kafkajs (`@dreamscape/kafka`) | Événements async |
| bcryptjs | Hachage des mots de passe |
| jsonwebtoken | Génération/validation JWT |
| helmet, CORS, cookie-parser | Sécurité |

## Endpoints

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/v1/auth/register` | Inscription utilisateur |
| `POST` | `/api/v1/auth/login` | Connexion, retourne access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Renouvellement du token d'accès |
| `POST` | `/api/v1/auth/logout` | Révocation du token (blacklist Redis) |
| `GET`  | `/api/v1/auth/me` | Profil de l'utilisateur connecté |
| `POST` | `/api/v1/auth/change-password` | Changement de mot de passe |

### Health
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Statut service, DB, Redis, Kafka |

## Quick Start

```bash
# Installation
npm install

# Variables d'environnement
cp .env.example .env

# Développement (hot reload via tsx)
npm run dev

# Build TypeScript
npm run build

# Production
npm start
```

## Variables d'environnement

```env
NODE_ENV=development
# PORT ignoré — hardcodé 3001 dans server.ts
DATABASE_URL=postgresql://dreamscape_user:password@localhost:5432/dreamscape
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
KAFKA_BROKERS=localhost:9092
```

## Événements Kafka publiés

| Topic | Déclencheur |
|-------|-------------|
| `dreamscape.user.login` | Connexion réussie |
| `dreamscape.user.logout` | Déconnexion |
| `dreamscape.user.registered` | Inscription |
| `dreamscape.user.password.changed` | Changement de mot de passe |

> Tickets Jira : DR-374 (publish), DR-375 (consume)

> Les événements Kafka sont non-bloquants : publiés avec `.catch()` pour ne pas interrompre la réponse HTTP.

## Structure du code

```
src/
├── config/
│   └── redis.ts           # Client Redis
├── database/
│   └── DatabaseService.ts # Initialisation Prisma
├── middleware/
│   ├── auth.ts            # Validation JWT middleware
│   └── errorHandler.ts    # Gestion centralisée des erreurs
├── routes/
│   ├── auth.ts            # Routes d'authentification
│   └── health.ts          # Route /health
├── services/
│   └── KafkaService.ts    # Publication événements Kafka
└── server.ts              # Entry point Express
```

## Tests

```bash
npm run test              # Tous les tests
npm run test:unit         # Tests unitaires
npm run test:integration  # Tests d'intégration (requiert DB)
npm run test:coverage     # Coverage (seuil 70%)
npm run lint              # ESLint
```

Les tests d'intégration utilisent `supertest` avec le header `x-test-rate-limit: true` pour bypasser le rate limiting.

## Dépendances de démarrage

Le service démarre en séquence :
1. PostgreSQL (obligatoire — arrêt si échec)
2. Redis (optionnel — dégradation gracieuse)
3. Kafka (optionnel — dégradation gracieuse)

## Health check response

```json
{
  "status": "healthy",
  "uptime": 123.45,
  "database": "connected",
  "cache": "connected",
  "kafka": "connected"
}
```

---

*Propriétaire et confidentiel © DreamScape 2025*
