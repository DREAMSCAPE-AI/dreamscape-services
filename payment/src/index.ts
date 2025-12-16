import express from 'express';
import paymentKafkaService from './services/KafkaService';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DreamScape Payment Service',
    version: '1.0.0',
    status: 'running'
  });
});

const startServer = async () => {
  try {
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
