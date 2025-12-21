# Payment Service - Kafka Events Integration Guide

**DR-378 / DR-380**: Ce guide documente comment publier les événements Kafka payment dans les routes une fois qu'elles seront implémentées.

## Événements Payment à Publier

### 1. payment.initiated
**Quand**: Lorsqu'un paiement est initié (création Payment Intent Stripe)
**Route**: `POST /api/v1/payment/create-payment-intent`

```typescript
import paymentKafkaService from '../services/KafkaService';

router.post('/create-payment-intent', async (req, res) => {
  try {
    // Créer Payment Intent Stripe
    const paymentIntent = await stripe.paymentIntents.create({...});

    // Publier événement Kafka - DR-378 / DR-380
    paymentKafkaService.publishPaymentInitiated({
      paymentId: paymentIntent.id,
      bookingId: req.body.bookingId,
      userId: req.user.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      timestamp: new Date()
    }).catch(err => console.error('[PaymentInitiated] Failed to publish Kafka event:', err));

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. payment.completed
**Quand**: Lorsqu'un paiement est complété avec succès (webhook Stripe)
**Route**: `POST /api/v1/payment/webhook` (événement `payment_intent.succeeded`)

```typescript
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;

      // Publier événement Kafka - DR-378 / DR-380 (CRITIQUE pour Saga)
      paymentKafkaService.publishPaymentCompleted({
        paymentId: paymentIntent.id,
        bookingId: paymentIntent.metadata.bookingId,
        userId: paymentIntent.metadata.userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        stripeChargeId: paymentIntent.latest_charge,
        timestamp: new Date()
      }).catch(err => console.error('[PaymentCompleted] Failed to publish Kafka event:', err));
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
```

### 3. payment.failed
**Quand**: Lorsqu'un paiement échoue (webhook Stripe)
**Route**: `POST /api/v1/payment/webhook` (événement `payment_intent.payment_failed`)

```typescript
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;

      // Publier événement Kafka - DR-378 / DR-380
      paymentKafkaService.publishPaymentFailed({
        paymentId: paymentIntent.id,
        bookingId: paymentIntent.metadata.bookingId,
        userId: paymentIntent.metadata.userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        errorCode: paymentIntent.last_payment_error?.code,
        errorMessage: paymentIntent.last_payment_error?.message,
        timestamp: new Date()
      }).catch(err => console.error('[PaymentFailed] Failed to publish Kafka event:', err));
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
```

### 4. payment.refunded
**Quand**: Lorsqu'un remboursement est effectué
**Route**: `POST /api/v1/payment/refund`

```typescript
router.post('/refund', async (req, res) => {
  try {
    const { paymentIntentId, amount, reason } = req.body;

    // Créer remboursement Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount,
      reason: reason
    });

    // Publier événement Kafka - DR-378 / DR-380
    paymentKafkaService.publishPaymentRefunded({
      paymentId: paymentIntentId,
      refundId: refund.id,
      bookingId: req.body.bookingId,
      userId: req.user.id,
      amount: refund.amount,
      currency: refund.currency,
      reason: reason,
      timestamp: new Date()
    }).catch(err => console.error('[PaymentRefunded] Failed to publish Kafka event:', err));

    res.json({ success: true, refund });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Saga Pattern: Payment → Booking Confirmation

### Flow Critique MVP

1. **User** → Crée une réservation → `voyage-service`
2. **voyage-service** → Crée booking en état `PENDING_PAYMENT`
3. **payment-service** → Reçoit demande paiement → Publie `payment.initiated`
4. **Stripe** → Webhook `payment_intent.succeeded`
5. **payment-service** → Publie `payment.completed` 🔥
6. **voyage-service** → Consomme `payment.completed` → Met booking en état `CONFIRMED`
7. **notification-service** (futur) → Consomme `payment.completed` → Envoie reçu email

### Gestion des Échecs

- Si `payment.failed` → voyage-service annule le booking automatiquement
- Si timeout (no payment after 15min) → voyage-service annule le booking
- Si `payment.refunded` → voyage-service met booking en état `REFUNDED`

## Patterns d'Implémentation

### Fire-and-Forget (Non-blocking)

Tous les événements Kafka sont publiés de manière asynchrone avec `.catch()` pour ne pas bloquer les réponses HTTP.

```typescript
paymentKafkaService.publishPaymentCompleted(payload)
  .catch(err => console.error('[PaymentCompleted] Failed to publish Kafka event:', err));
```

### Garanties d'Ordre

Les événements sont partitionnés par `paymentId` pour garantir l'ordre des événements pour un même paiement.

### Idempotence

Les webhooks Stripe peuvent être reçus plusieurs fois. Assurez-vous que:
- Les événements Kafka ont des `eventId` uniques
- voyage-service gère l'idempotence (ne confirme pas 2x le même booking)

## Topics Kafka

- `dreamscape.payment.initiated`
- `dreamscape.payment.completed`
- `dreamscape.payment.failed`
- `dreamscape.payment.refunded`

## Tests d'Intégration

Voir: `dreamscape-tests/integration/kafka/payment-events-kafka.test.ts`

## Dépendances

- **Stripe API**: Requis pour les vrais paiements
- **Kafka**: Doit être running (`docker-compose.kafka.yml`)
- **voyage-service**: Doit consommer `payment.completed` pour confirmer les bookings

## Prochaines Étapes (Post-DR-378)

1. Implémenter les routes payment réelles avec Stripe
2. Ajouter la publication des événements selon ce guide
3. Implémenter le consumer dans voyage-service pour `payment.completed`
4. Tester le flow complet end-to-end

---

**Références**:
- DR-378: US-INFRA-010 - Activation Kafka dans payment-service
- DR-422 à DR-425: User Stories payment (Stripe, Webhooks, Transactions, Remboursements)
- DR-391: Saga Pattern Booking (dépend de payment.completed)
