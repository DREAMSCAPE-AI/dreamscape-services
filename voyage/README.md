# Voyage Service

> **Service voyage** — Recherche et réservation de vols, hôtels et activités via l'API Amadeus

- **Port** : 3003 (`process.env.PORT || 3003`)
- **Base de route** : `/api/v1`
- **Health check** : `/health`, `/api/health`

## Responsabilités

- Recherche de vols, hôtels et activités via l'API Amadeus
- Gestion du panier multi-items (CartData, CartItem)
- Gestion des réservations et de leur cycle de vie
- Construction et gestion des itinéraires de voyage
- Historique des recherches (SearchHistory)
- Pattern Saga : écoute les événements de paiement pour confirmer/annuler les réservations

## Stack

| Technologie | Rôle |
|-------------|------|
| Express 4 + TypeScript | Framework HTTP |
| Prisma + PostgreSQL | Persistance (via `@dreamscape/db`) |
| Redis | Cache des résultats de recherche |
| Amadeus SDK | API vols, hôtels, activités |
| kafkajs (`@dreamscape/kafka`) | Événements async + Saga Pattern |
| axios | Appels HTTP inter-services |
| helmet, CORS, rate-limit | Sécurité |

## Endpoints

### Vols (Amadeus)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/flights/search` | Recherche de vols |
| `GET` | `/api/v1/flights/:id` | Détail d'un vol |
| `POST` | `/api/v1/flights/price` | Vérification du prix en temps réel |

### Hôtels (Amadeus)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/hotels/search` | Recherche d'hôtels |
| `GET` | `/api/v1/hotels/:id` | Détail d'un hôtel |
| `GET` | `/api/v1/hotels/:id/offers` | Offres disponibles |

### Activités (Amadeus)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/activities/search` | Recherche d'activités |
| `GET` | `/api/v1/activities/:id` | Détail d'une activité |

### Panier
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/cart` | Récupérer le panier |
| `POST` | `/api/v1/cart/items` | Ajouter un item au panier |
| `PUT` | `/api/v1/cart/items/:id` | Modifier un item |
| `DELETE` | `/api/v1/cart/items/:id` | Supprimer un item |
| `POST` | `/api/v1/cart/checkout` | Passer à la réservation |

### Réservations
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/bookings` | Liste des réservations |
| `GET` | `/api/v1/bookings/:id` | Détail d'une réservation |
| `POST` | `/api/v1/bookings` | Créer une réservation |
| `PUT` | `/api/v1/bookings/:id/cancel` | Annuler une réservation |

### Itinéraires
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/itineraries` | Liste des itinéraires |
| `POST` | `/api/v1/itineraries` | Créer un itinéraire |
| `PUT` | `/api/v1/itineraries/:id` | Modifier un itinéraire |
| `DELETE` | `/api/v1/itineraries/:id` | Supprimer un itinéraire |

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev      # hot reload via tsx watch
```

## Variables d'environnement

```env
NODE_ENV=development
PORT=3003
DATABASE_URL=postgresql://dreamscape_user:password@localhost:5432/dreamscape
JWT_SECRET=your-super-secret-jwt-key
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:5173
KAFKA_BROKERS=localhost:9092
AMADEUS_API_KEY=your-amadeus-key
AMADEUS_API_SECRET=your-amadeus-secret
AMADEUS_HOSTNAME=test    # 'test' ou 'production'
```

> L'API Amadeus en environnement `test` a des limitations (données simulées, destinations restreintes). Voir `dreamscape-docs/reference/amadeus-test-limitations.md`.

## Événements Kafka

**Publiés** :
| Topic | Déclencheur |
|-------|-------------|
| `dreamscape.voyage.booking.created` | Nouvelle réservation |
| `dreamscape.voyage.booking.cancelled` | Annulation |
| `dreamscape.voyage.booking.confirmed` | Confirmation post-paiement |
| `dreamscape.voyage.search.performed` | Recherche effectuée |
| `dreamscape.voyage.cart.item.added` | Ajout au panier |

**Consommés (Saga Pattern)** :
| Topic | Action |
|-------|--------|
| `dreamscape.payment.completed` | Confirmer la réservation |
| `dreamscape.payment.failed` | Annuler la réservation |

> Tickets Jira : DR-402 (publish), DR-403 (consume), DR-391/392 (Saga)

## Saga Pattern — Gestion des réservations

Le Voyage Service joue le rôle d'orchestrateur dans le Saga Pattern :

```
1. Client → POST /cart/checkout
2. Voyage Service → publie dreamscape.voyage.booking.created
3. Payment Service → démarre le paiement Stripe
4. Payment Service → publie dreamscape.payment.completed/failed
5. Voyage Service → confirme ou annule la réservation
```

## Cache Redis

Les résultats de recherche Amadeus sont mis en cache pour réduire les appels API :

- Recherche vols : TTL 5 minutes
- Recherche hôtels : TTL 10 minutes
- Recherche activités : TTL 15 minutes

Le service démarre sans Redis (dégradation gracieuse) mais les performances sont réduites.

## Structure du code

```
src/
├── config/
│   ├── environment.ts
│   └── redis.ts
├── database/
│   └── DatabaseService.ts
├── handlers/
│   └── paymentEventsHandler.ts   # Saga consumer
├── middleware/
│   ├── auth.ts
│   ├── errorHandler.ts
│   └── rateLimiter.ts
├── routes/
│   ├── flights.ts
│   ├── hotels.ts
│   ├── activities.ts
│   ├── cart.ts
│   ├── bookings.ts
│   ├── itineraries.ts
│   └── health.ts
├── services/
│   ├── AmadeusService.ts
│   ├── KafkaService.ts
│   └── CacheService.ts
└── server.ts
```

## Tests

```bash
npm run test:unit
npm run test:integration
npm run test:coverage

# Depuis dreamscape-tests/
npm run test:e2e:voyage
npm run test:dr61             # Tests intégration Amadeus
npm run test:dr67             # Tests hôtels Amadeus
npm run test:dr69             # Tests activités Amadeus
```

---

*Propriétaire et confidentiel © DreamScape 2025*
