# DreamScape Mail Service

Service d'envoi d'emails via **SendGrid** pour la plateforme DreamScape.

## Architecture

```
mail/
├── src/
│   ├── server.ts              # Point d'entrée Express
│   ├── config/index.ts        # Configuration centralisée
│   ├── services/
│   │   ├── EmailService.ts    # Client SendGrid (singleton, dry-run si pas de clé)
│   │   └── KafkaService.ts    # Consommateur d'événements Kafka
│   ├── routes/
│   │   ├── health.ts          # Health checks (/health, /health/live, /health/ready)
│   │   └── mail.ts            # API REST (/api/v1/mail/*)
│   ├── middleware/
│   │   ├── errorHandler.ts    # Gestion des erreurs + 404
│   │   └── rateLimiter.ts     # Rate limiting sur les endpoints mail
│   ├── templates/index.ts     # Templates HTML avec layout DreamScape
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
# Renseigner SENDGRID_API_KEY dans .env (optionnel : mode dry-run sinon)
npm install
npm run dev
```

Le service démarre sur le port **3007** par défaut.

## API REST

| Méthode | Endpoint                              | Description                              |
|---------|---------------------------------------|------------------------------------------|
| POST    | `/api/v1/mail/send`                   | Envoyer un email (HTML / texte)          |
| POST    | `/api/v1/mail/send-template`          | Envoyer via un template nommé            |
| GET     | `/api/v1/mail/templates`              | Lister les templates disponibles         |
| GET     | `/api/v1/mail/preview/:templateName`  | Prévisualiser un template dans le navigateur |
| GET     | `/health`                             | Health check complet (SendGrid + Kafka)  |
| GET     | `/health/live`                        | Liveness probe                           |
| GET     | `/health/ready`                       | Readiness probe (SendGrid)               |

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

### Prévisualisation des templates

Ouvrir directement dans le navigateur pour voir le rendu HTML sans envoyer d'email :

```
GET http://localhost:3007/api/v1/mail/preview/welcome
GET http://localhost:3007/api/v1/mail/preview/passwordReset
GET http://localhost:3007/api/v1/mail/preview/bookingConfirmation
...
```

Les placeholders sont remplis avec des données d'exemple. Possibilité de surcharger via query params :

```
GET http://localhost:3007/api/v1/mail/preview/welcome?firstName=Nicolas&loginUrl=https://dreamscape.com/login
```

## Templates

7 templates HTML intégrés avec un layout partagé (header gradient DreamScape, boutons stylisés, info-boxes, footer). Chaque template fonctionne en **deux modes** :

1. **SendGrid dynamic template** — renseigner le champ `id` avec l'ID du template SendGrid
2. **HTML inline (fallback)** — si `id` est vide, le service utilise le `subject` et le `html` définis dans le code

| Template               | Description                            | Champs requis                                    |
|------------------------|----------------------------------------|--------------------------------------------------|
| `welcome`              | Email de bienvenue post-inscription    | `firstName`, `loginUrl`                          |
| `passwordReset`        | Lien de réinitialisation du mot de passe | `firstName`, `resetUrl`, `expiresIn`           |
| `passwordChanged`      | Confirmation de changement de mot de passe | `firstName`                                  |
| `bookingConfirmation`  | Confirmation de réservation            | `firstName`, `bookingRef`, `destination`, `departureDate` |
| `bookingCancellation`  | Annulation de réservation              | `firstName`, `bookingRef`                        |
| `paymentReceipt`       | Reçu de paiement                       | `firstName`, `amount`, `currency`, `bookingRef`  |
| `paymentFailed`        | Échec de paiement                      | `firstName`, `bookingRef`, `retryUrl`            |

Pour ajouter un template : éditer `src/templates/index.ts` et ajouter une entrée dans l'objet `templates`.

## Intégration Kafka

Le service consomme le topic `EMAIL_REQUESTED` (consumer group : `NOTIFICATION_SERVICE`) pour traiter les envois asynchrones déclenchés par les autres micro-services. L'initialisation Kafka est non-bloquante : si le broker n'est pas disponible, le service démarre quand même et l'API REST reste fonctionnelle.

## Mode dry-run

Si `SENDGRID_API_KEY` n'est pas configuré, le service fonctionne en mode **dry-run** : les emails ne sont pas envoyés mais loggés en console. Pratique pour le développement local.

> **Note** : pour envoyer de vrais emails, l'adresse expéditeur (`SENDGRID_FROM_EMAIL`) doit correspondre à une **Sender Identity vérifiée** dans le dashboard SendGrid.

## Variables d'environnement

| Variable                    | Description                          | Défaut                        |
|-----------------------------|--------------------------------------|-------------------------------|
| `PORT`                      | Port du service                      | `3007`                        |
| `NODE_ENV`                  | Environnement                        | `development`                 |
| `SENDGRID_API_KEY`          | Clé API SendGrid                     | — (dry-run si absent)         |
| `SENDGRID_FROM_EMAIL`       | Adresse expéditeur                   | `no-reply@dreamscape.com`    |
| `SENDGRID_FROM_NAME`        | Nom expéditeur                       | `DreamScape`                  |
| `CORS_ORIGIN`               | Origins CORS autorisés               | `http://localhost:5173`       |
| `KAFKA_BROKERS`             | Brokers Kafka                        | `localhost:9092`              |
| `KAFKA_CLIENT_ID`           | Client ID Kafka                      | `mail-service`                |
| `MAIL_RATE_LIMIT_WINDOW_MS` | Fenêtre de rate limit (ms)           | `60000`                       |
| `MAIL_RATE_LIMIT_MAX`       | Nombre max de requêtes par fenêtre   | `10`                          |
