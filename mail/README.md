# DreamScape Mail Service

Service d'envoi d'emails via **SendGrid** pour la plateforme DreamScape.

## Architecture

```
mail/
├── src/
│   ├── server.ts              # Point d'entrée Express
│   ├── config/index.ts        # Configuration centralisée
│   ├── services/
│   │   ├── EmailService.ts    # Client SendGrid (singleton)
│   │   └── KafkaService.ts    # Consommateur d'événements Kafka
│   ├── routes/
│   │   ├── health.ts          # Health checks (/health, /health/live, /health/ready)
│   │   └── mail.ts            # API REST d'envoi (/api/v1/mail/*)
│   ├── middleware/
│   │   ├── errorHandler.ts    # Gestion des erreurs
│   │   └── rateLimiter.ts     # Rate limiting sur les endpoints mail
│   ├── templates/index.ts     # Registre des templates SendGrid
│   └── types/index.ts         # Types TypeScript
├── Dockerfile.prod
├── package.json
├── tsconfig.json
├── .env / .env.example
└── README.md
```

## Démarrage rapide

```bash
cd mail
cp .env.example .env
# Renseigner SENDGRID_API_KEY dans .env
npm install
npm run dev
```

Le service démarre sur le port **3006** par défaut.

## API REST

| Méthode | Endpoint                    | Description                          |
|---------|-----------------------------|--------------------------------------|
| POST    | `/api/v1/mail/send`          | Envoyer un email (HTML / texte / template) |
| POST    | `/api/v1/mail/send-template` | Envoyer via un template nommé        |
| GET     | `/api/v1/mail/templates`     | Lister les templates disponibles     |
| GET     | `/health`                    | Health check complet                 |
| GET     | `/health/live`               | Liveness probe                       |
| GET     | `/health/ready`              | Readiness probe                      |

### Exemple — envoi direct

```json
POST /api/v1/mail/send
{
  "to": "user@example.com",
  "subject": "Bienvenue sur DreamScape",
  "html": "<h1>Bienvenue !</h1><p>Votre compte est prêt.</p>"
}
```

### Exemple — envoi via template

```json
POST /api/v1/mail/send-template
{
  "to": "user@example.com",
  "templateName": "bookingConfirmation",
  "dynamicData": {
    "firstName": "Nicolas",
    "bookingRef": "DS-2026-1234",
    "destination": "Bali",
    "departureDate": "2026-06-15"
  }
}
```

## Intégration Kafka

Le service consomme le topic `EMAIL_REQUESTED` pour traiter les envois asynchrones déclenchés par les autres micro-services. Tout service peut publier sur ce topic pour déclencher un email sans appeler l'API REST.

## Mode dry-run

Si `SENDGRID_API_KEY` n'est pas configuré, le service fonctionne en mode **dry-run** : les emails ne sont pas envoyés mais loggés en console. Pratique pour le développement local.

## Templates SendGrid

Les templates sont déclarés dans `src/templates/index.ts`. Ajouter l'ID du template SendGrid correspondant une fois créé dans le dashboard SendGrid.

## Variables d'environnement

| Variable                    | Description                          | Défaut                        |
|-----------------------------|--------------------------------------|-------------------------------|
| `PORT`                      | Port du service                      | `3006`                        |
| `NODE_ENV`                  | Environnement                        | `development`                 |
| `SENDGRID_API_KEY`          | Clé API SendGrid                     | —                             |
| `SENDGRID_FROM_EMAIL`       | Adresse expéditeur                   | `no-reply@dreamscape.com`    |
| `SENDGRID_FROM_NAME`        | Nom expéditeur                       | `DreamScape`                  |
| `CORS_ORIGIN`               | Origins CORS autorisés               | `http://localhost:5173`       |
| `KAFKA_BROKERS`             | Brokers Kafka                        | `localhost:9092`              |
| `KAFKA_CLIENT_ID`           | Client ID Kafka                      | `mail-service`                |
| `MAIL_RATE_LIMIT_WINDOW_MS` | Fenêtre de rate limit (ms)           | `60000`                       |
| `MAIL_RATE_LIMIT_MAX`       | Nombre max de requêtes par fenêtre   | `10`                          |
