import { apiClient } from './apiClient';

export const healthProfileApi = {
  getProfile: (): Promise<any> => {
    return apiClient.get('/health-profile');
  },
  
  updateProfile: (data: any): Promise<any> => {
    return apiClient.put('/health-profile', data);
  }
};
