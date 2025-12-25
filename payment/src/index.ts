import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import paymentKafkaService from './services/KafkaService';
import stripeService from './services/StripeService';
import paymentRoutes from './routes/payment';
import { rawBodyMiddleware } from './middleware/rawBody';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body middleware for webhooks (must be BEFORE express.json())
app.use(rawBodyMiddleware);

// JSON body parser
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const kafkaHealth = await paymentKafkaService.healthCheck();
  const stripeHealth = await stripeService.healthCheck();

  const healthy = kafkaHealth.healthy && stripeHealth.healthy;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
    checks: {
      kafka: kafkaHealth,
      stripe: stripeHealth,
    },
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DreamScape Payment Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      payment: '/api/v1/payment',
    },
  });
});

// Payment routes
app.use('/api/v1/payment', paymentRoutes);

const startServer = async () => {
  try {
    // Initialize Stripe
    try {
      stripeService.initialize();
      console.log('✅ Stripe initialized successfully');
    } catch (error) {
      console.error('❌ Stripe initialization failed:', error);
      console.error('💥 Cannot start payment service without Stripe');
      process.exit(1);
    }

    // Initialize Kafka - DR-378 / DR-379
    try {
      await paymentKafkaService.initialize();
      console.log('✅ Kafka initialized successfully');
    } catch (error) {
      console.warn('⚠️ Kafka initialization failed (non-critical):', error);
      console.warn('⚠️ Service will continue without event publishing');
    }

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

      try {
        // Disconnect Kafka - DR-378 / DR-379
        await paymentKafkaService.shutdown();
        console.log('✅ Kafka disconnected');

        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    app.listen(PORT, async () => {
      console.log(`💳 Payment Service running on port ${PORT}`);

      // Check Kafka health - DR-378 / DR-379
      const kafkaHealth = await paymentKafkaService.healthCheck();
      console.log(`📨 Kafka: ${kafkaHealth.healthy ? '✅ Connected' : '⚠️ Not available'}`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch(error => {
  console.error('💥 Fatal error during server startup:', error);
  process.exit(1);
});
