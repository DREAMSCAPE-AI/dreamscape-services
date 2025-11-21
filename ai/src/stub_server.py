#!/usr/bin/env python3
"""
DreamScape AI Service - Stub Server
Temporary stub server until full AI/ML implementation is ready
"""

import os
import json
import signal
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(os.environ.get('PORT', 3004))
SERVICE_NAME = os.environ.get('SERVICE_NAME', 'ai-service')


class AIServiceHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for AI Service stub"""

    def _set_headers(self, status_code=200, content_type='application/json'):
        self.send_response(status_code)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def _send_json(self, data, status_code=200):
        self._set_headers(status_code)
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        path = self.path.split('?')[0]  # Remove query params

        # Health check endpoints
        if path in ['/health', '/api/health', '/api/v1/ai/health']:
            self._send_json({
                'status': 'healthy',
                'service': SERVICE_NAME,
                'version': '1.0.0-stub',
                'runtime': 'python',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'message': 'AI Service stub - Full ML implementation pending'
            })
            return

        # Recommendations endpoint (stub)
        if path.startswith('/api/v1/ai/recommendations') or path.startswith('/recommendations'):
            self._send_json({
                'status': 'stub',
                'service': SERVICE_NAME,
                'message': 'AI recommendations feature coming soon',
                'recommendations': [],
                'model': 'pending-implementation',
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            })
            return

        # Predictions endpoint (stub)
        if path.startswith('/api/v1/ai/predictions') or path.startswith('/predictions'):
            self._send_json({
                'status': 'stub',
                'service': SERVICE_NAME,
                'message': 'AI predictions feature coming soon',
                'predictions': [],
                'model': 'pending-implementation',
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            })
            return

        # Sentiment analysis endpoint (stub)
        if path.startswith('/api/v1/ai/sentiment') or path.startswith('/sentiment'):
            self._send_json({
                'status': 'stub',
                'service': SERVICE_NAME,
                'message': 'Sentiment analysis feature coming soon',
                'sentiment': None,
                'confidence': 0.0,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            })
            return

        # Model info endpoint (stub)
        if path.startswith('/api/v1/ai/models') or path.startswith('/models'):
            self._send_json({
                'status': 'stub',
                'service': SERVICE_NAME,
                'message': 'Model management coming soon',
                'models': [
                    {'name': 'recommendation-v1', 'status': 'pending'},
                    {'name': 'prediction-v1', 'status': 'pending'},
                    {'name': 'sentiment-v1', 'status': 'pending'}
                ],
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            })
            return

        # Root endpoint
        if path in ['/', '/api/v1/ai']:
            self._send_json({
                'service': SERVICE_NAME,
                'version': '1.0.0-stub',
                'runtime': 'python',
                'status': 'running',
                'message': 'DreamScape AI Service - Stub implementation',
                'endpoints': [
                    '/health',
                    '/api/v1/ai/recommendations',
                    '/api/v1/ai/predictions',
                    '/api/v1/ai/sentiment',
                    '/api/v1/ai/models'
                ],
                'note': 'Full AI/ML implementation pending - TensorFlow/PyTorch integration coming soon'
            })
            return

        # Default 404
        self._send_json({
            'error': 'Not Found',
            'message': f'Endpoint {path} not available in stub mode',
            'service': SERVICE_NAME
        }, 404)

    def do_POST(self):
        path = self.path.split('?')[0]

        # Process AI request (stub)
        if path.startswith('/api/v1/ai/'):
            self._send_json({
                'status': 'stub',
                'service': SERVICE_NAME,
                'message': 'AI processing not yet implemented',
                'error': 'Not implemented',
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, 501)
            return

        self._send_json({
            'error': 'Not Found',
            'message': f'Endpoint {path} not available',
            'service': SERVICE_NAME
        }, 404)

    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[{SERVICE_NAME}] {self.address_string()} - {format % args}")


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    sig_name = signal.Signals(signum).name
    print(f"\n[{SERVICE_NAME}] Received {sig_name}, shutting down gracefully...")
    sys.exit(0)


def main():
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    server = HTTPServer(('0.0.0.0', PORT), AIServiceHandler)

    print(f"[{SERVICE_NAME}] Python stub server running on port {PORT}")
    print(f"[{SERVICE_NAME}] Health check: http://localhost:{PORT}/health")
    print(f"[{SERVICE_NAME}] Note: This is a stub implementation")
    print(f"[{SERVICE_NAME}] Full AI/ML features coming soon...")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print(f"[{SERVICE_NAME}] Server closed")


if __name__ == '__main__':
    main()
