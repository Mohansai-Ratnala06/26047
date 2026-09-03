export interface UserProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  abhaId?: string;
  avatarUrl?: string;
  createdAt: string;
  onboardingCompleted?: boolean;
  role?: 'patient' | 'doctor';
  department?: string;
  room?: string;
}

export interface LoginCredentials {
  identifier: string; // Email, Phone or ABHA ID
  password?: string;
  otp?: string;
}

export interface SignUpData {
  name: string;
  phone: string;
  email?: string;
  password?: string;
  abhaId?: string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthResponse {
  success: boolean;
  session?: AuthSession;
  message?: string;
  error?: string;
}

export interface IAuthService {
  checkSession(): Promise<AuthSession | null>;
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  signUp(data: SignUpData): Promise<AuthResponse>;
  logout(): Promise<void>;
}
