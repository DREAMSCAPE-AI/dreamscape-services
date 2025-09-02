import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  SignupData, 
  LoginData, 
  UpdateProfileData, 
  TokenPair, 
  AuthResponse, 
  UserSafeProfile 
} from '@types';
import { prisma } from '@dreamscape/db';

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY_SHORT = '7d';
  private static readonly REFRESH_TOKEN_EXPIRY_LONG = '30d';

  static async signup(userData: SignupData): Promise<AuthResponse> {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email.toLowerCase() }
      });
  
      if (existingUser) {
        return {
          success: false,
          message: 'Email already exists'
        };
      }
  
      const hashedPassword = await bcrypt.hash(userData.password, this.SALT_ROUNDS);
  
      const user = await prisma.user.create({
        data: {
          email: userData.email.toLowerCase(),
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });
  
      const tokens = await this.generateTokenPair(user.id, user.email, false);
  
      return {
        success: true,
        message: 'Account created successfully',
        data: {
          user,
          tokens
        }
      };
  
    } catch (error: any) {
      console.error('Signup error:', error);
      
      if (error.code === 'P2002') {
        return {
          success: false,
          message: 'Email already exists'
        };
      }
      
      return {
        success: false,
        message: 'Failed to create account. Please try again.'
      };
    }
  }

  static async login(loginData: LoginData): Promise<AuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: loginData.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          password: true,
          username: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        }
      });
  
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }
  
      const isPasswordValid = await bcrypt.compare(loginData.password, user.password);
  
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }
  
      const tokens = await this.generateTokenPair(user.id, user.email, loginData.rememberMe || false);
  
      const { password, ...userWithoutPassword } = user;
  
      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          tokens
        }
      };
  
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.'
      };
    }
  }

  static async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    message: string;
    data?: { tokens: TokenPair };
  }> {
    try {
      console.log('=== REFRESH TOKEN DEBUG ===');
      console.log('Received token:', refreshToken.substring(0, 20) + '...');
      
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      
      if (!jwtRefreshSecret) {
        throw new Error('JWT secret not configured');
      }
  
      const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as {
        userId: string;
        email: string;
        type: string;
      };
  
      if (decoded.type !== 'refresh') {
        console.log('Invalid token type:', decoded.type);
        return {
          success: false,
          message: 'Invalid token type'
        };
      }
  
      const sessionCount = await prisma.session.count({
        where: { token: refreshToken }
      });
      console.log('Sessions with this token:', sessionCount);
  
      const sessionRecord = await prisma.session.findFirst({
        where: {
          token: refreshToken,
          userId: decoded.userId,
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          user: {
            select: { id: true, email: true }
          }
        }
      });
  
      console.log('Session found:', !!sessionRecord);
      console.log('Session ID:', sessionRecord?.id);
  
      if (!sessionRecord) {
        console.log('No session record found for token');
        return {
          success: false,
          message: 'Invalid or expired refresh token'
        };
      }
  
      console.log('Deleting session:', sessionRecord.id);
      const deleteResult = await prisma.session.delete({
        where: { id: sessionRecord.id }
      });
      console.log('Delete result:', deleteResult);
  
      const remainingSessions = await prisma.session.count({
        where: { token: refreshToken }
      });
      console.log('Remaining sessions with this token after delete:', remainingSessions);
  
      const isLongLived = sessionRecord.expiresAt > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const tokens = await this.generateTokenPair(decoded.userId, decoded.email, isLongLived);
      
      console.log('New tokens generated');
      console.log('=== END REFRESH TOKEN DEBUG ===');
  
      return {
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens }
      };
  
    } catch (error: any) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        message: 'Failed to refresh token'
      };
    }
  }

  static async logout(refreshToken: string, accessToken?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await prisma.session.deleteMany({
        where: {
          token: refreshToken
        }
      });
  
      if (accessToken) {
        const decoded = jwt.decode(accessToken) as { userId: string } | null;
        if (decoded?.userId) {
          await this.addTokenToBlacklist(accessToken, decoded.userId);
        }
      }
  
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Logout failed'
      };
    }
  }
  
  static async logoutAllDevices(userId: string, currentAccessToken?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await prisma.session.deleteMany({
        where: {
          userId: userId
        }
      });
  
      if (currentAccessToken) {
        await this.addTokenToBlacklist(currentAccessToken, userId);
      }
  
      return {
        success: true,
        message: 'Logged out from all devices successfully'
      };
    } catch (error) {
      console.error('Logout all devices error:', error);
      return {
        success: false,
        message: 'Failed to logout from all devices'
      };
    }
  }

  static async getUserProfile(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,

        }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      return {
        success: true,
        message: 'Profile retrieved successfully',
        data: { user }
      };

    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        message: 'Failed to retrieve profile'
      };
    }
  }

  static async updateProfile(userId: string, updateData: UpdateProfileData): Promise<{
    success: boolean;
    message: string;
    data?: { user: UserSafeProfile };
  }> {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email: updateData.email ? updateData.email.toLowerCase() : undefined,
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          username: updateData.username,
          phoneNumber: updateData.phoneNumber,
          dateOfBirth: updateData.dateOfBirth,
          nationality: updateData.nationality,
          userCategory: updateData.userCategory,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          dateOfBirth: true,
          nationality: true,
          userCategory: true,
          isVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        }
      });
  
      return {
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
      };
  
    } catch (error) {
      console.error('Update profile error:', error);
      
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return {
          success: false,
          message: 'Email or username already exists'
        };
      }
  
      return {
        success: false,
        message: 'Failed to update profile'
      };
    }
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          password: true,
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      await this.logoutAllDevices(userId);

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        message: 'Failed to change password'
      };
    }
  }

  private static async generateTokenPair(userId: string, email: string, rememberMe: boolean = false): Promise<TokenPair> {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;
  
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
  
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is not set');
    }
  
    const refreshTokenExpiry = rememberMe ? this.REFRESH_TOKEN_EXPIRY_LONG : this.REFRESH_TOKEN_EXPIRY_SHORT;
  
    const accessTokenJti = crypto.randomBytes(16).toString('hex');
    const refreshTokenJti = crypto.randomBytes(16).toString('hex');
  
    const accessToken = jwt.sign(
      { 
        userId, 
        email, 
        type: 'access',
        jti: accessTokenJti
      },
      jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  
    const refreshToken = jwt.sign(
      { 
        userId, 
        email, 
        type: 'refresh',
        jti: refreshTokenJti
      },
      jwtRefreshSecret,
      { expiresIn: refreshTokenExpiry }
    );
  
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));
  
    try {
      await prisma.session.create({
        data: {
          token: refreshToken,
          userId,
          expiresAt
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.error('Duplicate refresh token generated, retrying...');
        return this.generateTokenPair(userId, email, rememberMe);
      }
      throw error;
    }
  
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiresIn: refreshTokenExpiry
    };
  }

  static async verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }
  
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return null;
      }
  
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string; type: string };
      
      if (decoded.type !== 'access') {
        return null;
      }
  
      return { userId: decoded.userId, email: decoded.email };
    } catch (error) {
      return null;
    }
  }

  static async resetTestData(): Promise<{ success: boolean }> {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    return { success: true };
  }

  private static async addTokenToBlacklist(token: string, userId: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as { exp: number } | null;
      if (!decoded?.exp) return;
  
      const expiresAt = new Date(decoded.exp * 1000);
      
      await prisma.tokenBlacklist.create({
        data: {
          token,
          userId,
          expiresAt
        }
      });
    } catch (error) {
      console.error('Error adding token to blacklist:', error);
    }
  }
  
  private static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistedToken = await prisma.tokenBlacklist.findUnique({
        where: { token }
      });
      
      return !!blacklistedToken;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  }
}