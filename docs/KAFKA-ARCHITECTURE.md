# DreamScape - Architecture Événementielle Kafka

## Vue d'ensemble

Cette documentation décrit l'architecture événementielle basée sur Apache Kafka pour la plateforme DreamScape. L'architecture permet une communication asynchrone et découplée entre les microservices.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DreamScape Event-Driven Architecture                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Auth      │    │    User     │    │   Voyage    │    │   Payment   │  │
│  │  Service    │    │   Service   │    │   Service   │    │   Service   │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │          │
│         │ Produce/Consume  │ Produce/Consume  │ Produce/Consume  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Apache Kafka Cluster                          │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                         Topics                                 │  │   │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │  │   │
│  │  │  │ user.created │ │ auth.login   │ │booking.created│           │  │   │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘           │  │   │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │  │   │
│  │  │  │payment.done  │ │ ai.recommend │ │ voyage.search │           │  │   │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘           │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │     AI      │    │Notification │    │  Analytics  │    │   Future    │  │
│  │   Service   │    │   Service   │    │   Service   │    │  Services   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Topics Kafka

### User Events (Service User)
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.user.created` | Nouvel utilisateur créé | User Service | Auth, AI, Analytics |
| `dreamscape.user.updated` | Profil utilisateur mis à jour | User Service | AI, Analytics |
| `dreamscape.user.deleted` | Utilisateur supprimé | User Service | Auth, Voyage, Payment |
| `dreamscape.user.profile.updated` | Profil mis à jour | User Service | AI |
| `dreamscape.user.preferences.updated` | Préférences modifiées | User Service | AI, Voyage |

### Auth Events (Service Auth)
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.auth.login` | Connexion utilisateur | Auth Service | User, Analytics |
| `dreamscape.auth.logout` | Déconnexion utilisateur | Auth Service | User, Analytics |
| `dreamscape.auth.token.refreshed` | Token rafraîchi | Auth Service | Analytics |
| `dreamscape.auth.password.changed` | Mot de passe modifié | Auth Service | Notification |
| `dreamscape.auth.password.reset.requested` | Reset demandé | Auth Service | Notification |
| `dreamscape.auth.account.locked` | Compte verrouillé | Auth Service | Notification, Analytics |

### Voyage Events (Service Voyage)
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.voyage.search.performed` | Recherche effectuée | Voyage Service | AI, Analytics |
| `dreamscape.voyage.booking.created` | Réservation créée | Voyage Service | Payment, Notification |
| `dreamscape.voyage.booking.confirmed` | Réservation confirmée | Voyage Service | User, Notification |
| `dreamscape.voyage.booking.cancelled` | Réservation annulée | Voyage Service | Payment, Notification |
| `dreamscape.voyage.booking.updated` | Réservation mise à jour | Voyage Service | Payment, Notification |
| `dreamscape.voyage.flight.selected` | Vol sélectionné | Voyage Service | AI, Analytics |
| `dreamscape.voyage.hotel.selected` | Hôtel sélectionné | Voyage Service | AI, Analytics |

### Payment Events (Service Payment)
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.payment.initiated` | Paiement initié | Payment Service | Analytics |
| `dreamscape.payment.completed` | Paiement réussi | Payment Service | Voyage, Notification |
| `dreamscape.payment.failed` | Paiement échoué | Payment Service | Voyage, Notification |
| `dreamscape.payment.refunded` | Remboursement effectué | Payment Service | Voyage, Notification |
| `dreamscape.payment.partial.refund` | Remboursement partiel | Payment Service | Voyage, Notification |

### AI Events (Service AI)
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.ai.recommendation.requested` | Recommandation demandée | AI Service | Analytics |
| `dreamscape.ai.recommendation.generated` | Recommandation générée | AI Service | User, Analytics |
| `dreamscape.ai.prediction.made` | Prédiction effectuée | AI Service | Voyage, Analytics |
| `dreamscape.ai.user.behavior.analyzed` | Comportement analysé | AI Service | User, Analytics |

### Notification Events
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.notification.email.requested` | Email demandé | Any Service | Notification Service |
| `dreamscape.notification.sms.requested` | SMS demandé | Any Service | Notification Service |
| `dreamscape.notification.push.requested` | Push demandé | Any Service | Notification Service |

### Analytics Events
| Topic | Description | Producteur | Consommateurs |
|-------|-------------|------------|---------------|
| `dreamscape.analytics.event.tracked` | Événement tracké | Any Service | Analytics Service |
| `dreamscape.analytics.page.view` | Page vue | Frontend | Analytics Service |

## Structure des Événements

Tous les événements suivent une structure commune :

