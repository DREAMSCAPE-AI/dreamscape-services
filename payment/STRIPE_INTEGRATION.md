# Stripe Payment Integration - DreamScape Payment Service

## Overview

This document describes the Stripe payment integration for the DreamScape travel booking platform. The implementation follows a secure, event-driven architecture using Stripe Payment Intents and webhooks.

## Architecture

### Payment Flow

```
User adds items to cart
    ↓
User clicks "Proceed to Checkout"
    ↓
Voyage Service calls Payment Service
    ↓
Payment Service creates Stripe Payment Intent
    ↓
Voyage Service creates DRAFT booking with Payment Intent ID
    ↓
User redirected to /checkout page
    ↓
User enters payment details (Stripe Elements)
    ↓
Frontend confirms payment with Stripe
    ↓
Stripe webhook → Payment Service
    ↓
Payment Service publishes Kafka event (payment.completed)
    ↓
Voyage Service confirms booking
    ↓
Cart cleared → User sees confirmation
```

### Service Communication

- **Voyage Service → Payment Service**: HTTP REST (synchronous)
- **Payment Service → Voyage Service**: Kafka events (asynchronous)
- **Frontend → Stripe**: Direct API calls (via Stripe.js)
- **Stripe → Payment Service**: Webhooks (signature verified)

## Payment Service Implementation

### 1. Environment Configuration

Create a `.env` file in `dreamscape-services/payment/`:

```bash
# Stripe Configuration (Test Mode)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Server
PORT=3004

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/dreamscape

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=payment-service

# Voyage Service (for callbacks)
VOYAGE_SERVICE_URL=http://localhost:3003

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### 2. Getting Stripe API Keys

1. **Create Stripe Account**: Go to [stripe.com](https://stripe.com) and sign up
2. **Access Test Keys**: Dashboard → Developers → API keys
3. **Get Webhook Secret**:
   - For local development: Use Stripe CLI (see below)
   - For production: Dashboard → Developers → Webhooks → Add endpoint

### 3. Service Architecture

#### StripeService.ts
- Low-level Stripe SDK wrapper
- Handles API key configuration
- Methods: createPaymentIntent, getPaymentIntent, cancelPaymentIntent, createRefund
- Webhook signature verification

#### PaymentService.ts
- Business logic layer
- Orchestrates payment lifecycle
- Publishes Kafka events
- Database persistence (TODO)

#### WebhookService.ts
- Processes Stripe webhook events
- Routes events to appropriate handlers
- Handles: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled

### 4. API Endpoints

#### POST /api/v1/payment/create-intent
Creates a Stripe Payment Intent for a booking.

**Request:**
```json
{
  "amount": 50000,
  "currency": "eur",
  "bookingId": "booking-123",
  "bookingReference": "DREAM-2024-001",
  "userId": "user-123",
  "metadata": {
    "cartId": "cart-456"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_xxx",
    "clientSecret": "pi_xxx_secret_yyy",
    "amount": 50000,
    "currency": "eur",
    "status": "requires_payment_method"
  }
}
```

#### GET /api/v1/payment/config
Returns Stripe publishable key for frontend.

**Response:**
```json
{
  "success": true,
  "data": {
    "publishableKey": "pk_test_xxx"
  }
}
```

#### POST /api/v1/payment/webhook
Stripe webhook endpoint (requires raw body).

**Headers:**
- `stripe-signature`: Webhook signature for verification

#### POST /api/v1/payment/refund
Process a refund for a payment.

**Request:**
```json
{
  "paymentIntentId": "pi_xxx",
  "amount": 25000,
  "reason": "Customer requested cancellation",
  "bookingId": "booking-123",
  "userId": "user-123"
}
```

#### POST /api/v1/payment/cancel/:paymentIntentId
Cancel a payment intent.

### 5. Kafka Events

#### payment.completed
Published when payment succeeds.

```json
{
  "paymentId": "pi_xxx",
  "bookingId": "booking-123",
  "bookingReference": "DREAM-2024-001",
  "userId": "user-123",
  "amount": 500.00,
  "currency": "EUR",
  "paymentMethod": "card",
  "completedAt": "2024-01-20T10:30:00Z"
}
```

#### payment.failed
Published when payment fails.

```json
{
  "paymentId": "pi_xxx",
  "bookingId": "booking-123",
  "bookingReference": "DREAM-2024-001",
  "userId": "user-123",
  "amount": 500.00,
  "currency": "EUR",
  "reason": "Your card was declined",
  "failedAt": "2024-01-20T10:30:00Z"
}
```

## Frontend Implementation

### 1. Install Dependencies

```bash
cd dreamscape-frontend/web-client
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Pages and Components

#### CheckoutPage (`/checkout`)
- Initializes Stripe with publishable key
- Wraps payment form in Stripe Elements provider
- Displays booking summary
- Handles checkout data from cart navigation

#### StripeCheckoutForm
- Renders Stripe PaymentElement
- Handles payment submission
- Shows loading states and error messages
- Confirms payment with Stripe
- Redirects to confirmation page

#### PaymentConfirmationPage (`/payment/confirmation`)
- Displays payment success/failure/processing status
- Shows booking details
- Provides next steps
- Offers receipt download (TODO)

