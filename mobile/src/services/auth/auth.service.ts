import { IAuthService, AuthSession, LoginCredentials, SignUpData, AuthResponse } from './auth.types';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../../api/authApi';

const TOKEN_KEY = 'auth_token';

class RealAuthService implements IAuthService {
  async checkSession(): Promise<AuthSession | null> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return null;

      // Try to load cached user first (needed for doctor session restore)
      const cachedUserStr = await SecureStore.getItemAsync('auth_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser.role === 'doctor') {
          return {
            user: cachedUser,
            token,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          };
        }
      }

      // Existing patient flow
      const response = await authApi.getMe();
      if (response?.success && response?.data) {
        const user = {
          ...response.data,
          onboardingCompleted: response.data.onboardingCompleted ?? true,
        };
        await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
        return {
          user,
          token,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        };
      }
      return null;
    } catch (error) {
      console.log('Session check failed', error);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync('auth_user');
      return null;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // 1. Try patient login
      const patientResponse = await authApi.login(credentials);
      if (patientResponse?.success && patientResponse?.data?.token) {
        await SecureStore.setItemAsync(TOKEN_KEY, patientResponse.data.token);
        const user = { ...patientResponse.data.user, onboardingCompleted: true, role: 'patient' as const };
        await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
        return {
          success: true,
          session: {
            user,
            token: patientResponse.data.token,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          },
        };
      }
      
      // Fall through to error below if patientLogin didn't throw but failed
      return { success: false, error: patientResponse?.message || 'Login failed' };
    } catch (patientError: any) {
      // 2. Patient failed (e.g. invalid credentials) -> Try doctor login fallback
      try {
        const { doctorApi } = require('../../api/doctorApi'); // Dynamic import to avoid cycles/issues
        const doctorResponse = await doctorApi.login(credentials);
        
        if (doctorResponse?.success && doctorResponse?.data?.token) {
          await SecureStore.setItemAsync(TOKEN_KEY, doctorResponse.data.token);
          const user = { ...doctorResponse.data.doctor, onboardingCompleted: true, role: 'doctor' as const };
          await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
          
          return {
            success: true,
            session: {
              user,
              token: doctorResponse.data.token,
              expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            },
          };
        }
      } catch (doctorError: any) {
        // Both failed. Return the original error for context, or a generic one.
        return { success: false, error: doctorError?.message || patientError?.message || 'Invalid credentials' };
      }
      
      return { success: false, error: patientError?.message || 'Network error. Check your connection.' };
    }
  }

  async signUp(data: SignUpData): Promise<AuthResponse> {
    try {
      const payload = { ...data, password: data.password || 'pass1234' };
      const response = await authApi.register(payload);
      if (response?.success && response?.data?.token) {
        await SecureStore.setItemAsync(TOKEN_KEY, response.data.token);
        const user = { ...response.data.user, onboardingCompleted: false, role: 'patient' as const };
        await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
        return {
          success: true,
          session: {
            user,
            token: response.data.token,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          },
        };
      }
      return { success: false, error: response?.message || 'Registration failed' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Network error. Check your connection.' };
    }
  }

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync('auth_user');
  }
}

export const authService: IAuthService = new RealAuthService();
export default authService;
