# User History API Documentation

## Overview

The User History API provides comprehensive tracking and management of user interactions across the DreamScape platform. This feature enables personalized experiences by recording user actions on various entities such as hotels, flights, destinations, and bookings.

**Feature:** User Activity Tracking
**Service:** user-service (Port 3002)
**Base Path:** `/api/v1/users/history`
**Ticket:** DR-83
**Version:** 1.0.0

## Purpose

The User History API serves multiple purposes:

- **Activity Tracking**: Record all user interactions with platform entities
- **Personalization**: Enable personalized recommendations based on user behavior
- **Analytics**: Provide insights into user engagement patterns
- **User Control**: Allow users to view, manage, and delete their activity history
- **Privacy Compliance**: Support data deletion and transparency requirements

## Authentication

All endpoints require JWT authentication via Bearer token.

**Header Format:**
```
Authorization: Bearer <access_token>
```

**Authentication Errors:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 401 | Access token required | Missing or invalid Authorization header |
| 401 | Invalid token | JWT signature verification failed |
| 401 | Token has been revoked | Token is blacklisted |
| 401 | Invalid token type | Refresh token used instead of access token |
| 401 | User not found | Authenticated user no longer exists |

---

## Endpoints

### 1. Get User History

Retrieve paginated user history with optional filters.

**Endpoint:** `GET /api/v1/users/history`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (1-indexed) |
| limit | integer | No | 20 | Items per page (max: 100) |
| actionType | string | No | - | Filter by action type (see enum below) |
| entityType | string | No | - | Filter by entity type |
| entityId | string | No | - | Filter by specific entity ID |

**Valid Action Types:**
- `CREATED` - Entity was created
- `VIEWED` - Entity was viewed/accessed
- `UPDATED` - Entity was modified
- `DELETED` - Entity was removed
- `SEARCHED` - Search performed
- `FAVORITED` - Entity added to favorites
- `UNFAVORITED` - Entity removed from favorites

**Valid Entity Types:**
- `booking` - Booking/reservation entities
- `search` - Search queries and results
- `favorite` - Favorited items
- `destination` - Destinations and locations
- `hotel` - Hotel entities
- `activity` - Activities and experiences
- `flight` - Flight entities

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "history-entry-123",
        "userId": "user-456",
        "actionType": "VIEWED",
        "entityType": "hotel",
        "entityId": "hotel-789",
        "metadata": {
          "name": "Grand Hotel Paris",
          "price": 150,
          "rating": 4.5
        },
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 401 | Authentication required | Missing or invalid authentication token |
| 500 | Failed to fetch user history | Database or server error |

**Example Requests:**

```bash
# Get first page with default pagination
curl -X GET "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get page 2 with 50 items
curl -X GET "http://localhost:3002/api/v1/users/history?page=2&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by action type
curl -X GET "http://localhost:3002/api/v1/users/history?actionType=VIEWED" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by entity type and ID
curl -X GET "http://localhost:3002/api/v1/users/history?entityType=hotel&entityId=hotel-123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Multiple filters with pagination
curl -X GET "http://localhost:3002/api/v1/users/history?actionType=VIEWED&entityType=hotel&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. Get History Statistics

Retrieve aggregated statistics about user history.

**Endpoint:** `GET /api/v1/users/history/stats`

**Query Parameters:** None

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "totalCount": 127,
    "byActionType": {
      "VIEWED": 65,
      "SEARCHED": 32,
      "FAVORITED": 15,
      "CREATED": 10,
      "UPDATED": 3,
      "DELETED": 2
    },
    "byEntityType": {
      "hotel": 48,
      "flight": 35,
      "destination": 22,
      "booking": 12,
      "activity": 8,
      "search": 2
    },
    "mostRecentActivity": "2024-01-20T14:30:00.000Z"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| totalCount | integer | Total number of history entries |
| byActionType | object | Count of entries grouped by action type |
| byEntityType | object | Count of entries grouped by entity type |
| mostRecentActivity | string (ISO 8601) | Timestamp of most recent activity (null if no history) |

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 401 | Authentication required | Missing or invalid authentication token |
| 500 | Failed to fetch history statistics | Database or server error |

**Example Request:**

```bash
curl -X GET "http://localhost:3002/api/v1/users/history/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Use Cases:**
- Display activity summary in user dashboard
- Show user engagement metrics
- Personalization algorithm inputs
- Analytics and reporting

