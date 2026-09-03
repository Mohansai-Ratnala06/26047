import { apiClient } from './apiClient';
import { LoginCredentials, SignUpData } from '../services/auth/auth.types';

export const authApi = {
  login: (credentials: LoginCredentials): Promise<any> => {
    return apiClient.post('/auth/login', credentials);
  },
  
  register: (data: SignUpData): Promise<any> => {
    return apiClient.post('/auth/register', data);
  },
  
  getMe: (): Promise<any> => {
    return apiClient.get('/auth/me');
  }
};
