export interface HealthStatus {
  service: string;
  status: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    details?: any;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'patient' | 'doctor' | 'admin';
}
