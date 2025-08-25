import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SignupData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      isVerified: boolean;
      role: string;
      createdAt: Date;
    };
    tokens: TokenPair;
  };
}

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
          message: 'User with this email already exists'
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

    } catch (error) {
      console.error('Signup error:', error);
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
          isActive: true,
        }
      });

      if (!user || !user.isActive) {
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
        return {
          success: false,
          message: 'Invalid token type'
        };
      }
  
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
  
      if (!sessionRecord) {
        return {
          success: false,
          message: 'Invalid or expired refresh token'
        };
      }
  
      await prisma.session.delete({
        where: { id: sessionRecord.id }
      });
  
      const isLongLived = sessionRecord.expiresAt > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const tokens = await this.generateTokenPair(decoded.userId, decoded.email, isLongLived);
  
      return {
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens }
      };
  
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        message: 'Failed to refresh token'
      };
    }
  }

  static async logout(refreshToken: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await prisma.session.deleteMany({
        where: {
          token: refreshToken
        }
      });
  
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
  
  static async logoutAllDevices(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await prisma.session.deleteMany({
        where: {
          userId: userId
        }
      });
  
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

  static async updateProfile(userId: string, updateData: Partial<SignupData>): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      const { password, ...safeUpdateData } = updateData;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...safeUpdateData,
          email: updateData.email ? updateData.email.toLowerCase() : undefined,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          role: true,
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
          message: 'Email already exists'
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
  
    const accessToken = jwt.sign(
      { userId, email, type: 'access' },
      jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  
    const refreshToken = jwt.sign(
      { userId, email, type: 'refresh' },
      jwtRefreshSecret,
      { expiresIn: refreshTokenExpiry }
    );
  
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));
  
    await prisma.session.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt
      }
    });
  
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiresIn: refreshTokenExpiry
    };
  }

  static verifyToken(token: string): { userId: string; email: string } | null {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
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
}