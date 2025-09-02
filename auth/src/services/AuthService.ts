import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@dreamscape/db';

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
    token: string;
    expiresIn: string;
  };
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly TOKEN_EXPIRY = '7d';

  static async signup(userData: SignupData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email.toLowerCase() }
      });

      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, this.SALT_ROUNDS);

      // Create user
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

      // Generate JWT token
      const token = this.generateToken(user.id, user.email);

      return {
        success: true,
        message: 'Account created successfully',
        data: {
          user,
          token,
          expiresIn: this.TOKEN_EXPIRY
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
      // Find user by email
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

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginData.password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Generate JWT token
      const token = this.generateToken(user.id, user.email);

      // Return user data without password
      const { password, ...userWithoutPassword } = user;

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          token,
          expiresIn: this.TOKEN_EXPIRY
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
      // Remove password from update data if present (use separate method for password updates)
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
      // Get current user
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

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

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

  private static generateToken(userId: string, email: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    return jwt.sign(
      { userId, email },
      jwtSecret,
      { expiresIn: this.TOKEN_EXPIRY }
    );
  }

  static verifyToken(token: string): { userId: string; email: string } | null {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
      return decoded;
    } catch (error) {
      return null;
    }
  }
}
