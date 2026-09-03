import { apiClient } from './apiClient';

export const episodeApi = {
  getEpisodes: (): Promise<any> => {
    return apiClient.get('/episodes');
  },
  
  getEpisodeById: (episodeId: string): Promise<any> => {
    return apiClient.get(`/episodes/${episodeId}`);
  },
  
  createEpisode: (data: any): Promise<any> => {
    return apiClient.post('/episodes', data);
  },
  
  updateEpisode: (episodeId: string, data: any): Promise<any> => {
    return apiClient.patch(`/episodes/${episodeId}`, data);
  }
};
