import { apiClient } from './apiClient';

export const consentApi = {
  getConsents: (): Promise<any> => {
    return apiClient.get('/consents');
  },
  
  createConsent: (data: any): Promise<any> => {
    return apiClient.post('/consents', data);
  },
  
  updateConsent: (consentId: string, data: any): Promise<any> => {
    return apiClient.patch(`/consents/${consentId}`, data);
  }
};
