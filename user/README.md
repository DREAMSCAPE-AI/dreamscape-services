# User Service

> **Service utilisateurs** — Profils, préférences, onboarding IA, GDPR, et notifications temps réel

- **Port** : 3002 (`process.env.PORT || 3002`)
- **Base de route** : `/api/v1/users`
- **Health check** : `/health`, `/api/health`

## Responsabilités

- Gestion des profils utilisateurs et préférences
- Onboarding et questionnaire de voyage pour les recommandations IA
- Historique d'activité et favoris
- Intégration GDPR (consentements, export, suppression de données)
- Notifications temps réel via Socket.io
- Intégration avec le service IA (`/api/v1/ai`)
- Administration des utilisateurs

## Stack

| Technologie | Rôle |
|-------------|------|
| Express 4 + TypeScript | Framework HTTP |
| Socket.io | Notifications temps réel |
| Prisma + PostgreSQL | Persistance (via `@dreamscape/db`) |
| kafkajs (`@dreamscape/kafka`) | Événements async |
| auditLogger middleware | Journalisation GDPR |
| express-rate-limit | Rate limiting |
| multer | Upload d'avatars |

## Endpoints

### Profil
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/users/profile` | Récupérer le profil |
| `PUT` | `/api/v1/users/profile` | Mettre à jour le profil |
| `POST` | `/api/v1/users/profile/avatar` | Upload avatar |

### Onboarding
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/users/onboarding` | Récupérer l'onboarding |
| `POST` | `/api/v1/users/onboarding` | Soumettre l'onboarding voyage |
| `PUT` | `/api/v1/users/onboarding` | Mettre à jour l'onboarding |

### Favoris & Historique
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/users/favorites` | Liste des favoris |
| `POST` | `/api/v1/users/favorites` | Ajouter un favori |
| `DELETE` | `/api/v1/users/favorites/:id` | Supprimer un favori |
| `GET` | `/api/v1/users/history` | Historique d'activité |

### GDPR
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/users/gdpr/consent` | Récupérer les consentements |
| `POST` | `/api/v1/users/gdpr/consent` | Enregistrer les consentements |
| `POST` | `/api/v1/users/gdpr/export` | Demander l'export des données |
| `DELETE` | `/api/v1/users/gdpr/account` | Demander la suppression du compte |

### Notifications
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/users/notifications` | Lister les notifications |
| `PUT` | `/api/v1/users/notifications/:id/read` | Marquer comme lu |
| `GET` | `/api/v1/users/notification-preferences` | Préférences de notification |
| `PUT` | `/api/v1/users/notification-preferences` | Mettre à jour les préférences |

### Admin
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/admin/users` | Liste des utilisateurs |
| `GET` | `/api/v1/admin/stats` | Statistiques globales |

### Intégration IA
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/ai/recommendations` | Proxy vers AI Service |

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev      # hot reload via tsx watch
```

## Variables d'environnement

```env
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://dreamscape_user:password@localhost:5432/dreamscape
JWT_SECRET=your-super-secret-jwt-key
REDIS_HOST=localhost
REDIS_PORT=6379
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
KAFKA_BROKERS=localhost:9092
AI_SERVICE_URL=http://localhost:3005
```

## Notifications temps réel (Socket.io)

Le service expose un serveur Socket.io sur le même port HTTP :

```typescript
// Connexion côté client
const socket = io('http://localhost:3002', {
  auth: { token: 'Bearer <access_token>' }
})

// L'utilisateur rejoint automatiquement la room user:<userId>
socket.on('notification', (data) => {
  console.log('Nouvelle notification:', data)
})
```

Les notifications sont déclenchées par les événements Kafka :
- `dreamscape.payment.completed` → notification "Paiement confirmé"
- `dreamscape.payment.failed` → notification "Paiement échoué"

## Événements Kafka

**Publiés** :
| Topic | Déclencheur |
|-------|-------------|
| `dreamscape.user.created` | Création de profil |
| `dreamscape.user.updated` | Mise à jour profil |
| `dreamscape.user.preferences.updated` | Modification préférences |
| `dreamscape.user.onboarding.completed` | Fin de l'onboarding |

**Consommés** :
| Topic | Action |
|-------|--------|
| `dreamscape.payment.completed` | Créer notification in-app |
| `dreamscape.payment.failed` | Créer notification in-app |

## Structure du code

```
src/
├── config/
│   └── redis.ts
├── middleware/
│   ├── auth.ts
│   ├── auditLogger.ts       # Journalisation GDPR
│   ├── errorHandler.ts
│   └── rateLimiter.ts
├── routes/
│   ├── profile.ts
│   ├── onboarding.ts
│   ├── favorites.ts
│   ├── history.ts
│   ├── gdpr.ts
│   ├── notificationRoutes.ts
│   ├── notificationPreferencesRoutes.ts
│   ├── aiIntegration.ts
│   ├── admin.ts
│   └── health.ts
├── services/
│   ├── KafkaService.ts
│   ├── NotificationService.ts
│   └── SocketService.ts
└── server.ts
```

## Tests

```bash
npm run test:unit
npm run test:integration  # requiert PostgreSQL + Redis
npm run test:coverage     # seuil 70%
```

---

*Propriétaire et confidentiel © DreamScape 2025*
