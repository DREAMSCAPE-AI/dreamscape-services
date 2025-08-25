🔧 DreamScape Backend Services

> **Microservices Backend Platform** - Tous les services backend DreamScape

## 📁 Structure des Services

- **auth/** - Service d'authentification & autorisation (Port 3001)
- **user/** - Service gestion utilisateurs & profils (Port 3002)
- **voyage/** - Service voyage, réservation & API Amadeus (Port 3003)
- **payment/** - Service paiement & transactions (Port 3004)
- **ai/** - Service IA & recommandations personnalisées (Port 3005)
- **panorama/** - Service panorama/VR immersif (Port 3006)

## 🛠️ Stack Technique

### **Backend Core**
- **Node.js 18+** - Environnement d'exécution
- **Express** - Framework web
- **TypeScript** - Type safety
- **Prisma** - ORM base de données

### **Bases de Données**
- **PostgreSQL** - Données principales
- **MongoDB** - Documents & analytics
- **Redis** - Cache & sessions

### **External APIs**
- **Amadeus SDK** - API voyage & réservations
- **OpenAI API** - Intelligence artificielle
- **Stripe API** - Paiements sécurisés

### **Architecture**
- **JWT Authentication** - Sécurité inter-services
- **Circuit Breaker** - Résilience API externes
- **Rate Limiting** - Protection contre les abus
- **Event-Driven** - Communication asynchrone

## 🚀 Quick Start

### Développement Local
```bash
# Installation des dépendances
npm install

# Variables d'environnement
cp .env.example .env

# Base de données
npm run migrate
npm run seed

# Démarrer tous les services
docker-compose up -d

# Ou service individuel
cd auth && npm install && npm run dev
```

### Ports par Défaut
| Service  | Port | Description                    |
|----------|------|--------------------------------|
| Auth     | 3001 | Authentification & JWT         |
| User     | 3002 | Profils & préférences         |
| Voyage   | 3003 | Recherches & réservations     |
| Payment  | 3004 | Paiements & transactions      |
| AI       | 3005 | Recommandations IA            |
| Panorama | 3006 | Expériences VR                |

## 📊 Communication Inter-Services

```
┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   Auth Service  │
│     (3000)      │    │     (3001)      │
└─────────────────┘    └─────────────────┘
         │                       │
         ├───────┬───────┬───────┼───────┬────────┐
         │       │       │       │       │        │
    ┌─────────┐ │  ┌─────────┐ │  ┌─────────┐   │
    │  User   │ │  │ Voyage  │ │  │   AI    │   │
    │ (3002)  │ │  │ (3003)  │ │  │ (3005)  │   │
    └─────────┘ │  └─────────┘ │  └─────────┘   │
         │       │       │       │       │        │
    ┌─────────┐ │  ┌─────────────────┐   │   ┌─────────┐
    │Payment  │ │  │    Panorama     │   │   │  Redis  │
    │ (3004)  │ │  │     (3006)      │   │   │ Cache   │
    └─────────┘ │  └─────────────────┘   │   └─────────┘
                │                        │
           ┌─────────────┐         ┌─────────────┐
           │ PostgreSQL  │         │  MongoDB    │
           │  Primary    │         │ Analytics   │
           └─────────────┘         └─────────────┘
```

## 🧪 Tests & Qualité

```bash
# Tests unitaires
npm run test

# Tests d'intégration
npm run test:integration

# Couverture de code
npm run test:coverage

# Linting & formatage
npm run lint
npm run lint:fix
```

## 🚀 Déploiement

```bash
# Build production
npm run build

# Images Docker
npm run docker:build

# Déploiement K8s
kubectl apply -f k8s/

# Terraform infrastructure
cd terraform && terraform apply
```

## 🔐 Sécurité

- **JWT Authentication** avec refresh tokens
- **RBAC** (Role-Based Access Control)
- **API Rate Limiting** par service
- **Input Validation** & sanitisation
- **HTTPS/TLS** encryption
- **Secrets Management** via vault

## 📈 Monitoring

- **Health Checks** - `/health` sur chaque service
- **Prometheus Metrics** - Métriques applicatives
- **Structured Logging** - JSON centralisé
- **Error Tracking** - Sentry intégration

## 📚 Services Documentation

### Auth Service (3001)
- JWT token generation & validation
- User authentication & authorization
- Role-based access control
- Password hashing & security

### User Service (3002)  
- User profile management
- Preferences & settings
- Activity tracking
- User analytics

### Voyage Service (3003)
- Flight search & booking (Amadeus API)
- Hotel & accommodation booking
- Activity & experience booking
- Itinerary management
- Booking lifecycle management

### Payment Service (3004)
- Stripe payment integration
- Transaction management
- Refund processing
- Payment analytics

### AI Service (3005)
- Personalized recommendations
- User behavior analysis
- Predictive analytics
- OpenAI integration

### Panorama Service (3006)
- VR/360° experience management
- Panoramic content delivery
- Immersive navigation
- Media processing

## 🤝 Contributing

1. **Branch Naming**: `feature/service-name/description`
2. **Commit Convention**: Conventional commits
3. **Pull Requests**: Must pass all tests
4. **Code Review**: Required before merge

## 📄 License

Propriétaire et confidentiel © DreamScape 2025