```typescript
interface BaseEvent<T> {
  eventId: string;          // UUID unique de l'événement
  eventType: string;        // Type de l'événement (ex: "user.created")
  timestamp: string;        // ISO 8601 timestamp
  version: string;          // Version du schéma (ex: "1.0")
  source: string;           // Service émetteur
  correlationId?: string;   // ID de corrélation pour le tracing
  causationId?: string;     // ID de l'événement causant celui-ci
  metadata?: Record<string, unknown>;
  payload: T;               // Données spécifiques à l'événement
}
```

### Exemple d'événement

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "user.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0",
  "source": "user-service",
  "correlationId": "corr-123456",
  "payload": {
    "userId": "user-123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Consumer Groups

Chaque service a son propre consumer group pour garantir :
- Le traitement une seule fois par service
- Le load balancing entre les instances

| Service | Consumer Group |
|---------|---------------|
| Auth Service | `dreamscape-auth-service-group` |
| User Service | `dreamscape-user-service-group` |
| Voyage Service | `dreamscape-voyage-service-group` |
| Payment Service | `dreamscape-payment-service-group` |
| AI Service | `dreamscape-ai-service-group` |
| Notification Service | `dreamscape-notification-service-group` |
| Analytics Service | `dreamscape-analytics-service-group` |

## Configuration

### Variables d'environnement

```bash
# Connexion Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_SSL=false
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=
KAFKA_SASL_MECHANISM=plain

# Timeouts
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_SESSION_TIMEOUT=30000
KAFKA_HEARTBEAT_INTERVAL=3000

# Consumer
KAFKA_MAX_BYTES_PER_PARTITION=1048576
KAFKA_MIN_BYTES=1
KAFKA_MAX_BYTES=10485760
KAFKA_MAX_WAIT_TIME=5000

# Producer
KAFKA_AUTO_CREATE_TOPICS=true
KAFKA_TRANSACTION_TIMEOUT=60000
KAFKA_IDEMPOTENT=true
KAFKA_MAX_IN_FLIGHT_REQUESTS=5

# Logging
KAFKA_LOG_LEVEL=info
```

## Utilisation

### Initialiser Kafka dans un service

```typescript
import { authKafkaService } from './services/KafkaService';

// Au démarrage du service
async function startService() {
  await authKafkaService.initialize();

  // S'abonner aux événements
  await authKafkaService.subscribeToUserEvents({
    onUserCreated: async (event, metadata) => {
      console.log('User created:', event.payload);
    },
  });
}

// À l'arrêt du service
async function stopService() {
  await authKafkaService.shutdown();
}
```

### Publier un événement

```typescript
import { authKafkaService } from './services/KafkaService';

// Dans un controller ou service
async function handleLogin(userId: string, sessionId: string) {
  await authKafkaService.publishLogin({
    userId,
    sessionId,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    loginAt: new Date().toISOString(),
    method: 'password',
  });
}
```

## Docker Compose

Pour démarrer l'infrastructure Kafka localement :

```bash
# Démarrer Kafka (minimal)
docker-compose -f docker/docker-compose.kafka.yml up -d

# Avec l'interface Kafka UI
docker-compose -f docker/docker-compose.kafka.yml --profile ui up -d

# Avec Schema Registry
docker-compose -f docker/docker-compose.kafka.yml --profile schema up -d
```

### Accès aux services

- **Kafka Broker**: `localhost:9092`
- **Kafka UI**: `http://localhost:8080`
- **Schema Registry**: `http://localhost:8081`
- **Zookeeper**: `localhost:2181`

## Monitoring

### Health Check

Chaque service expose un endpoint de health check Kafka :

```typescript
const health = await kafkaService.healthCheck();
// {
//   healthy: true,
//   details: {
//     clusterId: 'xxx',
//     brokers: 1,
//     controller: 1,
//     topicsCount: 32,
//     connectedConsumers: 1,
//     producerConnected: true
//   }
// }
```

### Métriques importantes

- Lag des consumers
- Throughput des messages
- Latence de publication
- Erreurs de connexion
- Taille des partitions

## Best Practices

### 1. Idempotence
Toujours concevoir les consumers pour être idempotents. Un même événement peut être délivré plusieurs fois.

### 2. Ordre des événements
L'ordre n'est garanti que pour les messages avec la même clé (key) dans une même partition.

### 3. Gestion des erreurs
Implémenter une Dead Letter Queue pour les messages qui échouent après plusieurs tentatives.

### 4. Versioning
Utiliser le champ `version` pour gérer l'évolution des schémas.

### 5. Correlation ID
Toujours propager le `correlationId` pour le distributed tracing.

## Troubleshooting

### Problèmes courants

1. **Consumer lag élevé**
   - Augmenter le nombre d'instances du service
   - Augmenter le nombre de partitions

2. **Timeout de connexion**
   - Vérifier la connectivité réseau
   - Vérifier les brokers Kafka

3. **Messages perdus**
   - Vérifier la configuration de réplication
   - Activer l'idempotence du producer

## Références

- [KafkaJS Documentation](https://kafka.js.org/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Confluent Platform](https://docs.confluent.io/)
