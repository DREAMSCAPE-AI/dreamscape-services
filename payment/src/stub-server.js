/**
 * Payment Service - Stub Server for Development/Testing
 * Provides mock payment endpoints for Big Pods architecture
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'payment-service',
    version: '1.0.0-stub',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mock payment processing endpoint
app.post('/api/payments/process', (req, res) => {
  const { amount, currency, method } = req.body;

  console.log(`[STUB] Processing payment: ${amount} ${currency} via ${method}`);

  res.status(200).json({
    success: true,
    transactionId: `STUB-${Date.now()}`,
    amount,
    currency,
    method,
    status: 'completed',
    message: 'Payment processed successfully (stub)',
    timestamp: new Date().toISOString()
  });
});

// Mock payment validation endpoint
app.post('/api/payments/validate', (req, res) => {
  const { cardNumber, cvv, expiryDate } = req.body;

  console.log(`[STUB] Validating payment method`);

  res.status(200).json({
    valid: true,
    message: 'Payment method validated (stub)',
    timestamp: new Date().toISOString()
  });
});

// Mock refund endpoint
app.post('/api/payments/refund', (req, res) => {
  const { transactionId, amount } = req.body;

  console.log(`[STUB] Processing refund: ${amount} for transaction ${transactionId}`);

  res.status(200).json({
    success: true,
    refundId: `REFUND-${Date.now()}`,
    transactionId,
    amount,
    status: 'refunded',
    message: 'Refund processed successfully (stub)',
    timestamp: new Date().toISOString()
  });
});

// Mock payment history endpoint
app.get('/api/payments/history/:userId', (req, res) => {
  const { userId } = req.params;

  console.log(`[STUB] Fetching payment history for user: ${userId}`);

  res.status(200).json({
    userId,
    payments: [
      {
        id: 'STUB-001',
        amount: 100.00,
        currency: 'EUR',
        status: 'completed',
        date: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'STUB-002',
        amount: 250.00,
        currency: 'EUR',
        status: 'completed',
        date: new Date(Date.now() - 172800000).toISOString()
      }
    ],
    message: 'Payment history retrieved (stub)',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`[STUB ERROR] ${err.message}`);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    service: 'payment-service-stub'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    service: 'payment-service-stub'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==============================================`);
  console.log(`Payment Service (STUB) running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`==============================================`);
});
