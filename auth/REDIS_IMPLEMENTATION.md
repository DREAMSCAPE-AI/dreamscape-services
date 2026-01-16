# Redis Implementation - Auth Service

## 📋 Overview

This document describes the Redis implementation in the DreamScape Auth Service, including caching, session management, and rate limiting.

## 🏗️ Architecture

### Components

1. **Redis Client** (`src/config/redis.ts`)
   - Singleton pattern for connection management
   - Automatic reconnection with exponential backoff
   - Graceful degradation when Redis is unavailable
   - Health check monitoring

2. **Session Manager** (`src/middleware/sessionManager.ts`)
   - JWT token session storage
   - Token blacklisting for logout
   - Multi-device session management
   - Automatic session expiry (24h TTL)

3. **Rate Limiting** (`src/middleware/rateLimiter.ts`)
   - Distributed rate limiting across instances
   - Per-endpoint configuration
   - Automatic fallback to memory store

4. **Cache Middleware** (`src/middleware/cache.ts`)
   - HTTP response caching
   - Configurable TTL
   - Pattern-based cache invalidation
   - Cache headers (X-Cache: HIT/MISS)

## 🚀 Usage Examples

### 1. Redis Client

```typescript
import redisClient from './config/redis';

// Check if Redis is ready
if (redisClient.isReady()) {
  // Simple operations
  await redisClient.set('key', 'value', 60); // 60 second TTL
  const value = await redisClient.get('key');
  await redisClient.del('key');

  // Advanced operations
  await redisClient.incr('counter');
  await redisClient.expire('key', 300);
  const ttl = await redisClient.ttl('key');

  // Hash operations (for complex data)
  await redisClient.hSet('user:123', 'email', 'user@example.com');
  const email = await redisClient.hGet('user:123', 'email');
  const userData = await redisClient.hGetAll('user:123');
}
```

### 2. Session Management

```typescript
import { SessionManager } from './middleware/sessionManager';

// Create session on login
await SessionManager.createSession(userId, email, token, req);

// Get session data
const session = await SessionManager.getSession(token);

// Update last activity
await SessionManager.updateSessionActivity(token);

// Logout (single device)
await SessionManager.deleteSession(token, userId);

// Logout all devices
await SessionManager.deleteAllUserSessions(userId);

// Blacklist token
await SessionManager.blacklistToken(token);

// Check if token is blacklisted
const isBlacklisted = await SessionManager.isTokenBlacklisted(token);
```

### 3. Rate Limiting

```typescript
import { loginLimiter, registerLimiter, authLimiter, refreshLimiter } from './middleware/rateLimiter';

// Apply to routes
router.post('/login', loginLimiter, loginController);
router.post('/register', registerLimiter, registerController);
router.use('/api', authLimiter); // Global limiter
router.post('/refresh', refreshLimiter, refreshController);
```

**Rate Limit Configuration:**

| Endpoint | Window | Max Requests | Key Strategy |
|----------|--------|--------------|--------------|
| `/login` | 15 min | 5 | IP + Email |
| `/register` | 1 hour | 3 | IP |
| `/api/*` | 15 min | 100 | IP |
| `/refresh` | 15 min | 20 | IP |

### 4. HTTP Caching

```typescript
import { cache, CacheInvalidator } from './middleware/cache';

// Pre-configured cache durations
router.get('/public-data', cache.short, handler); // 1 minute
router.get('/user-profile', cache.medium, handler); // 5 minutes
router.get('/static-content', cache.long, handler); // 1 hour
router.get('/config', cache.veryLong, handler); // 24 hours

// Custom cache configuration
router.get('/custom', cache.custom({
  ttl: 300, // 5 minutes
  keyPrefix: 'custom',
  excludeQuery: false, // Include query params in cache key
  varyBy: ['authorization'] // Vary cache by authorization header
}), handler);

// Cache invalidation
await CacheInvalidator.invalidatePath('/api/users'); // Invalidate specific path
await CacheInvalidator.invalidateByPrefix('user:'); // Invalidate by prefix
await CacheInvalidator.invalidateAll(); // Clear all cache
```

## 🔧 Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://redis-service:6379
REDIS_PASSWORD=your-secure-password

# Optional: Override defaults
REDIS_SESSION_TTL=86400 # 24 hours (seconds)
REDIS_CACHE_TTL=300 # 5 minutes (seconds)
```

### Kubernetes Secrets

Create the `redis-secrets` secret:

```bash
kubectl create secret generic redis-secrets \
  --from-literal=redis-password='your-secure-password' \
  -n dreamscape
```

Update `auth-secrets` to include Redis URL:

```bash
kubectl create secret generic auth-secrets \
  --from-literal=redis-url='redis://:your-secure-password@redis-service:6379' \
  --from-literal=jwt-secret='your-jwt-secret' \
  --from-literal=database-url='your-database-url' \
  --from-literal=google-client-id='your-google-client-id' \
  --from-literal=google-client-secret='your-google-client-secret' \
  -n dreamscape \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 📊 Monitoring

