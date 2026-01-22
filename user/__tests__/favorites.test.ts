import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, FavoriteType } from '@dreamscape/db';
import favoritesRoutes from '../src/routes/favorites';

// Mock Prisma
jest.mock('@dreamscape/db', () => ({
  prisma: {
    favorite: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    tokenBlacklist: {
      findUnique: jest.fn(),
    },
  },
  FavoriteType: {
    FLIGHT: 'FLIGHT',
    HOTEL: 'HOTEL',
    ACTIVITY: 'ACTIVITY',
    DESTINATION: 'DESTINATION',
    BOOKING: 'BOOKING',
  },
}));

describe('Favorites API Endpoints', () => {
  let app: Express;
  let validToken: string;
  let expiredToken: string;
  const testUserId = 'test-user-id-123';
  const testUserEmail = 'test@example.com';
  const otherUserId = 'other-user-id-456';
  const testFavoriteId = 'favorite-id-789';
  const JWT_SECRET = 'test-jwt-secret';

  // Sample favorite data
  const sampleFavorite = {
    id: testFavoriteId,
    userId: testUserId,
    entityType: FavoriteType.FLIGHT,
    entityId: 'flight-123',
    entityData: {
      airline: 'Test Airlines',
      origin: 'JFK',
      destination: 'LAX',
    },
    category: 'Business Travel',
    notes: 'Preferred flight',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: {
      id: testUserId,
      email: testUserEmail,
      username: 'testuser',
    },
  };

  beforeAll(() => {
    // Set JWT_SECRET for tests
    process.env.JWT_SECRET = JWT_SECRET;

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/v1/users/favorites', favoritesRoutes);
  });

  beforeEach(() => {
    // Generate valid token
    validToken = jwt.sign(
      {
        userId: testUserId,
        email: testUserEmail,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate expired token
    expiredToken = jwt.sign(
      {
        userId: testUserId,
        email: testUserEmail,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations
    (prisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: testUserId,
      email: testUserEmail,
    });
  });

  describe('Authentication Tests', () => {
    describe('GET /api/v1/users/favorites', () => {
      it('should return 401 when no token is provided', async () => {
        const response = await request(app)
          .get('/api/v1/users/favorites')
          .expect(401);

        expect(response.body).toEqual({
          success: false,
          message: 'Access token required',
        });
      });

      it('should return 401 when invalid token is provided', async () => {
        const response = await request(app)
          .get('/api/v1/users/favorites')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toEqual({
          success: false,
          message: 'Invalid token',
        });
      });

      it('should return 401 when expired token is provided', async () => {
        const response = await request(app)
          .get('/api/v1/users/favorites')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body).toEqual({
          success: false,
          message: 'Invalid token',
        });
      });

      it('should return 401 when token is blacklisted', async () => {
        (prisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue({
          token: validToken,
        });

        const response = await request(app)
          .get('/api/v1/users/favorites')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(401);

        expect(response.body).toEqual({
          success: false,
          message: 'Token has been revoked',
        });
      });

      it('should return 401 when user does not exist', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .get('/api/v1/users/favorites')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(401);

        expect(response.body).toEqual({
          success: false,
          message: 'User not found',
        });
      });

      it('should return 401 when refresh token is used instead of access token', async () => {
        const refreshToken = jwt.sign(
          {
            userId: testUserId,
            email: testUserEmail,
            type: 'refresh',
          },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        const response = await request(app)
          .get('/api/v1/users/favorites')
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(401);

        expect(response.body).toEqual({
          success: false,
          message: 'Invalid token type',
        });
      });
    });
  });

  describe('GET /api/v1/users/favorites - getAllFavorites', () => {
    it('should return user favorites with default pagination', async () => {
      const mockFavorites = [sampleFavorite];
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue(mockFavorites);
      (prisma.favorite.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        pagination: {
          total: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: sampleFavorite.id,
        userId: sampleFavorite.userId,
        entityType: sampleFavorite.entityType,
        entityId: sampleFavorite.entityId,
      });

      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });
    });

    it('should return empty array when user has no favorites', async () => {
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.favorite.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });
    });

    it('should handle custom pagination parameters correctly', async () => {
      const mockFavorites = [sampleFavorite];
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue(mockFavorites);
      (prisma.favorite.count as jest.Mock).mockResolvedValue(100);

      const response = await request(app)
        .get('/api/v1/users/favorites?limit=10&offset=20')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.pagination).toEqual({
        total: 100,
        limit: 10,
        offset: 20,
        hasMore: true,
      });

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should enforce maximum limit of 100', async () => {
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.favorite.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/v1/users/favorites?limit=200')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('should filter by entityType correctly', async () => {
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue([sampleFavorite]);
      (prisma.favorite.count as jest.Mock).mockResolvedValue(1);

      await request(app)
        .get('/api/v1/users/favorites?entityType=FLIGHT')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: testUserId,
            entityType: 'FLIGHT',
          },
        })
      );
    });

    it('should return 400 for invalid entityType', async () => {
      const response = await request(app)
        .get('/api/v1/users/favorites?entityType=INVALID_TYPE')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid entity type'),
      });
    });

    it('should handle negative offset gracefully', async () => {
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.favorite.count as jest.Mock).mockResolvedValue(0);

      await request(app)
        .get('/api/v1/users/favorites?offset=-10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: -10,
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (prisma.favorite.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );

      const response = await request(app)
        .get('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to fetch favorites',
      });
    });
  });

  describe('POST /api/v1/users/favorites - addFavorite', () => {
    const validFavoriteData = {
      entityType: 'FLIGHT',
      entityId: 'flight-123',
      entityData: {
        airline: 'Test Airlines',
        price: 500,
      },
      category: 'Business Travel',
      notes: 'Preferred option',
    };

    it('should successfully add a favorite with valid data', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validFavoriteData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Favorite added successfully',
        data: expect.objectContaining({
          id: sampleFavorite.id,
          userId: sampleFavorite.userId,
          entityType: sampleFavorite.entityType,
          entityId: sampleFavorite.entityId,
          category: sampleFavorite.category,
          notes: sampleFavorite.notes,
        }),
      });
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();

      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: {
          userId: testUserId,
          entityType: validFavoriteData.entityType,
          entityId: validFavoriteData.entityId,
          entityData: validFavoriteData.entityData,
          category: validFavoriteData.category,
          notes: validFavoriteData.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });
    });

    it('should successfully add favorite with only required fields', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        entityData: null,
        category: null,
        notes: null,
      });

      const minimalData = {
        entityType: 'HOTEL',
        entityId: 'hotel-456',
      };

      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(minimalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(prisma.favorite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'HOTEL',
            entityId: 'hotel-456',
            entityData: null,
            category: null,
            notes: null,
          }),
        })
      );
    });

    it('should return 400 when entityType is missing', async () => {
      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ entityId: 'flight-123' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Entity type is required'),
      });
    });

    it('should return 400 when entityId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ entityType: 'FLIGHT' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Entity ID is required'),
      });
    });

    it('should return 400 when entityType is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ entityType: 'INVALID', entityId: 'test-123' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid entity type'),
      });
    });

    it('should return 400 when entityId is not a string', async () => {
      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ entityType: 'FLIGHT', entityId: 123 })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Entity ID must be a string'),
      });
    });

    it('should return 400 when category is not a string', async () => {
      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          entityType: 'FLIGHT',
          entityId: 'flight-123',
          category: 123,
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Category must be a string'),
      });
    });

    it('should return 400 when notes is not a string', async () => {
      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          entityType: 'FLIGHT',
          entityId: 'flight-123',
          notes: { invalid: 'object' },
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Notes must be a string'),
      });
    });

    it('should return 409 when duplicate favorite exists', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validFavoriteData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'This item is already in your favorites',
      });

      expect(prisma.favorite.create).not.toHaveBeenCalled();
    });

    it('should return 409 when Prisma P2002 error occurs (unique constraint)', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      const prismaError = new Error('Unique constraint failed') as any;
      prismaError.code = 'P2002';
      (prisma.favorite.create as jest.Mock).mockRejectedValue(prismaError);

      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validFavoriteData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'This item is already in your favorites',
      });
    });

    it('should handle very long strings in notes', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      const longNotes = 'A'.repeat(10000);
      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          ...validFavoriteData,
          notes: longNotes,
        })
        .expect(201);

      expect(prisma.favorite.create).toHaveBeenCalled();
    });

    it('should handle large JSON objects in entityData', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      const largeEntityData = {
        details: 'X'.repeat(5000),
        nested: {
          deeply: {
            nested: {
              data: 'test',
            },
          },
        },
        array: Array(100).fill({ key: 'value' }),
      };

      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          ...validFavoriteData,
          entityData: largeEntityData,
        })
        .expect(201);

      expect(prisma.favorite.create).toHaveBeenCalled();
    });

    it('should handle all valid FavoriteType values', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      const entityTypes = ['FLIGHT', 'HOTEL', 'ACTIVITY', 'DESTINATION', 'BOOKING'];

      for (const entityType of entityTypes) {
        await request(app)
          .post('/api/v1/users/favorites')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            entityType,
            entityId: `test-${entityType}-id`,
          })
          .expect(201);
      }

      expect(prisma.favorite.create).toHaveBeenCalledTimes(entityTypes.length);
    });

    it('should handle database errors gracefully', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validFavoriteData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to add favorite',
      });
    });
  });

  describe('GET /api/v1/users/favorites/:id - getFavoriteById', () => {
    it('should return favorite with valid ID', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .get(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: sampleFavorite.id,
          userId: sampleFavorite.userId,
          entityType: sampleFavorite.entityType,
          entityId: sampleFavorite.entityId,
        }),
      });
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();

      expect(prisma.favorite.findUnique).toHaveBeenCalledWith({
        where: { id: testFavoriteId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });
    });

    it('should return 404 for non-existent favorite ID', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/users/favorites/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Favorite not found',
      });
    });

    it('should return 403 when accessing another user\'s favorite', async () => {
      const otherUserFavorite = {
        ...sampleFavorite,
        userId: otherUserId,
      };
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(otherUserFavorite);

      const response = await request(app)
        .get(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Access denied',
      });
    });

    it('should handle database errors gracefully', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to fetch favorite',
      });
    });
  });

  describe('PUT /api/v1/users/favorites/:id - updateFavorite', () => {
    const updateData = {
      category: 'Leisure Travel',
      notes: 'Updated notes',
      entityData: {
        newField: 'newValue',
      },
    };

    it('should successfully update favorite with valid data', async () => {
      const updatedFavorite = {
        ...sampleFavorite,
        ...updateData,
      };

      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue(updatedFavorite);

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Favorite updated successfully',
        data: expect.objectContaining({
          id: updatedFavorite.id,
          userId: updatedFavorite.userId,
          entityType: updatedFavorite.entityType,
          entityId: updatedFavorite.entityId,
          category: updateData.category,
          notes: updateData.notes,
        }),
      });
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();

      expect(prisma.favorite.update).toHaveBeenCalledWith({
        where: { id: testFavoriteId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });
    });

    it('should update only category field', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        category: 'New Category',
      });

      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ category: 'New Category' })
        .expect(200);

      expect(prisma.favorite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { category: 'New Category' },
        })
      );
    });

    it('should update only notes field', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        notes: 'New notes',
      });

      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ notes: 'New notes' })
        .expect(200);

      expect(prisma.favorite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { notes: 'New notes' },
        })
      );
    });

    it('should update only entityData field', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        entityData: { updated: true },
      });

      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ entityData: { updated: true } })
        .expect(200);

      expect(prisma.favorite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { entityData: { updated: true } },
        })
      );
    });

    it('should return 404 for non-existent favorite ID', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/users/favorites/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Favorite not found',
      });

      expect(prisma.favorite.update).not.toHaveBeenCalled();
    });

    it('should return 403 when updating another user\'s favorite', async () => {
      const otherUserFavorite = {
        ...sampleFavorite,
        userId: otherUserId,
      };
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(otherUserFavorite);

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Access denied',
      });

      expect(prisma.favorite.update).not.toHaveBeenCalled();
    });

    it('should return 400 when no valid fields to update', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'No valid fields to update',
      });

      expect(prisma.favorite.update).not.toHaveBeenCalled();
    });

    it('should return 400 when category is invalid type', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ category: 123 })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Category must be a string or null',
      });
    });

    it('should return 400 when notes is invalid type', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ notes: ['invalid', 'array'] })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Notes must be a string or null',
      });
    });

    it('should allow setting category to null', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        category: null,
      });

      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ category: null })
        .expect(200);

      expect(prisma.favorite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { category: null },
        })
      );
    });

    it('should allow setting notes to null', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        notes: null,
      });

      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ notes: null })
        .expect(200);

      expect(prisma.favorite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { notes: null },
        })
      );
    });

    it('should ignore immutable fields in update body', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue({
        ...sampleFavorite,
        category: 'Updated',
      });

      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          category: 'Updated',
          userId: 'should-be-ignored',
          entityType: 'HOTEL',
          entityId: 'new-id',
        })
        .expect(200);

      expect(prisma.favorite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { category: 'Updated' },
        })
      );
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      const prismaError = new Error('Record not found') as any;
      prismaError.code = 'P2025';
      (prisma.favorite.update as jest.Mock).mockRejectedValue(prismaError);

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Favorite not found',
      });
    });

    it('should handle database errors gracefully', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to update favorite',
      });
    });
  });

  describe('DELETE /api/v1/users/favorites/:id - deleteFavorite', () => {
    it('should successfully delete favorite', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.delete as jest.Mock).mockResolvedValue(sampleFavorite);

      const response = await request(app)
        .delete(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Favorite deleted successfully',
      });

      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: testFavoriteId },
      });
    });

    it('should return 404 for non-existent favorite ID', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/users/favorites/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Favorite not found',
      });

      expect(prisma.favorite.delete).not.toHaveBeenCalled();
    });

    it('should return 403 when deleting another user\'s favorite', async () => {
      const otherUserFavorite = {
        ...sampleFavorite,
        userId: otherUserId,
      };
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(otherUserFavorite);

      const response = await request(app)
        .delete(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Access denied',
      });

      expect(prisma.favorite.delete).not.toHaveBeenCalled();
    });

    it('should be idempotent - return 404 on second delete', async () => {
      // First delete succeeds
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.delete as jest.Mock).mockResolvedValue(sampleFavorite);

      await request(app)
        .delete(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Second delete returns 404
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Favorite not found',
      });
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      const prismaError = new Error('Record not found') as any;
      prismaError.code = 'P2025';
      (prisma.favorite.delete as jest.Mock).mockRejectedValue(prismaError);

      const response = await request(app)
        .delete(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Favorite not found',
      });
    });

    it('should handle database errors gracefully', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .delete(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to delete favorite',
      });
    });
  });

  describe('GET /api/v1/users/favorites/check/:entityType/:entityId - checkFavorite', () => {
    it('should return isFavorited: true when favorite exists', async () => {
      const favoriteSummary = {
        id: testFavoriteId,
        createdAt: new Date('2024-01-01'),
      };
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(favoriteSummary);

      const response = await request(app)
        .get('/api/v1/users/favorites/check/FLIGHT/flight-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        isFavorited: true,
        favorite: {
          id: favoriteSummary.id,
          createdAt: favoriteSummary.createdAt.toISOString(),
        },
      });

      expect(prisma.favorite.findUnique).toHaveBeenCalledWith({
        where: {
          userId_entityType_entityId: {
            userId: testUserId,
            entityType: 'FLIGHT',
            entityId: 'flight-123',
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    });

    it('should return isFavorited: false when favorite does not exist', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/users/favorites/check/HOTEL/hotel-456')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        isFavorited: false,
        favorite: null,
      });
    });

    it('should return 400 for invalid entityType', async () => {
      const response = await request(app)
        .get('/api/v1/users/favorites/check/INVALID_TYPE/entity-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid entity type'),
      });
    });

    it('should work with all valid FavoriteType values', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const entityTypes = ['FLIGHT', 'HOTEL', 'ACTIVITY', 'DESTINATION', 'BOOKING'];

      for (const entityType of entityTypes) {
        await request(app)
          .get(`/api/v1/users/favorites/check/${entityType}/test-id`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);
      }

      expect(prisma.favorite.findUnique).toHaveBeenCalledTimes(entityTypes.length);
    });

    it('should handle special characters in entityId', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const specialEntityId = 'entity-123-with-special-chars-!@#$%';
      await request(app)
        .get(`/api/v1/users/favorites/check/FLIGHT/${encodeURIComponent(specialEntityId)}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(prisma.favorite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_entityType_entityId: expect.objectContaining({
              entityId: specialEntityId,
            }),
          },
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/v1/users/favorites/check/FLIGHT/flight-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to check favorite status',
      });
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle SQL injection attempts in favorite ID', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);

      const sqlInjection = "'; DROP TABLE favorites; --";
      await request(app)
        .get(`/api/v1/users/favorites/${sqlInjection}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(prisma.favorite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sqlInjection },
        })
      );
    });

    it('should handle very long category strings', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(sampleFavorite);
      (prisma.favorite.update as jest.Mock).mockResolvedValue(sampleFavorite);

      const longCategory = 'A'.repeat(10000);
      await request(app)
        .put(`/api/v1/users/favorites/${testFavoriteId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ category: longCategory })
        .expect(200);
    });

    it('should handle deeply nested JSON in entityData', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      const deeplyNested: any = { level: 0 };
      let current = deeplyNested;
      for (let i = 1; i < 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          entityType: 'FLIGHT',
          entityId: 'test-id',
          entityData: deeplyNested,
        })
        .expect(201);
    });

    it('should handle concurrent requests to add same favorite', async () => {
      // First request - check returns null
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValueOnce(null);
      // Second request - check returns null
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValueOnce(null);
      // First create succeeds
      (prisma.favorite.create as jest.Mock).mockResolvedValueOnce(sampleFavorite);
      // Second create fails with P2002
      const prismaError = new Error('Unique constraint failed') as any;
      prismaError.code = 'P2002';
      (prisma.favorite.create as jest.Mock).mockRejectedValueOnce(prismaError);

      const favoriteData = {
        entityType: 'FLIGHT',
        entityId: 'concurrent-test',
      };

      // First request succeeds
      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(favoriteData)
        .expect(201);

      // Second request returns 409
      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(favoriteData)
        .expect(409);
    });

    it('should handle empty strings in optional fields (converts to null)', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          entityType: 'HOTEL',
          entityId: 'test-id',
          category: '',
          notes: '',
        })
        .expect(201);

      // Empty strings are converted to null by the controller using || operator
      expect(prisma.favorite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: null,
            notes: null,
          }),
        })
      );
    });

    it('should handle Unicode characters in notes and category', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(sampleFavorite);

      const unicodeData = {
        entityType: 'DESTINATION',
        entityId: 'dest-123',
        category: '旅行 - 出張 - Voyage',
        notes: 'This has emojis 🌍✈️🏨 and special chars: äöü ñ',
      };

      await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send(unicodeData)
        .expect(201);
    });

    it('should validate that timestamps are set correctly on creation', async () => {
      const now = new Date();
      const createdFavorite = {
        ...sampleFavorite,
        createdAt: now,
        updatedAt: now,
      };

      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.favorite.create as jest.Mock).mockResolvedValue(createdFavorite);

      const response = await request(app)
        .post('/api/v1/users/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          entityType: 'FLIGHT',
          entityId: 'test-id',
        })
        .expect(201);

      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });
  });
});
