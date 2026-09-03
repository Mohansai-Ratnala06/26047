import { apiClient } from './apiClient';
import { LoginCredentials } from '../services/auth/auth.types';

export const doctorApi = {
  login: (credentials: LoginCredentials): Promise<any> => apiClient.post('/doctor/login', credentials),
};
