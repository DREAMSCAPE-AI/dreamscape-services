# Favorites API Documentation

## Overview
The Favorites API allows authenticated users to manage their favorite travel-related items (flights, hotels, activities, destinations, and bookings).

## Base URL
```
/api/v1/users/favorites
```

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Endpoints

### 1. Get All Favorites
Get all favorites for the authenticated user with optional filtering and pagination.

**Endpoint:** `GET /api/v1/users/favorites`

**Query Parameters:**
- `limit` (optional): Number of items per page (default: 20, max: 100)
- `offset` (optional): Number of items to skip (default: 0)
- `entityType` (optional): Filter by entity type (FLIGHT, HOTEL, ACTIVITY, DESTINATION, BOOKING)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "entityType": "HOTEL",
      "entityId": "hotel-123",
      "entityData": {
        "name": "Grand Hotel Paris",
        "location": "Paris, France",
        "rating": 4.5
      },
      "category": "Weekend Getaways",
      "notes": "Perfect for romantic trips",
      "createdAt": "2024-01-13T10:00:00Z",
      "updatedAt": "2024-01-13T10:00:00Z",
      "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "username": "john_doe"
      }
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/v1/users/favorites?limit=20&entityType=HOTEL" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Add Favorite
Add a new item to favorites.

**Endpoint:** `POST /api/v1/users/favorites`

**Request Body:**
```json
{
  "entityType": "HOTEL",
  "entityId": "hotel-123",
  "entityData": {
    "name": "Grand Hotel Paris",
    "location": "Paris, France",
    "rating": 4.5,
    "pricePerNight": 250
  },
  "category": "Weekend Getaways",
  "notes": "Perfect for romantic trips"
}
```

**Required Fields:**
- `entityType`: One of [FLIGHT, HOTEL, ACTIVITY, DESTINATION, BOOKING]
- `entityId`: String identifier for the entity

**Optional Fields:**
- `entityData`: JSON object with cached entity information
- `category`: User-defined category for organization
- `notes`: User notes about the favorite

**Success Response (201):**
```json
{
  "success": true,
  "message": "Favorite added successfully",
  "data": {
    "id": "uuid",
    "userId": "user-uuid",
    "entityType": "HOTEL",
    "entityId": "hotel-123",
    "entityData": { ... },
    "category": "Weekend Getaways",
    "notes": "Perfect for romantic trips",
    "createdAt": "2024-01-13T10:00:00Z",
    "updatedAt": "2024-01-13T10:00:00Z",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "username": "john_doe"
    }
  }
}
```

**Error Response (409):**
```json
{
  "success": false,
  "error": "This item is already in your favorites"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3002/api/v1/users/favorites" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "HOTEL",
    "entityId": "hotel-123",
    "entityData": {
      "name": "Grand Hotel Paris",
      "location": "Paris, France"
    },
    "category": "Weekend Getaways"
  }'
```

---

### 3. Get Favorite by ID
Get a specific favorite by its ID.

**Endpoint:** `GET /api/v1/users/favorites/:id`

**URL Parameters:**
- `id`: Favorite UUID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "user-uuid",
    "entityType": "HOTEL",
    "entityId": "hotel-123",
    "entityData": { ... },
    "category": "Weekend Getaways",
    "notes": "Perfect for romantic trips",
    "createdAt": "2024-01-13T10:00:00Z",
    "updatedAt": "2024-01-13T10:00:00Z",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "username": "john_doe"
    }
  }
}
```

**Error Responses:**
- `404`: Favorite not found
- `403`: Access denied (favorite belongs to another user)

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/v1/users/favorites/uuid-here" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Update Favorite
Update an existing favorite's metadata.

**Endpoint:** `PUT /api/v1/users/favorites/:id`

**URL Parameters:**
- `id`: Favorite UUID

**Request Body:**
```json
{
  "category": "Summer Vacations",
  "notes": "Updated notes",
  "entityData": {
    "name": "Grand Hotel Paris",
    "location": "Paris, France",
    "rating": 4.7
  }
}
```

**Note:** All fields are optional. Only provide the fields you want to update.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Favorite updated successfully",
  "data": {
    "id": "uuid",
    "userId": "user-uuid",
    "entityType": "HOTEL",
    "entityId": "hotel-123",
    "entityData": { ... },
    "category": "Summer Vacations",
    "notes": "Updated notes",
    "createdAt": "2024-01-13T10:00:00Z",
    "updatedAt": "2024-01-13T10:30:00Z",
    "user": { ... }
  }
}
```