---

### 3. Add History Entry

Create a new history entry to track a user action.

**Endpoint:** `POST /api/v1/users/history`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| actionType | string | Yes | Action performed (see valid types above) |
| entityType | string | Yes | Type of entity (see valid types above) |
| entityId | string | Yes | Unique identifier of the entity |
| metadata | object | No | Additional context about the action (flexible JSON) |

**Request Example:**

```json
{
  "actionType": "VIEWED",
  "entityType": "hotel",
  "entityId": "hotel-paris-456",
  "metadata": {
    "hotelName": "Le Grand Hotel",
    "price": 250,
    "rating": 4.8,
    "location": "Paris, France",
    "viewedAt": "2024-01-15T14:30:00Z"
  }
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "History entry created successfully",
  "data": {
    "id": "history-entry-789",
    "userId": "user-123",
    "actionType": "VIEWED",
    "entityType": "hotel",
    "entityId": "hotel-paris-456",
    "metadata": {
      "hotelName": "Le Grand Hotel",
      "price": 250,
      "rating": 4.8,
      "location": "Paris, France",
      "viewedAt": "2024-01-15T14:30:00Z"
    },
    "createdAt": "2024-01-15T14:30:00.000Z"
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | Invalid action type. Valid values are: ... | ActionType not in allowed enum values |
| 400 | Invalid entity type. Valid values are: ... | EntityType not in allowed list |
| 400 | Entity ID is required and must be a string | Missing or invalid entityId |
| 400 | Metadata must be a valid JSON object | Invalid metadata format |
| 401 | Authentication required | Missing or invalid authentication token |
| 500 | Failed to create history entry | Database or server error |

**Example Requests:**

```bash
# Track hotel view
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "VIEWED",
    "entityType": "hotel",
    "entityId": "hotel-123",
    "metadata": {
      "name": "Sunset Resort",
      "price": 180
    }
  }'

# Track search query
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "SEARCHED",
    "entityType": "search",
    "entityId": "search-query-456",
    "metadata": {
      "query": "hotels in Paris",
      "filters": {
        "priceRange": [100, 300],
        "stars": 4
      },
      "resultsCount": 42
    }
  }'

# Track booking creation (without metadata)
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "CREATED",
    "entityType": "booking",
    "entityId": "booking-789"
  }'

# Track favorite action
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "FAVORITED",
    "entityType": "destination",
    "entityId": "dest-tokyo-001",
    "metadata": {
      "destinationName": "Tokyo, Japan",
      "reason": "wishlist"
    }
  }'
```

**Side Effects:**
- Creates an analytics event (`history_entry_created`) for tracking

---

### 4. Delete History Entry

Delete a specific history entry by ID.

**Endpoint:** `DELETE /api/v1/users/history/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | UUID of the history entry to delete |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "History entry deleted successfully",
  "data": null
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | History entry ID is required | Missing ID parameter |
| 401 | Authentication required | Missing or invalid authentication token |
| 404 | History entry not found or does not belong to you | Entry doesn't exist or belongs to another user |
| 404 | History entry not found | Entry was already deleted (Prisma P2025) |
| 500 | Failed to delete history entry | Database or server error |

**Security:**
- Users can only delete their own history entries
- Attempting to delete another user's entry returns 404 (not 403) to prevent information disclosure

**Example Request:**

```bash
curl -X DELETE "http://localhost:3002/api/v1/users/history/history-entry-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Clear User History

Delete all or filtered history entries for the authenticated user.

**Endpoint:** `DELETE /api/v1/users/history`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entityType | string | No | Only delete entries of this entity type |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Successfully deleted 15 history entries",
  "data": {
    "deletedCount": 15
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 401 | Authentication required | Missing or invalid authentication token |
| 500 | Failed to clear user history | Database or server error |

**Behavior:**
- Returns success even if 0 entries are deleted
- Invalid entityType filters are ignored (deletes all history)
- Creates an analytics event (`history_cleared`) with deletion details

**Example Requests:**

```bash
# Clear all history
curl -X DELETE "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Clear only hotel-related history
curl -X DELETE "http://localhost:3002/api/v1/users/history?entityType=hotel" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Clear only search history
curl -X DELETE "http://localhost:3002/api/v1/users/history?entityType=search" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Use Cases:**
- Privacy compliance (GDPR right to be forgotten)
- User-initiated history clearing
- Cleaning up specific categories of history
- Testing and development

