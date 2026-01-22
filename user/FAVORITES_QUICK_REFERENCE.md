# Favorites API - Quick Reference Card

## Base URL
```
http://localhost:3002/api/v1/users/favorites
```

## Authentication
All requests require JWT token:
```
Authorization: Bearer <token>
```

---

## Endpoints Cheatsheet

### List Favorites
```http
GET /api/v1/users/favorites?limit=20&offset=0&entityType=HOTEL
```

### Add Favorite
```http
POST /api/v1/users/favorites
Content-Type: application/json

{
  "entityType": "HOTEL",
  "entityId": "hotel-123",
  "entityData": {...},
  "category": "Weekend Trips",
  "notes": "Optional notes"
}
```

### Get Single Favorite
```http
GET /api/v1/users/favorites/{favoriteId}
```

### Update Favorite
```http
PUT /api/v1/users/favorites/{favoriteId}
Content-Type: application/json

{
  "category": "New Category",
  "notes": "Updated notes",
  "entityData": {...}
}
```

### Delete Favorite
```http
DELETE /api/v1/users/favorites/{favoriteId}
```

### Check if Favorited
```http
GET /api/v1/users/favorites/check/{entityType}/{entityId}
```

---

## Entity Types
- `FLIGHT` - Flight bookings
- `HOTEL` - Hotel accommodations
- `ACTIVITY` - Travel activities
- `DESTINATION` - Travel destinations
- `BOOKING` - Complete packages

---

## Common Response Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Duplicate |
| 500 | Server Error |

---

## Pagination
```javascript
{
  "data": [...],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## JavaScript Examples

### Add to Favorites
```javascript
async function addToFavorites(entityType, entityId, data) {
  const response = await fetch('/api/v1/users/favorites', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entityType,
      entityId,
      entityData: data,
      category: 'My Trips'
    })
  });
  return response.json();
}
```

### Check if Favorited
```javascript
async function isFavorited(entityType, entityId) {
  const response = await fetch(
    `/api/v1/users/favorites/check/${entityType}/${entityId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  return data.isFavorited;
}
```

### Get All Hotels
```javascript
async function getHotelFavorites() {
  const response = await fetch(
    '/api/v1/users/favorites?entityType=HOTEL&limit=50',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return response.json();
}
```

### Remove Favorite
```javascript
async function removeFavorite(favoriteId) {
  const response = await fetch(
    `/api/v1/users/favorites/${favoriteId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return response.json();
}
```

---

## cURL Examples

### Add Favorite
```bash
curl -X POST http://localhost:3002/api/v1/users/favorites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "HOTEL",
    "entityId": "hotel-paris-123",
    "entityData": {
      "name": "Grand Hotel Paris",
      "rating": 4.5
    }
  }'
```

### Get All Favorites
```bash
curl -X GET "http://localhost:3002/api/v1/users/favorites?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Check Favorite
```bash
curl -X GET "http://localhost:3002/api/v1/users/favorites/check/HOTEL/hotel-paris-123" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Favorite
```bash
curl -X PUT http://localhost:3002/api/v1/users/favorites/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "Summer 2024"}'
```

### Delete Favorite
```bash
curl -X DELETE http://localhost:3002/api/v1/users/favorites/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useFavorite(entityType, entityId) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkFavorite();
  }, [entityType, entityId]);

  const checkFavorite = async () => {
    const res = await fetch(
      `/api/v1/users/favorites/check/${entityType}/${entityId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json();
    setIsFavorited(data.isFavorited);
    setFavoriteId(data.favorite?.id || null);
  };

  const toggleFavorite = async (entityData) => {
    setLoading(true);
    try {
      if (isFavorited) {
        await fetch(`/api/v1/users/favorites/${favoriteId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsFavorited(false);
        setFavoriteId(null);
      } else {
        const res = await fetch('/api/v1/users/favorites', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entityType,
            entityId,
            entityData
          })
        });
        const data = await res.json();
        setIsFavorited(true);
        setFavoriteId(data.data.id);
      }
    } finally {
      setLoading(false);
    }
  };

  return { isFavorited, toggleFavorite, loading };
}

// Usage in component
function HotelCard({ hotel }) {
  const { isFavorited, toggleFavorite, loading } = useFavorite('HOTEL', hotel.id);

  return (
    <button
      onClick={() => toggleFavorite(hotel)}
      disabled={loading}
    >
      {isFavorited ? '❤️' : '🤍'}
    </button>
  );
}
```

---

## Testing Checklist

- [ ] Add a favorite successfully
- [ ] Verify duplicate prevention (409 error)
- [ ] Get all favorites with pagination
- [ ] Filter by entity type
- [ ] Get single favorite by ID
- [ ] Update favorite metadata
- [ ] Delete favorite
- [ ] Check favorite status
- [ ] Verify authentication required
- [ ] Verify user can only access own favorites
- [ ] Test with invalid entity type
- [ ] Test with missing required fields
- [ ] Test pagination limits

---

## Common Errors

### 401 Unauthorized
```json
{"success": false, "error": "Authentication required"}
```
**Fix:** Include valid JWT token in Authorization header

### 409 Conflict
```json
{"success": false, "error": "This item is already in your favorites"}
```
**Fix:** Item already favorited. Check before adding or handle gracefully.

### 400 Bad Request
```json
{"success": false, "error": "Entity type is required"}
```
**Fix:** Include all required fields (entityType, entityId)

### 403 Forbidden
```json
{"success": false, "error": "Access denied"}
```
**Fix:** User trying to access another user's favorite

---

## Database Schema Reference

```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id VARCHAR NOT NULL,
  entity_data JSONB,
  category VARCHAR,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_favorites_user_created ON favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_user_type ON favorites(user_id, entity_type);
CREATE INDEX idx_favorites_user_entity ON favorites(user_id, entity_id);
```

---

## Performance Tips

1. **Pagination:** Always use `limit` parameter to avoid large response payloads
2. **Filtering:** Use `entityType` filter when displaying specific categories
3. **Caching:** Cache `isFavorited` status on frontend with 30-second TTL
4. **Batch Checks:** For multiple items, check individually (no batch endpoint yet)
5. **Optimistic UI:** Update UI immediately, rollback on error

---

## Support

For issues or questions:
- Check full documentation: `FAVORITES_API.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Code location: `user/src/controllers/favoriteController.ts`
