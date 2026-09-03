import { apiClient } from './apiClient';

export const patientApi = {
  createMe: (data: any): Promise<any> => {
    return apiClient.post('/patients', data);
  },
  
  getMe: (): Promise<any> => {
    return apiClient.get('/patients/me');
  },
  
  updateMe: (data: any): Promise<any> => {
    return apiClient.patch('/patients/me', data);
  }
};