---

## Data Models

### UserHistory Model

**Database Table:** `user_history`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary Key | Unique identifier for the history entry |
| userId | UUID | Foreign Key (users.id), NOT NULL | Reference to the user who performed the action |
| actionType | HistoryActionType | NOT NULL | Type of action performed (enum) |
| entityType | String | NOT NULL | Type of entity acted upon |
| entityId | String | NOT NULL | Unique identifier of the entity |
| metadata | JSON | Nullable | Additional contextual information |
| createdAt | DateTime | NOT NULL, Default: now() | Timestamp when the action occurred |

**Indexes:**
- `(userId, createdAt DESC)` - Efficient user history retrieval
- `(userId, entityType)` - Filtering by entity type
- `(entityType, entityId)` - Cross-user entity lookup

**Cascade Behavior:**
- When a user is deleted, all their history entries are automatically deleted (`onDelete: Cascade`)

### HistoryActionType Enum

```typescript
enum HistoryActionType {
  CREATED      // Entity was created by the user
  VIEWED       // Entity was viewed/accessed
  UPDATED      // Entity was modified
  DELETED      // Entity was removed
  SEARCHED     // Search query performed
  FAVORITED    // Entity added to favorites
  UNFAVORITED  // Entity removed from favorites
}
```

### Entity Types

**Supported Entity Types:**

| Entity Type | Description | Example Use Cases |
|------------|-------------|-------------------|
| booking | Booking/reservation records | Track booking creation, updates, cancellations |
| search | Search queries and results | Record search patterns for personalization |
| favorite | Favorited items | Track favorite additions/removals |
| destination | Travel destinations | Record destination views and interest |
| hotel | Hotel properties | Track hotel searches, views, bookings |
| activity | Activities and experiences | Record activity interest and bookings |
| flight | Flight records | Track flight searches and bookings |

### Metadata Structure

The `metadata` field is flexible JSON that can store context-specific information:

**Hotel View Example:**
```json
{
  "hotelName": "Grand Hotel",
  "price": 150,
  "rating": 4.5,
  "location": "Paris, France",
  "stars": 5,
  "amenities": ["pool", "spa", "restaurant"]
}
```

**Search Query Example:**
```json
{
  "query": "hotels in Tokyo",
  "filters": {
    "priceRange": [100, 300],
    "stars": [4, 5],
    "amenities": ["wifi", "parking"]
  },
  "resultsCount": 87,
  "sortBy": "price"
}
```

**Booking Creation Example:**
```json
{
  "bookingType": "hotel",
  "checkIn": "2024-03-15",
  "checkOut": "2024-03-20",
  "guests": 2,
  "totalPrice": 750,
  "currency": "USD"
}
```

---

## Pagination Details

All paginated endpoints use cursor-based pagination with the following structure:

