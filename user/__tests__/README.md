# User Service Tests

This directory contains comprehensive unit and integration tests for the User Service microservice.

## Test Files

### `history.test.ts`
Comprehensive test suite for the User History API (`/api/v1/users/history`)

**Coverage:**
- Authentication & Authorization (6 tests)
- GET /api/v1/users/history - Pagination and filtering (10 tests)
- GET /api/v1/users/history/stats - Statistics aggregation (3 tests)
- POST /api/v1/users/history - Create history entries (10 tests)
- DELETE /api/v1/users/history/:id - Delete specific entries (5 tests)
- DELETE /api/v1/users/history - Clear all history (6 tests)
- Integration & Edge Cases (6 tests)

**Total: 46 test cases**

### `favorites.test.ts`
Comprehensive test suite for the Favorites API (`/api/v1/users/favorites`) - **DR-84**

**Coverage:**
- Authentication Tests (6 tests)
- GET /api/v1/users/favorites - Get all favorites (9 tests)
- POST /api/v1/users/favorites - Add favorite (13 tests)
- GET /api/v1/users/favorites/:id - Get favorite by ID (4 tests)
- PUT /api/v1/users/favorites/:id - Update favorite (13 tests)
- DELETE /api/v1/users/favorites/:id - Delete favorite (6 tests)
- GET /api/v1/users/favorites/check/:entityType/:entityId - Check favorite (6 tests)
- Edge Cases & Security (8 tests)

**Total: 65 test cases**

**Test Coverage:**
- Statement Coverage: 92.9%
- Branch Coverage: 84.37%
- Function Coverage: 100%

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test file
```bash
npm test history.test.ts
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with verbose output
```bash
npm test -- --verbose
```

## Test Structure

All tests follow the DreamScape testing conventions:

1. **Mocking Strategy**
   - Prisma client is mocked using `jest.mock('@dreamscape/db')`
   - JWT authentication is mocked
   - All external dependencies are isolated

2. **Test Organization**
   - Tests are grouped by endpoint/functionality using `describe` blocks
   - Each test case uses descriptive names starting with "should"
   - Setup and teardown in `beforeEach`/`afterEach`

3. **Assertions**
   - Status codes are checked first
   - Response body structure is validated
   - Mock function calls are verified
   - Error messages are checked for clarity

## Coverage Goals

The test suite aims for:
- **Branches**: 70%+
- **Functions**: 70%+
- **Lines**: 70%+
- **Statements**: 70%+

## Key Test Scenarios

### Authentication Tests
- ✅ Missing authorization header
- ✅ Invalid token format
- ✅ Blacklisted tokens
- ✅ Invalid JWT signature
- ✅ Wrong token type (refresh vs access)
- ✅ Non-existent user

### Pagination & Filtering Tests
- ✅ Default pagination (page 1, limit 20)
- ✅ Custom pagination parameters
- ✅ Maximum limit enforcement (100 items)
- ✅ Filter by actionType
- ✅ Filter by entityType
- ✅ Filter by entityId
- ✅ Combined filters
- ✅ Invalid filter handling
- ✅ Empty results

### Validation Tests
- ✅ Invalid actionType values
- ✅ Invalid entityType values
- ✅ Missing required fields
- ✅ Invalid data types
- ✅ Non-object metadata
- ✅ All valid enum values

### Error Handling Tests
- ✅ Database connection errors
- ✅ Prisma P2025 errors (record not found)
- ✅ Analytics service failures
- ✅ Concurrent request handling

### Edge Cases
- ✅ Large metadata objects
- ✅ Special characters in entityId
- ✅ Zero results scenarios
- ✅ Concurrent operations

## Mock Data

The tests use consistent mock data:

```typescript
const mockUser = {
  id: 'test-user-id-123',
  email: 'testuser@example.com',
};

const mockHistoryEntry = {
  id: 'history-entry-123',
  userId: mockUser.id,
  actionType: 'VIEWED',
  entityType: 'hotel',
  entityId: 'hotel-123',
  metadata: { name: 'Test Hotel', price: 150 },
  createdAt: new Date('2024-01-15T10:30:00Z'),
};
```

## Valid Enum Values

### Action Types (HistoryActionType)
- CREATED
- VIEWED
- UPDATED
- DELETED
- SEARCHED
- FAVORITED
- UNFAVORITED

### Entity Types
- booking
- search
- favorite
- destination
- hotel
- activity
- flight

## CI/CD Integration

These tests are automatically run as part of the CI/CD pipeline:

1. **Pull Request Checks**: All tests must pass before merging
2. **Coverage Reports**: Generated on each run and uploaded to CI
3. **Test Results**: Displayed in PR status checks

## Troubleshooting

### Tests fail with "Cannot find module @dreamscape/db"
Ensure the db package is properly linked:
```bash
cd ../db
npm install
npm run db:generate
```

### JWT_SECRET not configured errors
Check that `__tests__/setup.ts` is being loaded. The setup file sets test environment variables.

### Timeout errors
Increase the timeout in `jest.config.js`:
```javascript
testTimeout: 15000 // Increase from 10000
```

## Contributing

When adding new endpoints or features:

1. Create corresponding test cases
2. Ensure >70% coverage for new code
3. Follow existing test patterns
4. Update this README with new test scenarios

## Related Documentation

- [DreamScape Testing Guidelines](../../../dreamscape-docs/testing/)
- [Jest Configuration](../jest.config.js)
- [User Service API Docs](../../../dreamscape-docs/api/user/)