### Health Checks

The `/health` endpoint includes Redis status:

```json
{
  "status": "ok",
  "service": "auth-service",
  "cache": {
    "redis": true
  },
  "database": {
    "postgresql": true,
    "mongodb": true
  }
}
```

### Cache Headers

All cached responses include:

- `X-Cache: HIT` or `X-Cache: MISS`
- `X-Cache-Key: <key>` for debugging

### Logs

Redis connection events are logged:

```
Redis Client connecting...
Redis Client ready
✅ Redis initialized successfully
```

## 🔒 Security

### Redis Security Features

1. **Password Authentication**: Required for all connections
2. **Network Policies**: Restricts Redis access to authorized pods only
3. **TLS**: Can be enabled via Redis configuration
4. **Key Prefixes**: Prevents key collisions (e.g., `session:`, `rl:`, `cache:`)

### Best Practices

- ✅ Always use TTLs to prevent memory leaks
- ✅ Use key prefixes for namespace isolation
- ✅ Handle Redis failures gracefully (fallback to memory)
- ✅ Monitor Redis memory usage
- ✅ Use password authentication in production

## 🚨 Error Handling

Redis operations are designed to fail gracefully:

```typescript
// If Redis is unavailable, operations return null/false
const value = await redisClient.get('key'); // Returns null if Redis down
const success = await redisClient.set('key', 'value'); // Returns false if Redis down

// Rate limiters fall back to memory store
// Cache middleware skips caching
// Session manager warns but continues without sessions
```

## 📈 Performance Considerations

### Cache TTL Guidelines

| Data Type | Recommended TTL | Reason |
|-----------|----------------|--------|
| Static content | 1-24 hours | Rarely changes |
| User profiles | 5-15 minutes | Balances freshness & performance |
| Dynamic lists | 1-5 minutes | Frequently updated |
| Search results | 30-60 seconds | Real-time feel |

### Memory Management

- **maxmemory**: 512MB (configured in K8s deployment)
- **maxmemory-policy**: `allkeys-lru` (evicts least recently used keys)
- **Persistence**: AOF enabled for durability

### Key Expiry Strategy

All keys have explicit TTLs:

- Session keys: 24 hours
- Rate limit keys: Window duration (5-60 minutes)
- Cache keys: Endpoint-specific (1 minute - 24 hours)
- Blacklist keys: JWT expiry time

## 🧪 Testing

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests with Redis

```bash
# Start Redis in Docker
docker run -d -p 6379:6379 redis:7-alpine

# Run integration tests
npm run test:integration
```

### Manual Testing

```bash
# Check Redis connectivity
redis-cli -h localhost -p 6379 ping

# Monitor Redis commands
redis-cli -h localhost -p 6379 MONITOR

# Check key patterns
redis-cli -h localhost -p 6379 KEYS "session:*"
redis-cli -h localhost -p 6379 KEYS "rl:*"
redis-cli -h localhost -p 6379 KEYS "cache:*"

# Check memory usage
redis-cli -h localhost -p 6379 INFO memory
```

## 📚 Additional Resources

- [Redis Client Documentation](https://github.com/redis/node-redis)
- [Rate Limit Redis](https://github.com/wyattjoh/rate-limit-redis)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)

## 🔄 Migration Notes

### Before Redis Implementation

- Rate limiting: Memory-based (not shared across instances)
- Sessions: None (stateless JWT only)
- Caching: None

### After Redis Implementation

- ✅ Distributed rate limiting across all instances
- ✅ Centralized session management with blacklisting
- ✅ HTTP response caching with invalidation
- ✅ Improved scalability and performance
- ✅ Better user experience (logout all devices, etc.)

## 🐛 Troubleshooting

### Redis Connection Issues

```bash
# Check if Redis pod is running
kubectl get pods -n dreamscape | grep redis

# Check Redis logs
kubectl logs -n dreamscape redis-<pod-id>

# Test connection from auth-service pod
kubectl exec -it -n dreamscape auth-service-<pod-id> -- sh
nc -zv redis-service 6379
```

### Performance Issues

```bash
# Check Redis slow log
redis-cli -h redis-service -p 6379 SLOWLOG GET 10

# Monitor real-time stats
redis-cli -h redis-service -p 6379 --stat

# Check connected clients
redis-cli -h redis-service -p 6379 CLIENT LIST
```

### Memory Issues

```bash
# Check memory usage
redis-cli -h redis-service -p 6379 INFO memory

# Check key distribution
redis-cli -h redis-service -p 6379 --bigkeys

# Flush specific pattern (dangerous!)
redis-cli -h redis-service -p 6379 --scan --pattern "cache:*" | xargs redis-cli -h redis-service -p 6379 DEL
```
