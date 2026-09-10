import { apiClient, API_BASE_URL } from './apiClient';
import * as SecureStore from 'expo-secure-store';
import { File, UploadType } from 'expo-file-system';
import { fetch } from 'expo/fetch';

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
    const targetUrl = `${API_BASE_URL}/documents/upload`;

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Method 1: Native Expo File.upload (streams file directly via OS layer, 0 memory overhead)
    try {
      const file = new File(params.uri);
      if (typeof file.upload === 'function') {
        const parameters: Record<string, string> = {};
        if (params.documentType) parameters.documentType = params.documentType;
        if (params.hospital) parameters.hospital = params.hospital;
        if (params.doctor) parameters.doctor = params.doctor;
        if (params.episodeId) parameters.episodeId = params.episodeId;

        const result = await file.upload(targetUrl, {
          httpMethod: 'POST',
          uploadType: UploadType.MULTIPART,
          fieldName: 'file',
          mimeType: params.type || 'image/jpeg',
          parameters,
          headers,
        });

        const json = JSON.parse(result.body || '{}');
        if (result.status >= 200 && result.status < 300 && json?.success) {
          return json;
        }
        if (result.status >= 400) {
          throw new Error(json?.message || `Upload failed with status ${result.status}`);
        }
      }
    } catch (uploadErr: any) {
      // Re-throw genuine server error responses
      if (uploadErr.message && !uploadErr.message.includes('Unsupported FormDataPart') && !uploadErr.message.includes('not a function')) {
        throw uploadErr;
      }
    }

    // Method 2: Expo File with Winter fetch FormData (supports Expo File with .bytes())
    const file = new File(params.uri);
    const formData = new FormData();
    formData.append('file', file as any);

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

