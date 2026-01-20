import request from 'supertest';
import express, { Express } from 'express';
import historyRoutes from '../src/routes/history';
import { prisma } from '@dreamscape/db';
import jwt from 'jsonwebtoken';

// Mock the Prisma client
jest.mock('@dreamscape/db', () => ({
  prisma: {
    userHistory: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    analytics: {
      create: jest.fn(),
    },
    tokenBlacklist: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock JWT
jest.mock('jsonwebtoken');

describe('User History API Tests', () => {
  let app: Express;
  let validToken: string;
  let mockUserId: string;

  // Test data
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

  beforeAll(() => {
    // Setup Express app with history routes
    app = express();
    app.use(express.json());
    app.use('/api/v1/users/history', historyRoutes);

    validToken = 'valid-test-token';
    mockUserId = mockUser.id;

    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Default mock implementations
    (jwt.verify as jest.Mock).mockReturnValue({
      userId: mockUser.id,
      email: mockUser.email,
      type: 'access',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    });

    (prisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.analytics.create as jest.Mock).mockResolvedValue({ id: 'analytics-1' });
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  // ===========================================
  // Authentication Tests
  // ===========================================

  describe('Authentication & Authorization', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/users/history')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should reject requests with invalid token format', async () => {
      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should reject requests with blacklisted token', async () => {
      (prisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue({
        token: validToken,
        userId: mockUser.id,
        createdAt: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Token has been revoked');
    });

    it('should reject requests with invalid JWT signature', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid signature');
      });

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should reject requests with refresh token instead of access token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        type: 'refresh', // Wrong token type
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      });

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token type');
    });

    it('should reject requests when user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  // ===========================================
  // GET /api/v1/users/history - Get User History
  // ===========================================

  describe('GET /api/v1/users/history', () => {
    it('should get user history with default pagination', async () => {
      const mockHistoryItems = [
        { ...mockHistoryEntry, id: 'history-1' },
        { ...mockHistoryEntry, id: 'history-2' },
      ];

      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue(mockHistoryItems);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });

      expect(prisma.userHistory.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should support custom pagination parameters', async () => {
      const mockHistoryItems = [mockHistoryEntry];

      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue(mockHistoryItems);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(50);

      const response = await request(app)
        .get('/api/v1/users/history?page=3&limit=10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNext: true,
        hasPrevious: true,
      });

      expect(prisma.userHistory.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { createdAt: 'desc' },
        skip: 20, // (page 3 - 1) * limit 10
        take: 10,
      });
    });

    it('should enforce maximum limit of 100 items per page', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/users/history?limit=200')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Should be capped at 100
        })
      );
    });

    it('should filter by actionType', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([mockHistoryEntry]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/users/history?actionType=VIEWED')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            actionType: 'VIEWED',
          },
        })
      );
    });

    it('should filter by entityType', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([mockHistoryEntry]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/users/history?entityType=hotel')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            entityType: 'hotel',
          },
        })
      );
    });

    it('should filter by entityId', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([mockHistoryEntry]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/users/history?entityId=hotel-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            entityId: 'hotel-123',
          },
        })
      );
    });

    it('should combine multiple filters', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([mockHistoryEntry]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/users/history?actionType=VIEWED&entityType=hotel&entityId=hotel-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            actionType: 'VIEWED',
            entityType: 'hotel',
            entityId: 'hotel-123',
          },
        })
      );
    });

    it('should ignore invalid actionType filter', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/users/history?actionType=INVALID_ACTION')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        })
      );
    });

    it('should ignore invalid entityType filter', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/users/history?entityType=invalid_entity')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.userHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        })
      );
    });

    it('should return empty array when no history exists', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      (prisma.userHistory.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );

      const response = await request(app)
        .get('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch user history');
    });
  });

  // ===========================================
  // GET /api/v1/users/history/stats - Get History Statistics
  // ===========================================

  describe('GET /api/v1/users/history/stats', () => {
    it('should return history statistics', async () => {
      const mockActionTypeCounts = [
        { actionType: 'VIEWED', _count: { actionType: 15 } },
        { actionType: 'SEARCHED', _count: { actionType: 8 } },
        { actionType: 'FAVORITED', _count: { actionType: 3 } },
      ];

      const mockEntityTypeCounts = [
        { entityType: 'hotel', _count: { entityType: 10 } },
        { entityType: 'flight', _count: { entityType: 12 } },
        { entityType: 'destination', _count: { entityType: 4 } },
      ];

      const mockRecentActivity = {
        id: 'recent-1',
        createdAt: new Date('2024-01-20T14:30:00Z'),
      };

      (prisma.userHistory.groupBy as jest.Mock)
        .mockResolvedValueOnce(mockActionTypeCounts) // First call for actionType
        .mockResolvedValueOnce(mockEntityTypeCounts); // Second call for entityType

      (prisma.userHistory.count as jest.Mock).mockResolvedValue(26);
      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue(mockRecentActivity);

      const response = await request(app)
        .get('/api/v1/users/history/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalCount).toBe(26);
      expect(response.body.data.byActionType).toEqual({
        VIEWED: 15,
        SEARCHED: 8,
        FAVORITED: 3,
      });
      expect(response.body.data.byEntityType).toEqual({
        hotel: 10,
        flight: 12,
        destination: 4,
      });
      expect(response.body.data.mostRecentActivity).toBe('2024-01-20T14:30:00.000Z');
    });

    it('should return null for mostRecentActivity when no history exists', async () => {
      (prisma.userHistory.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.userHistory.count as jest.Mock).mockResolvedValue(0);
      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/users/history/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalCount).toBe(0);
      expect(response.body.data.byActionType).toEqual({});
      expect(response.body.data.byEntityType).toEqual({});
      expect(response.body.data.mostRecentActivity).toBeNull();
    });

    it('should handle database errors in stats endpoint', async () => {
      (prisma.userHistory.groupBy as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/v1/users/history/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch history statistics');
    });
  });

  // ===========================================
  // POST /api/v1/users/history - Add History Entry
  // ===========================================

  describe('POST /api/v1/users/history', () => {
    it('should create a new history entry successfully', async () => {
      const newEntry = {
        actionType: 'VIEWED',
        entityType: 'hotel',
        entityId: 'hotel-456',
        metadata: { name: 'New Hotel', rating: 4.5 },
      };

      (prisma.userHistory.create as jest.Mock).mockResolvedValue({
        id: 'new-history-123',
        userId: mockUser.id,
        ...newEntry,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(newEntry)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('History entry created successfully');
      expect(response.body.data.actionType).toBe('VIEWED');
      expect(response.body.data.entityType).toBe('hotel');
      expect(response.body.data.entityId).toBe('hotel-456');

      expect(prisma.userHistory.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          actionType: 'VIEWED',
          entityType: 'hotel',
          entityId: 'hotel-456',
          metadata: { name: 'New Hotel', rating: 4.5 },
        },
      });

      expect(prisma.analytics.create).toHaveBeenCalledWith({
        data: {
          service: 'user',
          event: 'history_entry_created',
          userId: mockUser.id,
          data: {
            actionType: 'VIEWED',
            entityType: 'hotel',
            entityId: 'hotel-456',
          },
        },
      });
    });

    it('should create history entry without metadata', async () => {
      const newEntry = {
        actionType: 'SEARCHED',
        entityType: 'flight',
        entityId: 'flight-789',
      };

      (prisma.userHistory.create as jest.Mock).mockResolvedValue({
        id: 'new-history-456',
        userId: mockUser.id,
        ...newEntry,
        metadata: null,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(newEntry)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.userHistory.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          actionType: 'SEARCHED',
          entityType: 'flight',
          entityId: 'flight-789',
          metadata: null,
        },
      });
    });

    it('should reject invalid actionType', async () => {
      const invalidEntry = {
        actionType: 'INVALID_ACTION',
        entityType: 'hotel',
        entityId: 'hotel-123',
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toContain('Invalid action type');
      expect(response.body.error).toContain('CREATED, VIEWED, UPDATED, DELETED, SEARCHED, FAVORITED, UNFAVORITED');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should reject invalid entityType', async () => {
      const invalidEntry = {
        actionType: 'VIEWED',
        entityType: 'invalid_entity',
        entityId: 'entity-123',
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toContain('Invalid entity type');
      expect(response.body.error).toContain('booking, search, favorite, destination, hotel, activity, flight');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should reject missing entityId', async () => {
      const invalidEntry = {
        actionType: 'VIEWED',
        entityType: 'hotel',
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toBe('Entity ID is required and must be a string');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should reject non-string entityId', async () => {
      const invalidEntry = {
        actionType: 'VIEWED',
        entityType: 'hotel',
        entityId: 12345, // Number instead of string
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toBe('Entity ID is required and must be a string');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should reject non-object metadata', async () => {
      const invalidEntry = {
        actionType: 'VIEWED',
        entityType: 'hotel',
        entityId: 'hotel-123',
        metadata: 'invalid-metadata', // String instead of object
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toBe('Metadata must be a valid JSON object');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should reject missing actionType', async () => {
      const invalidEntry = {
        entityType: 'hotel',
        entityId: 'hotel-123',
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toContain('Invalid action type');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should reject missing entityType', async () => {
      const invalidEntry = {
        actionType: 'VIEWED',
        entityId: 'hotel-123',
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidEntry)
        .expect(400);

      expect(response.body.error).toContain('Invalid entity type');
      expect(prisma.userHistory.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during creation', async () => {
      (prisma.userHistory.create as jest.Mock).mockRejectedValue(
        new Error('Database constraint violation')
      );

      const validEntry = {
        actionType: 'VIEWED',
        entityType: 'hotel',
        entityId: 'hotel-123',
      };

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validEntry)
        .expect(500);

      expect(response.body.error).toBe('Failed to create history entry');
    });
  });

  // ===========================================
  // DELETE /api/v1/users/history/:id - Delete Specific Entry
  // ===========================================

  describe('DELETE /api/v1/users/history/:id', () => {
    it('should delete a specific history entry', async () => {
      const entryId = 'history-to-delete-123';

      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue({
        id: entryId,
        userId: mockUser.id,
        actionType: 'VIEWED',
        entityType: 'hotel',
        entityId: 'hotel-123',
        createdAt: new Date(),
      });

      (prisma.userHistory.delete as jest.Mock).mockResolvedValue({
        id: entryId,
      });

      const response = await request(app)
        .delete(`/api/v1/users/history/${entryId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('History entry deleted successfully');

      expect(prisma.userHistory.findFirst).toHaveBeenCalledWith({
        where: {
          id: entryId,
          userId: mockUser.id,
        },
      });

      expect(prisma.userHistory.delete).toHaveBeenCalledWith({
        where: { id: entryId },
      });
    });

    it('should return 404 when history entry does not exist', async () => {
      const nonExistentId = 'non-existent-id';

      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/v1/users/history/${nonExistentId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toBe('History entry not found or does not belong to you');
      expect(prisma.userHistory.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when entry belongs to another user', async () => {
      const entryId = 'other-user-entry';

      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue(null); // No match for userId

      const response = await request(app)
        .delete(`/api/v1/users/history/${entryId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toBe('History entry not found or does not belong to you');
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      const entryId = 'deleted-entry';

      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue({
        id: entryId,
        userId: mockUser.id,
      });

      const prismaError = new Error('Record not found');
      (prismaError as any).code = 'P2025';
      (prisma.userHistory.delete as jest.Mock).mockRejectedValue(prismaError);

      const response = await request(app)
        .delete(`/api/v1/users/history/${entryId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toBe('History entry not found');
    });

    it('should handle database errors during deletion', async () => {
      const entryId = 'entry-123';

      (prisma.userHistory.findFirst as jest.Mock).mockResolvedValue({
        id: entryId,
        userId: mockUser.id,
      });

      (prisma.userHistory.delete as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );

      const response = await request(app)
        .delete(`/api/v1/users/history/${entryId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to delete history entry');
    });
  });

  // ===========================================
  // DELETE /api/v1/users/history - Clear All History
  // ===========================================

  describe('DELETE /api/v1/users/history', () => {
    it('should clear all user history', async () => {
      (prisma.userHistory.deleteMany as jest.Mock).mockResolvedValue({
        count: 15,
      });

      const response = await request(app)
        .delete('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted 15 history entries');
      expect(response.body.data.deletedCount).toBe(15);

      expect(prisma.userHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });

      expect(prisma.analytics.create).toHaveBeenCalledWith({
        data: {
          service: 'user',
          event: 'history_cleared',
          userId: mockUser.id,
          data: {
            deletedCount: 15,
            entityType: 'all',
          },
        },
      });
    });

    it('should clear history filtered by entityType', async () => {
      (prisma.userHistory.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const response = await request(app)
        .delete('/api/v1/users/history?entityType=hotel')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted 5 history entries');
      expect(response.body.data.deletedCount).toBe(5);

      expect(prisma.userHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          entityType: 'hotel',
        },
      });

      expect(prisma.analytics.create).toHaveBeenCalledWith({
        data: {
          service: 'user',
          event: 'history_cleared',
          userId: mockUser.id,
          data: {
            deletedCount: 5,
            entityType: 'hotel',
          },
        },
      });
    });

    it('should return success even when no entries are deleted', async () => {
      (prisma.userHistory.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const response = await request(app)
        .delete('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully deleted 0 history entries');
      expect(response.body.data.deletedCount).toBe(0);
    });

    it('should ignore invalid entityType filter when clearing', async () => {
      (prisma.userHistory.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      const response = await request(app)
        .delete('/api/v1/users/history?entityType=invalid_type')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.userHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id }, // entityType not included
      });

      expect(response.body.data.deletedCount).toBe(10);
    });

    it('should handle database errors during clear operation', async () => {
      (prisma.userHistory.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .delete('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to clear user history');
    });

    it('should handle analytics creation failure gracefully', async () => {
      (prisma.userHistory.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });
      (prisma.analytics.create as jest.Mock).mockRejectedValue(
        new Error('Analytics service unavailable')
      );

      const response = await request(app)
        .delete('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to clear user history');
    });
  });

  // ===========================================
  // Integration Tests
  // ===========================================

  describe('Integration & Edge Cases', () => {
    it('should handle concurrent requests correctly', async () => {
      (prisma.userHistory.create as jest.Mock).mockResolvedValue(mockHistoryEntry);

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/users/history')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            actionType: 'VIEWED',
            entityType: 'hotel',
            entityId: 'hotel-concurrent',
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(prisma.userHistory.create).toHaveBeenCalledTimes(5);
    });

    it('should handle very large metadata objects', async () => {
      const largeMetadata = {
        searchParams: {
          destination: 'Paris',
          dates: Array(100).fill({ date: '2024-01-01', price: 150 }),
        },
        results: Array(50).fill({ hotelId: 'hotel-123', name: 'Test Hotel' }),
      };

      (prisma.userHistory.create as jest.Mock).mockResolvedValue({
        ...mockHistoryEntry,
        metadata: largeMetadata,
      });

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          actionType: 'SEARCHED',
          entityType: 'search',
          entityId: 'search-123',
          metadata: largeMetadata,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle special characters in entityId', async () => {
      const specialEntityId = 'entity-123_with-special@chars#test';

      (prisma.userHistory.create as jest.Mock).mockResolvedValue({
        ...mockHistoryEntry,
        entityId: specialEntityId,
      });

      const response = await request(app)
        .post('/api/v1/users/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          actionType: 'VIEWED',
          entityType: 'hotel',
          entityId: specialEntityId,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entityId).toBe(specialEntityId);
    });

    it('should test all valid action types', async () => {
      const validActionTypes = [
        'CREATED', 'VIEWED', 'UPDATED', 'DELETED',
        'SEARCHED', 'FAVORITED', 'UNFAVORITED'
      ];

      for (const actionType of validActionTypes) {
        (prisma.userHistory.create as jest.Mock).mockResolvedValue({
          ...mockHistoryEntry,
          actionType,
        });

        const response = await request(app)
          .post('/api/v1/users/history')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            actionType,
            entityType: 'hotel',
            entityId: 'hotel-123',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should test all valid entity types', async () => {
      const validEntityTypes = [
        'booking', 'search', 'favorite', 'destination',
        'hotel', 'activity', 'flight'
      ];

      for (const entityType of validEntityTypes) {
        (prisma.userHistory.create as jest.Mock).mockResolvedValue({
          ...mockHistoryEntry,
          entityType,
        });

        const response = await request(app)
          .post('/api/v1/users/history')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            actionType: 'VIEWED',
            entityType,
            entityId: 'entity-123',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });
});
