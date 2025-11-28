"""
AI Service - Python Stub Server for Development/Testing
Provides mock AI recommendation endpoints for Big Pods architecture
"""

from flask import Flask, jsonify, request
from datetime import datetime
import os
import random

app = Flask(__name__)

PORT = int(os.getenv('AI_SERVICE_PORT', 3004))

# Mock destinations for recommendations
MOCK_DESTINATIONS = [
    {'id': 1, 'name': 'Paris', 'country': 'France', 'score': 0.95},
    {'id': 2, 'name': 'Barcelona', 'country': 'Spain', 'score': 0.92},
    {'id': 3, 'name': 'Rome', 'country': 'Italy', 'score': 0.89},
    {'id': 4, 'name': 'Amsterdam', 'country': 'Netherlands', 'score': 0.87},
    {'id': 5, 'name': 'Prague', 'country': 'Czech Republic', 'score': 0.85},
]

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'ai-service',
        'version': '1.0.0-stub',
        'timestamp': datetime.now().isoformat(),
        'environment': os.getenv('NODE_ENV', 'development')
    }), 200


@app.route('/api/ai/recommendations', methods=['POST'])
def get_recommendations():
    """Mock AI recommendations endpoint"""
    data = request.get_json() or {}
    user_preferences = data.get('preferences', {})

    print(f"[STUB] Generating recommendations for preferences: {user_preferences}")

    # Simulate AI processing delay
    num_recommendations = min(data.get('limit', 5), len(MOCK_DESTINATIONS))
    recommendations = random.sample(MOCK_DESTINATIONS, num_recommendations)

    return jsonify({
        'success': True,
        'recommendations': recommendations,
        'confidence': 0.85,
        'model': 'stub-recommendation-v1',
        'message': 'AI recommendations generated (stub)',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/ai/analyze', methods=['POST'])
def analyze_preferences():
    """Mock preference analysis endpoint"""
    data = request.get_json() or {}
    user_data = data.get('userData', {})

    print(f"[STUB] Analyzing user preferences")

    return jsonify({
        'success': True,
        'analysis': {
            'travel_style': 'adventurous',
            'budget_category': 'medium',
            'preferred_climate': 'temperate',
            'interests': ['culture', 'food', 'history']
        },
        'confidence': 0.78,
        'message': 'Preference analysis completed (stub)',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/ai/similar-destinations', methods=['POST'])
def find_similar_destinations():
    """Mock similar destinations endpoint"""
    data = request.get_json() or {}
    destination_id = data.get('destinationId')

    print(f"[STUB] Finding similar destinations to: {destination_id}")

    similar = random.sample(MOCK_DESTINATIONS, 3)

    return jsonify({
        'success': True,
        'similar_destinations': similar,
        'algorithm': 'cosine-similarity-stub',
        'message': 'Similar destinations found (stub)',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/ai/personalize', methods=['POST'])
def personalize_experience():
    """Mock experience personalization endpoint"""
    data = request.get_json() or {}
    user_id = data.get('userId')

    print(f"[STUB] Personalizing experience for user: {user_id}")

    return jsonify({
        'success': True,
        'personalization': {
            'recommended_activities': [
                'Museum Tours',
                'Local Cuisine Tasting',
                'Historic Walking Tours'
            ],
            'optimal_travel_time': 'Spring (March-May)',
            'budget_suggestions': {
                'accommodation': 'mid-range',
                'dining': 'local-authentic',
                'activities': 'cultural-focused'
            }
        },
        'confidence': 0.82,
        'message': 'Experience personalized (stub)',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/ai/sentiment', methods=['POST'])
def analyze_sentiment():
    """Mock sentiment analysis endpoint"""
    data = request.get_json() or {}
    text = data.get('text', '')

    print(f"[STUB] Analyzing sentiment for text")

    return jsonify({
        'success': True,
        'sentiment': {
            'score': random.uniform(0.6, 0.9),
            'label': random.choice(['positive', 'neutral', 'very positive']),
            'confidence': random.uniform(0.75, 0.95)
        },
        'message': 'Sentiment analysis completed (stub)',
        'timestamp': datetime.now().isoformat()
    }), 200


@app.errorhandler(404)
def not_found(error):
    """404 error handler"""
    return jsonify({
        'error': 'Not found',
        'message': f'Route not found',
        'service': 'ai-service-stub'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    print(f"[STUB ERROR] {str(error)}")
    return jsonify({
        'error': 'Internal server error',
        'message': str(error),
        'service': 'ai-service-stub'
    }), 500


if __name__ == '__main__':
    print("=" * 50)
    print(f"AI Service (STUB) running on port {PORT}")
    print(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    print(f"Health check: http://localhost:{PORT}/health")
    print("=" * 50)

    app.run(host='0.0.0.0', port=PORT, debug=True)
