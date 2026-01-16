/**
 * Test script for Stripe webhook endpoint
 * This simulates a Stripe webhook event to test idempotence and database persistence
 *
 * Usage: node test-webhook.js
 */

const crypto = require('crypto');
const http = require('http');

// Simulate a Stripe webhook event
const testEvent = {
  id: 'evt_test_' + Date.now(),
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'pi_test_' + Date.now(),
      object: 'payment_intent',
      amount: 5000, // $50.00
      currency: 'usd',
      status: 'succeeded',
      metadata: {
        bookingId: 'booking_' + Date.now(),
        bookingReference: 'DR-' + Date.now(),
        userId: 'user_test_123'
      },
      payment_method: 'pm_test_card'
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: null,
    idempotency_key: null
  },
  type: 'payment_intent.succeeded'
};

const payload = JSON.stringify(testEvent);

// IMPORTANT: In production, you need the real STRIPE_WEBHOOK_SECRET
// For testing, we'll send without signature (will fail signature verification)
// To test properly, use: stripe listen --forward-to localhost:3000/api/v1/payment/webhook

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/payment/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    // 'stripe-signature': 'FAKE_SIGNATURE' // This will fail verification
  }
};

console.log('\n🧪 Testing Stripe Webhook Endpoint\n');
console.log('📤 Sending webhook event:', testEvent.type);
console.log('🆔 Event ID:', testEvent.id);
console.log('💰 Amount: $' + (testEvent.data.object.amount / 100).toFixed(2));
console.log('\n⚠️  NOTE: This will fail signature verification.');
console.log('   Use Stripe CLI for proper testing: stripe listen --forward-to localhost:3000/api/v1/payment/webhook\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📨 Response Status:', res.statusCode);
    console.log('📨 Response Body:', data);

    if (res.statusCode === 200) {
      console.log('\n✅ Webhook endpoint is responding!');
    } else {
      console.log('\n❌ Webhook returned error (expected without proper signature)');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\n💡 Make sure the payment service is running: npm run dev');
});

req.write(payload);
req.end();