**Pagination Request:**
- `page`: Page number (1-indexed, default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Pagination Response:**
```json
{
  "pagination": {
    "page": 2,           // Current page number
    "limit": 20,         // Items per page
    "total": 127,        // Total number of items
    "totalPages": 7,     // Total number of pages
    "hasNext": true,     // Whether there's a next page
    "hasPrevious": true  // Whether there's a previous page
  }
}
```

**Calculation Logic:**
- `skip = (page - 1) × limit`
- `totalPages = ceil(total / limit)`
- `hasNext = page < totalPages`
- `hasPrevious = page > 1`

**Ordering:**
- All history results are ordered by `createdAt DESC` (newest first)

---

## Error Handling

### Common Error Format

All errors follow a consistent format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Status Code | Meaning | When It Occurs |
|------------|---------|----------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid parameters or request body |
| 401 | Unauthorized | Missing, invalid, or expired authentication |
| 404 | Not Found | Requested resource doesn't exist |
| 500 | Internal Server Error | Database or server error |

### Validation Errors

**Invalid Action Type:**
```json
{
  "error": "Invalid action type. Valid values are: CREATED, VIEWED, UPDATED, DELETED, SEARCHED, FAVORITED, UNFAVORITED"
}
```

**Invalid Entity Type:**
```json
{
  "error": "Invalid entity type. Valid values are: booking, search, favorite, destination, hotel, activity, flight"
}
```

**Missing Required Field:**
```json
{
  "error": "Entity ID is required and must be a string"
}
```

### Error Handling Best Practices

1. **Validation**: All input is validated before database operations
2. **Silent Failures**: Invalid filters are ignored rather than rejected (GET requests)
3. **Privacy Protection**: 404 responses instead of 403 to avoid user enumeration
4. **Graceful Degradation**: Analytics failures don't prevent core operations
5. **Detailed Logging**: All errors are logged server-side for debugging

---

## Use Cases and Examples

### Use Case 1: Personalized Recommendations

Track user browsing behavior to power recommendation algorithms.

```bash
# Track hotel views as user browses
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "VIEWED",
    "entityType": "hotel",
    "entityId": "hotel-001",
    "metadata": {
      "name": "Beach Resort",
      "location": "Bali",
      "price": 200,
      "interests": ["beach", "luxury", "spa"]
    }
  }'

# Retrieve user's view history for recommendations
curl -X GET "http://localhost:3002/api/v1/users/history?actionType=VIEWED&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Use Case 2: Activity Dashboard

Display user's recent activity in their profile dashboard.

```bash
# Get recent activity (last 20 items)
curl -X GET "http://localhost:3002/api/v1/users/history?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get activity statistics for dashboard widgets
curl -X GET "http://localhost:3002/api/v1/users/history/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Use Case 3: Search History Management

Allow users to view and clear their search history.

```bash
# View search history
curl -X GET "http://localhost:3002/api/v1/users/history?entityType=search" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Clear all search history
curl -X DELETE "http://localhost:3002/api/v1/users/history?entityType=search" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Use Case 4: Booking Funnel Analytics

Track the complete booking journey from search to confirmation.

```bash
# 1. User searches for hotels
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "SEARCHED",
    "entityType": "search",
    "entityId": "search-123",
    "metadata": {"query": "hotels in Paris", "resultsCount": 45}
  }'

# 2. User views a specific hotel
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "VIEWED",
    "entityType": "hotel",
    "entityId": "hotel-paris-456",
    "metadata": {"name": "Le Grand Hotel", "price": 250}
  }'

# 3. User creates a booking
curl -X POST "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "CREATED",
    "entityType": "booking",
    "entityId": "booking-789",
    "metadata": {"hotelId": "hotel-paris-456", "totalPrice": 1250}
  }'
```

### Use Case 5: Privacy Compliance

Support GDPR and data privacy requirements.

```bash
# User requests to view all their data
curl -X GET "http://localhost:3002/api/v1/users/history?limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"

# User exercises right to be forgotten
curl -X DELETE "http://localhost:3002/api/v1/users/history" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Integration Notes

### Frontend Integration

**React Example:**

