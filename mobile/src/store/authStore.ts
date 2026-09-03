import { create } from 'zustand';
import { UserProfile, LoginCredentials, SignUpData, authService } from '../services/auth';

interface AuthState {
  isCheckingSession: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  error: string | null;
  loading: boolean;
  
  // Actions
  startupCheck: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  signUp: (data: SignUpData) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  completeOnboarding: () => void;
  // Development shortcut to enter home directly
  demoBypass: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isCheckingSession: true,
  isAuthenticated: false,
  user: null,
  token: null,
  error: null,
  loading: false,

  startupCheck: async () => {
    try {
      set({ isCheckingSession: true });
      const session = await authService.checkSession();
      if (session) {
        set({
          isAuthenticated: true,
          user: session.user,
          token: session.token,
          isCheckingSession: false,
        });
      } else {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          isCheckingSession: false,
        });
      }
    } catch (err: any) {
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        isCheckingSession: false,
      });
    }
  },

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const res = await authService.login(credentials);
      if (res.success && res.session) {
        set({
          isAuthenticated: true,
          user: res.session.user,
          token: res.session.token,
          loading: false,
          error: null,
        });
        return true;
      } else {
        set({ loading: false, error: res.error || 'Login failed' });
        return false;
      }
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Network error' });
      return false;
    }
  },

  signUp: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await authService.signUp(data);
      if (res.success && res.session) {
        set({
          isAuthenticated: true,
          user: res.session.user,
          token: res.session.token,
          loading: false,
          error: null,
        });
        return true;
      } else {
        set({ loading: false, error: res.error || 'Sign up failed' });
        return false;
      }
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Network error' });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await authService.logout();
    } finally {
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),

  completeOnboarding: () => set((state) => ({
    user: state.user ? { ...state.user, onboardingCompleted: true } : null
  })),

  demoBypass: () => {
    set({
      isAuthenticated: true,
      user: {
        id: 'usr_demo_882',
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        phone: '+91 98765 43210',
        abhaId: '91-4829-1029-3819',
        createdAt: new Date().toISOString(),
        onboardingCompleted: true,
      },
      token: 'mock-jwt-bypass',
      isCheckingSession: false,
    });
  },
}));
