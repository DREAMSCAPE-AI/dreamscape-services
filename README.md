# DreamScape Backend Services

> **Microservices Backend Platform** — Tous les services backend DreamScape

## Structure des services

| Dossier | Port | Description |
|---------|------|-------------|
| `auth/` | 3001 | Authentification & gestion des JWT |
| `user/` | 3002 | Profils, préférences, GDPR, notifications |
| `voyage/` | 3003 | Recherche & réservation voyage (Amadeus) |
| `payment/` | 3004 | Paiements & webhooks (Stripe) |
| `ai/` | 3005 | Recommandations IA personnalisées |
| `db/` | — | Schéma Prisma partagé (PostgreSQL) |
| `shared/` | — | Package `@dreamscape/kafka` (Kafka utilities) |

## Stack technique

### Backend Core
- **Node.js 18+** — Environnement d'exécution
- **Express 4** — Framework web
- **TypeScript** (strict, ES2022, commonjs) — Type safety
- **Prisma** — ORM, client partagé via `@dreamscape/db`

### Bases de données
- **PostgreSQL** — Données principales pour tous les services (schéma unifié 800+ lignes)
- **Redis** — Cache, sessions, rate limiting (dégradation gracieuse si indisponible)

### APIs externes
- **Amadeus SDK** — Recherche vols, hôtels, activités
- **OpenAI API** — Recommandations IA
- **Stripe API** — Paiements et webhooks

### Communication
- **HTTP/REST** — Synchrone inter-services via axios + JWT
- **Kafka (kafkajs)** — Asynchrone event-driven, topics `dreamscape.<domain>.<event>`
- **Socket.io** — Notifications temps réel (User Service)

## Quick Start

```bash
# Démarrer l'infrastructure (depuis la racine du monorepo)
make db          # PostgreSQL + Redis

# Chaque service individuellement
cd auth    && npm install && npm run dev    # :3001
cd user    && npm install && npm run dev    # :3002
cd voyage  && npm install && npm run dev    # :3003
cd payment && npm install && npm run dev    # :3004 (nodemon + ts-node)
cd ai      && npm install && npm run dev    # :3005

# Ou via Docker Compose (depuis dreamscape-infra/)
docker-compose -f docker/docker-compose.core-pod.yml up -d      # Core Pod
docker-compose -f docker/docker-compose.business-pod.yml up -d  # Business Pod
```

## Base de données

Tous les services partagent **un seul schéma Prisma** :

```bash
# Après toute modification du schéma
cd db && npm run db:generate   # Régénérer le client Prisma

# Chaque service doit aussi régénérer
cd auth    && npx prisma generate
cd user    && npx prisma generate
cd voyage  && npx prisma generate
cd payment && npx prisma generate
cd ai      && npx prisma generate
```

```env
# Pattern DATABASE_URL (tous services)
DATABASE_URL="postgresql://dreamscape_user:password@localhost:5432/dreamscape"
```

> Utiliser `npx prisma db push` en développement (évite les conflits shadow DB de `migrate dev`).

## Package partagé Kafka

```bash
# Après modification de shared/kafka/src/
cd shared/kafka && npm run build   # OBLIGATOIRE avant usage dans les services
```

Les services consomment `@dreamscape/kafka` via `file:../shared/kafka`.

## Communication inter-services

### HTTP (synchrone)
```
Gateway (4000) → Auth Service  (3001) /api/v1/auth/*
               → User Service  (3002) /api/v1/users/*
               → Voyage Service (3003) /api/v1/voyages/*
               → Payment Service (3004) /api/v1/payment/*
               → AI Service    (3005) /api/v1/ai/*
```

### Kafka (asynchrone)
```
dreamscape.user.created              — auth → user
dreamscape.user.preferences.updated — user → ai
dreamscape.voyage.booking.created   — voyage → payment
dreamscape.payment.initiated        — payment publishes
dreamscape.payment.completed        — payment → voyage + user (Saga)
dreamscape.payment.failed           — payment → voyage + user (Saga)
```

> Toujours publier avec `.catch()` pour ne pas bloquer les réponses HTTP.

## Health checks

Chaque service expose `/health` :

```json
{
  "status": "healthy",
  "uptime": 123.45,
  "database": "connected",
  "cache": "connected",
  "memory": { "used": "150MB", "total": "512MB" }
}
```

```bash
curl http://localhost:3001/health   # auth
curl http://localhost:3002/health   # user
curl http://localhost:3003/health   # voyage
curl http://localhost:3004/health   # payment
curl http://localhost:3005/health   # ai
```

## Tests

```bash
# Par service
cd auth  && npm run test:unit && npm run test:integration
cd user  && npm run test:unit && npm run test:integration

# Coverage (seuil 70%)
cd auth && npm run test:coverage

# Depuis dreamscape-tests/
npm run test:integration:auth
npm run test:integration:user
npm run test:integration:kafka
```

## Variables d'environnement

**Communes à tous les services** :
```env
NODE_ENV=development
PORT=300X
DATABASE_URL=postgresql://...
JWT_SECRET=shared-secret
JWT_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
KAFKA_BROKERS=localhost:9092
```

**Spécifiques** :
```env
# Auth / User
CORS_ORIGIN=http://localhost:5173
CLIENT_URL=http://localhost:5173

# Voyage
AMADEUS_API_KEY=xxx
AMADEUS_API_SECRET=xxx

# AI
OPENAI_API_KEY=sk-xxx

# Payment
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=http://localhost:5173
```

## Architecture Big Pods (production)

En production, les 5 services sont regroupés en 2 pods via Supervisor + NGINX :

```
Core Pod      → Auth (3001) + User (3002) + NGINX (:80)
Business Pod  → Voyage (3003) + AI (3005) + Payment (3004) + NGINX (:80)
```

Voir `dreamscape-infra/` pour les Dockerfiles et scripts de lancement.

## Sécurité

- JWT avec refresh tokens (accès 7j, refresh configurable)
- RBAC (Role-Based Access Control) — User Service
- Rate limiting Redis sur chaque service
- Helmet (CSP, HSTS, XSS protection)
- Input validation & sanitisation
- Audit logging GDPR (User Service)

## Contributing

1. Branch : `feature/<service>/<description>`
2. Conventional commits (`feat(auth):`, `fix(voyage):`)
3. Tests requis (coverage > 70%)
4. PR avec passage de tous les tests CI

---

*Propriétaire et confidentiel © DreamScape 2025*