**Error Responses:**
- `404`: Favorite not found
- `403`: Access denied (favorite belongs to another user)
- `400`: No valid fields to update

**Example Request:**
```bash
curl -X PUT "http://localhost:3002/api/v1/users/favorites/uuid-here" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Summer Vacations",
    "notes": "Updated notes"
  }'
```

---

### 5. Delete Favorite
Remove a favorite from the user's list.

**Endpoint:** `DELETE /api/v1/users/favorites/:id`

**URL Parameters:**
- `id`: Favorite UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Favorite deleted successfully"
}
```

**Error Responses:**
- `404`: Favorite not found
- `403`: Access denied (favorite belongs to another user)

**Example Request:**
```bash
curl -X DELETE "http://localhost:3002/api/v1/users/favorites/uuid-here" \
  -H "Authorization: Bearer <token>"
```

---

### 6. Check if Favorited
Check if a specific entity is in the user's favorites.

**Endpoint:** `GET /api/v1/users/favorites/check/:entityType/:entityId`

**URL Parameters:**
- `entityType`: One of [FLIGHT, HOTEL, ACTIVITY, DESTINATION, BOOKING]
- `entityId`: String identifier for the entity

**Success Response (200):**
```json
{
  "success": true,
  "isFavorited": true,
  "favorite": {
    "id": "uuid",
    "createdAt": "2024-01-13T10:00:00Z"
  }
}
```

Or if not favorited:
```json
{
  "success": true,
  "isFavorited": false,
  "favorite": null
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/v1/users/favorites/check/HOTEL/hotel-123" \
  -H "Authorization: Bearer <token>"
```

---

## Entity Types

The following entity types are supported:

| Type | Description |
|------|-------------|
| `FLIGHT` | Flight bookings or searches |
| `HOTEL` | Hotel accommodations |
| `ACTIVITY` | Travel activities and experiences |
| `DESTINATION` | Travel destinations |
| `BOOKING` | Complete booking packages |

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input data |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Access denied |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Duplicate favorite |
| `500` | Internal Server Error |

---

## Data Models

### Favorite Schema
```typescript
interface Favorite {
  id: string;                    // UUID
  userId: string;                // User UUID
  entityType: FavoriteType;      // Enum: FLIGHT, HOTEL, ACTIVITY, DESTINATION, BOOKING
  entityId: string;              // External entity identifier
  entityData: object | null;     // Cached entity information (JSON)
  category: string | null;       // User-defined category
  notes: string | null;          // User notes
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
}
```

---

## Usage Examples

### Example 1: Add a favorite hotel
```javascript
const response = await fetch('http://localhost:3002/api/v1/users/favorites', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    entityType: 'HOTEL',
    entityId: 'hotel-paris-grand',
    entityData: {
      name: 'Grand Hotel Paris',
      location: 'Paris, France',
      rating: 4.5,
      pricePerNight: 250
    },
    category: 'Weekend Getaways'
  })
});

const data = await response.json();
console.log(data);
```

### Example 2: Get all hotel favorites
```javascript
const response = await fetch('http://localhost:3002/api/v1/users/favorites?entityType=HOTEL&limit=50', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
console.log(`Found ${data.pagination.total} hotel favorites`);
```

### Example 3: Check if hotel is favorited
```javascript
const response = await fetch('http://localhost:3002/api/v1/users/favorites/check/HOTEL/hotel-paris-grand', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
if (data.isFavorited) {
  console.log('This hotel is already in favorites!');
}
```

---

## Database Constraints

- **Unique Constraint:** Each user can only favorite a specific entity once (userId + entityType + entityId)
- **Cascade Delete:** When a user is deleted, all their favorites are automatically deleted
- **Indexes:** Optimized for querying by userId, entityType, and chronological listing

---

## Testing

To test the endpoints, you can use the provided test suite:

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration
```

Example test cases to implement:
1. Add a favorite successfully
2. Prevent duplicate favorites
3. Get all favorites with pagination
4. Filter favorites by entity type
5. Update favorite metadata
6. Delete a favorite
7. Check favorite status
8. Verify authorization (users can only access their own favorites)