```typescript
import axios from 'axios';

const historyAPI = {
  baseURL: 'http://localhost:3002/api/v1/users/history',

  // Get user history with filters
  async getHistory(params: {
    page?: number;
    limit?: number;
    actionType?: string;
    entityType?: string;
    entityId?: string;
  }) {
    const response = await axios.get(this.baseURL, {
      params,
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Add history entry
  async trackAction(entry: {
    actionType: string;
    entityType: string;
    entityId: string;
    metadata?: object;
  }) {
    const response = await axios.post(this.baseURL, entry, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Get statistics
  async getStats() {
    const response = await axios.get(`${this.baseURL}/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Delete specific entry
  async deleteEntry(id: string) {
    const response = await axios.delete(`${this.baseURL}/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Clear history
  async clearHistory(entityType?: string) {
    const response = await axios.delete(this.baseURL, {
      params: { entityType },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  }
};

export default historyAPI;
```

### Service-to-Service Communication

When other DreamScape services need to track user actions:

```typescript
// From voyage-service tracking a hotel search
await axios.post('http://user-service:3002/api/v1/users/history', {
  actionType: 'SEARCHED',
  entityType: 'hotel',
  entityId: searchQuery.id,
  metadata: {
    query: searchQuery.query,
    filters: searchQuery.filters,
    resultsCount: results.length
  }
}, {
  headers: { Authorization: `Bearer ${userToken}` }
});
```

### Kafka Event Integration

History events can be consumed from Kafka for analytics:

**Topic:** `dreamscape.user.history.created`

**Event Payload:**
```json
{
  "userId": "user-123",
  "actionType": "VIEWED",
  "entityType": "hotel",
  "entityId": "hotel-456",
  "metadata": { "name": "Grand Hotel", "price": 150 },
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### Database Queries

When querying history directly via Prisma:

```typescript
// Get recent hotel views for recommendations
const recentHotelViews = await prisma.userHistory.findMany({
  where: {
    userId: user.id,
    actionType: 'VIEWED',
    entityType: 'hotel',
    createdAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 50
});
```

---

## Performance Considerations

### Database Indexes

Three indexes optimize query performance:

1. `(userId, createdAt DESC)` - Primary user history queries
2. `(userId, entityType)` - Entity type filtering
3. `(entityType, entityId)` - Cross-user entity lookups

### Rate Limiting

Consider implementing rate limiting for high-frequency tracking:

- POST endpoint: 100 requests per minute per user
- GET endpoints: 60 requests per minute per user
- DELETE endpoints: 10 requests per minute per user

### Caching Strategy

Statistics endpoint results can be cached for 5 minutes to reduce database load:

```typescript
// Redis cache key
const cacheKey = `user:${userId}:history:stats`;
const cacheTTL = 300; // 5 minutes
```

### Pagination Best Practices

- Default page size (20) balances performance and user experience
- Maximum page size (100) prevents excessive memory usage
- Always use limit parameter to control response size

---

## Testing

The User History API has comprehensive test coverage:

**Test Location:** `dreamscape-services/user/__tests__/history.test.ts`
**Test Coverage:** 46 passing tests across all endpoints

**Test Categories:**
1. Authentication & Authorization (6 tests)
2. GET /history - Pagination and filtering (12 tests)
3. GET /history/stats - Statistics (3 tests)
4. POST /history - Entry creation (12 tests)
5. DELETE /history/:id - Single deletion (6 tests)
6. DELETE /history - Bulk deletion (7 tests)

**Running Tests:**

```bash
# Run all history tests
npm run test:history

# Run with coverage
npm run test -- history.test.ts --coverage

# Watch mode
npm run test:watch -- history.test.ts
```

---

## Changelog

### Version 1.0.0 (DR-83)

**Release Date:** 2024-01-15

**New Features:**
- ✅ User history tracking for all platform actions
- ✅ Paginated history retrieval with filters
- ✅ History statistics aggregation
- ✅ Individual and bulk history deletion
- ✅ Privacy-compliant data management

**API Endpoints:**
- `GET /api/v1/users/history` - Retrieve paginated history
- `GET /api/v1/users/history/stats` - Get history statistics
- `POST /api/v1/users/history` - Add history entry
- `DELETE /api/v1/users/history/:id` - Delete specific entry
- `DELETE /api/v1/users/history` - Clear user history

**Database Changes:**
- New `user_history` table with optimized indexes
- New `HistoryActionType` enum with 7 action types
- Cascade delete relationship with `users` table

**Test Coverage:**
- 46 passing tests
- 100% code coverage on controllers and routes

---

## Support

For questions, issues, or feature requests related to the User History API:

- **Documentation:** `dreamscape-services/user/docs/api/history-api.md`
- **Tests:** `dreamscape-services/user/__tests__/history.test.ts`
- **Source Code:** `dreamscape-services/user/src/`
  - Routes: `src/routes/history.ts`
  - Controller: `src/controllers/historyController.ts`
  - Schema: `dreamscape-services/db/prisma/schema.prisma` (lines 123-147)

**Related Documentation:**
- [DreamScape API Overview](../../docs/api/README.md)
- [Authentication Guide](../../../auth/docs/authentication.md)
- [Database Schema Documentation](../../../db/docs/schema.md)

---

## License

Copyright © 2024 DreamScape. All rights reserved.
