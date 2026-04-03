# @dreamscape/kafka — Package partagé Kafka

> **Package utilitaire Kafka** — Abstractions kafkajs partagées entre tous les services DreamScape

## Présentation

Ce package fournit les utilities Kafka communes utilisées par les services backend : configuration des topics, types des événements, helpers de publication et de consommation.

Il est consommé par les services via une dépendance locale :
```json
"@dreamscape/kafka": "file:../shared/kafka"
```

## Structure

```
shared/kafka/
├── src/
│   ├── config.ts        # Définition des topics Kafka
│   ├── types.ts         # Types TypeScript des événements
│   ├── producer.ts      # Helper de publication
│   ├── consumer.ts      # Helper de consommation
│   └── index.ts         # Exports publics
├── dist/                # Output compilé (ignoré par git)
├── package.json
└── tsconfig.json
```

## Topics disponibles

Les topics sont définis dans `src/config.ts` :

```
dreamscape.user.created
dreamscape.user.updated
dreamscape.user.login
dreamscape.user.logout
dreamscape.user.registered
dreamscape.user.preferences.updated
dreamscape.user.onboarding.completed

dreamscape.voyage.booking.created
dreamscape.voyage.booking.confirmed
dreamscape.voyage.booking.cancelled
dreamscape.voyage.search.performed
dreamscape.voyage.cart.item.added

dreamscape.payment.initiated
dreamscape.payment.completed
dreamscape.payment.failed
dreamscape.payment.refunded

dreamscape.ai.recommendation.generated
dreamscape.ai.prediction.created
```

Convention de nommage : `dreamscape.<domain>.<event>[.<sub-event>]`

## Usage dans un service

```typescript
import { createEvent, KafkaService } from '@dreamscape/kafka'

// Publication d'un événement
await kafkaService.publishEvent(
  createEvent('dreamscape.payment.completed', {
    userId: 'user-123',
    amount: 299.99,
    currency: 'EUR',
    bookingId: 'booking-456'
  })
).catch(err => console.error('Kafka publish failed:', err))
// Non-bloquant : toujours utiliser .catch()
```

## Rebuild obligatoire

> **IMPORTANT** : Après toute modification des sources (`src/`), le package doit être recompilé avant que les services puissent utiliser les nouvelles définitions.

```bash
cd shared/kafka
npm run build    # Compile TypeScript vers dist/
```

Les services importent le code compilé depuis `dist/`. Sans rebuild, les modifications restent invisibles.

## Ajouter un nouveau topic

1. Ajouter le topic dans `src/config.ts`
2. Ajouter le type de l'événement dans `src/types.ts`
3. Rebuilder : `npm run build`
4. Mettre à jour les services producteurs (publication)
5. Mettre à jour les services consommateurs (subscription)

## Build & Installation

```bash
# Depuis le dossier shared/kafka
npm install
npm run build

# Depuis un service consommateur (après modification du package)
cd auth && npm install    # Re-résout le symlink file:
```

## Variables d'environnement (services)

```env
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=dreamscape-<service-name>
KAFKA_GROUP_ID=dreamscape-<service-name>-group
```

---

*Propriétaire et confidentiel © DreamScape 2025*
