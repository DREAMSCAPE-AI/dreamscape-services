import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DatabaseService } from './database/DatabaseService';
import recommendationsRoutes from './routes/recommendations';
import predictionsRoutes from './routes/predictions';
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics'; // INFRA-013.2
import { apiLimiter as rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware } from './middleware/metricsMiddleware'; // INFRA-013.2

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Metrics collection middleware - INFRA-013.2
// Must be before routes to capture all requests
app.use(metricsMiddleware);

// Routes
app.use('/api/v1/recommendations', recommendationsRoutes);
app.use('/api/v1/predictions', predictionsRoutes);

// Health check routes - INFRA-013.1
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Alternative path for consistency

// Metrics endpoint - INFRA-013.2
// This should be accessible to Prometheus but ideally not publicly
app.use('/metrics', metricsRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const startServer = async () => {
  try {
    await DatabaseService.connect();
    console.log('Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`AI service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;