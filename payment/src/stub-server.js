// DreamScape Payment Service - Stub Server
// Temporary stub server until full Payment implementation is ready

const http = require('http');

const PORT = process.env.PORT || 3005;
const SERVICE_NAME = process.env.SERVICE_NAME || 'payment-service';

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoints
  if (url === '/health' || url === '/api/health' || url === '/api/v1/payment/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      service: SERVICE_NAME,
      version: '1.0.0-stub',
      timestamp: new Date().toISOString(),
      message: 'Payment Service stub - Full implementation pending'
    }));
    return;
  }

  // Process payment endpoint (stub)
  if ((url.startsWith('/api/v1/payment/process') || url.startsWith('/process')) && method === 'POST') {
    res.writeHead(501);
    res.end(JSON.stringify({
      status: 'stub',
      service: SERVICE_NAME,
      message: 'Payment processing feature coming soon',
      error: 'Not implemented',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Payment status endpoint (stub)
  if (url.startsWith('/api/v1/payment/status') || url.startsWith('/status')) {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'stub',
      service: SERVICE_NAME,
      message: 'Payment status feature coming soon',
      payments: [],
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Refund endpoint (stub)
  if ((url.startsWith('/api/v1/payment/refund') || url.startsWith('/refund')) && method === 'POST') {
    res.writeHead(501);
    res.end(JSON.stringify({
      status: 'stub',
      service: SERVICE_NAME,
      message: 'Refund feature coming soon',
      error: 'Not implemented',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Root endpoint
  if (url === '/' || url === '/api/v1/payment') {
    res.writeHead(200);
    res.end(JSON.stringify({
      service: SERVICE_NAME,
      version: '1.0.0-stub',
      status: 'running',
      message: 'DreamScape Payment Service - Stub implementation',
      endpoints: [
        '/health',
        '/api/v1/payment/process',
        '/api/v1/payment/status',
        '/api/v1/payment/refund'
      ],
      note: 'Full Payment implementation pending - Stripe/PayPal integration coming soon'
    }));
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end(JSON.stringify({
    error: 'Not Found',
    message: `Endpoint ${url} not available in stub mode`,
    service: SERVICE_NAME
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[${SERVICE_NAME}] Stub server running on port ${PORT}`);
  console.log(`[${SERVICE_NAME}] Health check: http://localhost:${PORT}/health`);
  console.log(`[${SERVICE_NAME}] Note: This is a stub implementation`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[${SERVICE_NAME}] Received SIGTERM, shutting down gracefully...`);
  server.close(() => {
    console.log(`[${SERVICE_NAME}] Server closed`);
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(`[${SERVICE_NAME}] Received SIGINT, shutting down gracefully...`);
  server.close(() => {
    console.log(`[${SERVICE_NAME}] Server closed`);
    process.exit(0);
  });
});
