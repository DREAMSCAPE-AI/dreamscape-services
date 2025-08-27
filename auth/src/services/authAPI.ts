import axios, { AxiosResponse } from 'axios';
import { LoginCredentials, SignupData, User } from '../store/authSlice';

declare const window: Window & typeof globalThis;

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper functions for localStorage (with proper checks)
const getStoredToken = (): string | null => {
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    return window.localStorage.getItem('accessToken');
  }
  return null;
};

const setStoredToken = (token: string): void => {
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    window.localStorage.setItem('accessToken', token);
  }
};

const removeStoredToken = (): void => {
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    window.localStorage.removeItem('accessToken');
  }
};

const redirectToLogin = (): void => {
  if (typeof window !== 'undefined' && 'location' in window) {
    window.location.href = '/login';
  }
};

apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await authAPI.refreshToken();
        const newAccessToken = response.data.data.tokens.accessToken;
        
        setStoredToken(newAccessToken);
        
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        removeStoredToken();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: async (signupData: SignupData): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    data: {
      user: User;
      tokens: {
        accessToken: string;
        accessTokenExpiresIn: string;
      };
    };
  }>> => {
    return apiClient.post('/auth/register', signupData);
  },

  login: async (credentials: LoginCredentials): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    data: {
      user: User;
      tokens: {
        accessToken: string;
        accessTokenExpiresIn: string;
      };
    };
  }>> => {
    return apiClient.post('/auth/login', credentials);
  },

  refreshToken: async (): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    data: {
      tokens: {
        accessToken: string;
        accessTokenExpiresIn: string;
      };
    };
  }>> => {
    return apiClient.post('/auth/refresh');
  },

  logout: async (): Promise<AxiosResponse<{
    success: boolean;
    message: string;
  }>> => {
    return apiClient.post('/auth/logout');
  },

  logoutAll: async (): Promise<AxiosResponse<{
    success: boolean;
    message: string;
  }>> => {
    return apiClient.post('/auth/logout-all');
  },

  getUserProfile: async (): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    data: {
      user: User;
    };
  }>> => {
    return apiClient.get('/auth/profile');
  },

  updateProfile: async (profileData: Partial<User>): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    data: {
      user: User;
    };
  }>> => {
    return apiClient.put('/auth/profile', profileData);
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<AxiosResponse<{
    success: boolean;
    message: string;
  }>> => {
    return apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },

  verifyToken: async (): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    data: {
      user: User;
    };
  }>> => {
    return apiClient.post('/auth/verify-token');
  },
};

export const initializeTokens = (): string | null => {
  return getStoredToken();
};

export const clearTokens = (): void => {
  removeStoredToken();
};

export default authAPI;