# Payment Service

> **Service paiement** — Intégration Stripe, gestion des transactions et webhooks

- **Port** : 3004 (`process.env.PORT || 3004`)
- **Base de route** : `/api/v1/payment`
- **Health check** : `/health`
- **Entry point** : `src/index.ts` (ts-node + nodemon, pas tsx)

## Responsabilités

- Création et gestion des sessions de paiement Stripe
- Traitement des webhooks Stripe (idempotent via `ProcessedWebhookEvent`)
- Publication des événements de paiement sur Kafka (Saga Pattern)
- Historique des transactions

## Stack

| Technologie | Rôle |
|-------------|------|
| Express 4 + TypeScript | Framework HTTP |
| Stripe SDK | Paiements & webhooks |
| Prisma + PostgreSQL | Persistance (via `@dreamscape/db`) |
| kafkajs (`@dreamscape/kafka`) | Événements async |

> Différence avec les autres services : utilise **nodemon + ts-node** (pas tsx) pour le développement.

## Endpoints

### Paiement
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/v1/payment/create-intent` | Créer un PaymentIntent Stripe |
| `POST` | `/api/v1/payment/confirm` | Confirmer un paiement |
| `GET` | `/api/v1/payment/transactions` | Historique des transactions |
| `GET` | `/api/v1/payment/transactions/:id` | Détail d'une transaction |
| `POST` | `/api/v1/payment/refund` | Initier un remboursement |

### Webhook
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/v1/payment/webhook` | Webhooks Stripe (raw body requis) |

### Health
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Statut Kafka + Stripe + DB |

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev      # nodemon --watch src --exec ts-node src/index.ts
```

## Variables d'environnement

```env
NODE_ENV=development
PORT=3004
DATABASE_URL=postgresql://dreamscape_user:password@localhost:5432/dreamscape
FRONTEND_URL=http://localhost:5173
KAFKA_BROKERS=localhost:9092
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

> Les clés Stripe ne doivent **jamais** être committées dans le repo.

## Webhooks Stripe

Le webhook `/api/v1/payment/webhook` reçoit le **raw body** (middleware `express.raw()` appliqué avant `express.json()`).

Événements traités :
| Événement Stripe | Action |
|-----------------|--------|
| `payment_intent.succeeded` | Publier `dreamscape.payment.completed` |
| `payment_intent.payment_failed` | Publier `dreamscape.payment.failed` |
| `charge.refunded` | Publier `dreamscape.payment.refunded` |

Les webhooks sont idempotents grâce au modèle `ProcessedWebhookEvent` (stocke les IDs Stripe traités).

## Événements Kafka publiés

| Topic | Déclencheur |
|-------|-------------|
| `dreamscape.payment.initiated` | Création d'un PaymentIntent |
| `dreamscape.payment.completed` | Paiement confirmé (webhook Stripe) |
| `dreamscape.payment.failed` | Paiement échoué (webhook Stripe) |
| `dreamscape.payment.refunded` | Remboursement traité |

> Tickets Jira : DR-378 (publish), DR-379 (consume)

Ces événements déclenchent le **Saga Pattern** :
- `payment.completed` → Voyage Service confirme la réservation
- `payment.completed` → User Service envoie une notification in-app
- `payment.failed` → Voyage Service annule la réservation

## Health check response

```json
{
  "status": "ok",
  "service": "payment-service",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "checks": {
    "kafka": { "healthy": true },
    "stripe": { "healthy": true },
    "database": { "healthy": true }
  }
}
```

## Structure du code

```
src/
├── middleware/
│   └── rawBody.ts             # Préserve le raw body pour les webhooks
├── routes/
│   └── payment.ts             # Routes paiement & webhook
├── services/
│   ├── DatabaseService.ts     # Prisma client
│   ├── KafkaService.ts        # Publication événements
│   └── StripeService.ts       # Intégration Stripe
└── index.ts                   # Entry point (ts-node)
```

## Dépendances de démarrage

Le service démarre en séquence (les 3 sont obligatoires) :
1. **PostgreSQL** — obligatoire, arrêt si échec
2. **Stripe** — obligatoire, arrêt si clés manquantes
3. **Kafka** — optionnel, dégradation gracieuse

## Tests

```bash
npm run test
npm run test:coverage
```

---

*Propriétaire et confidentiel © DreamScape 2025*
