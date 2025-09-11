# Dreamscape Database Configuration

Ce dossier contient la configuration unifiée de la base de données PostgreSQL pour tous les services Dreamscape.

## Architecture Simplifiée

- **Une seule base PostgreSQL** pour tous les services
- **Prisma unifié** avec un schéma centralisé
- **Client partagé** pour éviter les duplications

## Structure

```
db/
├── schema.prisma     # Schéma Prisma unifié
├── client.ts         # Client Prisma partagé
├── seed.ts           # Script de seed
├── package.json      # Dépendances DB
├── .env.example      # Exemple de configuration
└── README.md         # Ce fichier
```

## Installation

1. Copier le fichier d'environnement :
```bash
cp .env.example .env
```

2. Configurer la DATABASE_URL dans le .env

3. Installer les dépendances :
```bash
npm install
```

4. Générer le client Prisma :
```bash
npm run db:generate
```

5. Appliquer le schéma :
```bash
npm run db:push
```

6. (Optionnel) Populer avec des données de test :
```bash
npm run db:seed
```

## Utilisation dans les services

Dans chaque service, importer le client depuis le dossier db :

```typescript
import { prisma } from '../db/client';

// Utiliser le client
const users = await prisma.user.findMany();
```

## Commandes utiles

- `npm run db:generate` - Générer le client Prisma
- `npm run db:push` - Appliquer le schéma à la DB
- `npm run db:migrate` - Créer et appliquer une migration
- `npm run db:studio` - Ouvrir Prisma Studio
- `npm run db:reset` - Reset complet de la DB
- `npm run db:seed` - Populer avec des données de test

## Services couverts

### Auth Service
- `User` - Utilisateurs avec authentification
- Relations avec UserProfile

### User Service  
- `UserProfile` - Profils utilisateur détaillés
- `UserBehavior` - Tracking des actions utilisateur

### Voyage Service
- `FlightData` - Données de vol
- `HotelData` - Données d'hôtel
- `BookingData` - Réservations
- `LocationData` - Destinations

### AI Service
- `PredictionData` - Prédictions IA
- `Analytics` - Analytics cross-service