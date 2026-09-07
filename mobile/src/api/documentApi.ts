import { apiClient } from './apiClient';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface UploadDocumentParams {
  uri: string;
  name: string;
  type: string;
  documentType?: string;
  hospital?: string;
  doctor?: string;
  episodeId?: string;
}

export const documentApi = {
  getDocuments: (): Promise<any> => {
    return apiClient.get('/documents');
  },

  uploadDocument: async (params: UploadDocumentParams): Promise<any> => {
    const token = await SecureStore.getItemAsync('auth_token');
    const formData = new FormData();

    const fileUri = Platform.OS === 'android' ? params.uri : params.uri.replace('file://', '');

    formData.append('file', {
      uri: fileUri,
      name: params.name || `doc_${Date.now()}.jpg`,
      type: params.type || 'image/jpeg',
    } as any);

    if (params.documentType) {
      formData.append('documentType', params.documentType);
    }
    if (params.hospital) {
      formData.append('hospital', params.hospital);
    }
    if (params.doctor) {
      formData.append('doctor', params.doctor);
    }
    if (params.episodeId) {
      formData.append('episodeId', params.episodeId);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Determine target URL from apiClient base URL
    const targetUrl = `${apiClient.defaults.baseURL || 'http://172.30.101.87:5000/api/v1'}/documents/upload`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      throw new Error(errorJson?.message || `Upload failed with status ${response.status}`);
    }

    return response.json();
  },
};
