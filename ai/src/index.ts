import express from 'express';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ai-service',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DreamScape AI Service',
    version: '1.0.0',
    status: 'running',
    features: ['itinerary-generation', 'recommendations', 'image-generation']
  });
});

app.listen(PORT, () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
});
