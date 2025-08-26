export enum Role {
    USER = 'USER',
    ADMIN = 'ADMIN',
    MODERATOR = 'MODERATOR'
}

export enum UserCategory {
    LEISURE = 'LEISURE',
    BUSINESS = 'BUSINESS'
}

export interface User {
    id: string;
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: Date | null;
    nationality?: string | null;
    userCategory?: UserCategory | null;
    isVerified: boolean;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserSafeProfile {
    id: string;
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
    dateOfBirth?: Date | null;
    nationality?: string | null;
    userCategory?: UserCategory | null;
    isVerified: boolean;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}

export interface SignupData {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    nationality?: string;
    userCategory?: UserCategory;
}

export interface LoginData {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface UpdateProfileData {
    email?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    nationality?: string;
    userCategory?: UserCategory;
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
      user: UserSafeProfile;
      tokens: TokenPair;
    };
}