### 3. Cart Integration

The CartDrawer component has been updated to:
1. Call `checkout()` from cartStore
2. Navigate to `/checkout` with payment data
3. Close drawer after navigation

## Local Development Setup

### 1. Start Payment Service

```bash
cd dreamscape-services/payment
npm install
npm run dev
```

Service runs on: http://localhost:3004

### 2. Start Stripe CLI (for webhooks)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3004/api/v1/payment/webhook

# Copy the webhook signing secret (whsec_xxx) to .env
```

### 3. Test Payment Flow

```bash
# Start Voyage Service
cd dreamscape-services/voyage
npm run dev

# Start Frontend
cd dreamscape-frontend/web-client
npm run dev
```

### 4. Test Cards

Stripe provides test cards for different scenarios:

- **Successful payment**: `4242 4242 4242 4242`
- **Declined payment**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`
- **Insufficient funds**: `4000 0000 0000 9995`

Use any future expiry date, any 3-digit CVC, and any postal code.

## Security Considerations

### 1. API Key Management
- ✅ API keys stored in environment variables
- ✅ Never commit keys to version control
- ✅ Separate test and production keys
- ⚠️ TODO: Use secrets manager in production (AWS Secrets Manager, HashiCorp Vault)

### 2. Webhook Security
- ✅ Signature verification on all webhooks
- ✅ Raw body capture for signature validation
- ✅ Webhook secret validation

### 3. Payment Intent Security
- ✅ Payment Intent created server-side
- ✅ Client receives only clientSecret (safe to expose)
- ✅ Metadata includes booking/user IDs for verification

### 4. CORS Configuration
- ✅ Frontend URL whitelisted
- ✅ Credentials enabled for auth cookies

## Testing

### Unit Tests (TODO)
```bash
cd dreamscape-services/payment
npm run test:unit
```

### Integration Tests (TODO)
```bash
npm run test:integration
```

### E2E Tests (TODO)
```bash
cd dreamscape-tests
npm run test:e2e:payment
```

## Production Deployment

### 1. Environment Variables

Update production `.env` with:
- `STRIPE_SECRET_KEY`: Production secret key (sk_live_xxx)
- `STRIPE_PUBLISHABLE_KEY`: Production publishable key (pk_live_xxx)
- `STRIPE_WEBHOOK_SECRET`: Production webhook secret from Stripe Dashboard

### 2. Webhook Endpoint

Configure webhook in Stripe Dashboard:
1. Go to Developers → Webhooks
2. Add endpoint: `https://api.dreamscape.com/api/v1/payment/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `charge.dispute.created`
4. Copy webhook signing secret to environment variables

### 3. Health Checks

Payment service exposes health endpoint: `/health`

Response:
```json
{
  "status": "ok",
  "service": "payment-service",
  "timestamp": "2024-01-20T10:30:00Z",
  "checks": {
    "kafka": {
      "healthy": true,
      "status": "connected"
    },
    "stripe": {
      "healthy": true,
      "status": "initialized"
    }
  }
}
```

## Monitoring and Logging

### Logs to Monitor

- `[StripeService]` - Stripe API interactions
- `[PaymentService]` - Business logic and Kafka events
- `[WebhookService]` - Webhook event processing
- `[PaymentRoutes]` - API endpoint requests

### Metrics to Track (TODO)

- Payment success rate
- Average payment processing time
- Failed payment reasons
- Webhook processing latency
- Refund volume

## TODO / Future Enhancements

- [ ] Implement database persistence for payment records
- [ ] Add support for additional payment methods (Apple Pay, Google Pay)
- [ ] Implement 3D Secure (SCA) handling
- [ ] Add payment retry logic for failed payments
- [ ] Create admin dashboard for payment management
- [ ] Implement receipt generation (PDF)
- [ ] Add payment analytics and reporting
- [ ] Set up monitoring alerts (Sentry, Datadog)
- [ ] Implement payment reconciliation
- [ ] Add support for multiple currencies
- [ ] Create comprehensive test suite
- [ ] Document disaster recovery procedures

## Troubleshooting

### Webhook not receiving events

1. Check Stripe CLI is running: `stripe listen --forward-to localhost:3004/api/v1/payment/webhook`
2. Verify webhook secret in `.env` matches CLI output
3. Check Payment Service logs for errors

### Payment Intent creation fails

1. Verify Stripe secret key is correct
2. Check amount is in cents (multiply by 100)
3. Ensure currency is lowercase
4. Verify all required fields are present

### Frontend can't load Stripe

1. Check publishable key in frontend environment
2. Verify CORS settings in Payment Service
3. Check browser console for errors

### Kafka events not publishing

Payment Service continues to work even if Kafka is unavailable (non-critical dependency). Check:
1. Kafka broker is running
2. Topic `payment.completed` exists
3. Payment Service has correct Kafka configuration

## Support and Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe API Reference**: https://stripe.com/docs/api
- **Stripe Test Cards**: https://stripe.com/docs/testing
- **Stripe CLI**: https://stripe.com/docs/stripe-cli
- **Stripe Webhooks**: https://stripe.com/docs/webhooks

## License

This implementation is part of the DreamScape project and follows the project's licensing terms.
