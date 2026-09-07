import * as SecureStore from 'expo-secure-store';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { apiClient, API_BASE_URL } from './apiClient';

export interface SttTranscriptionResult {
  success: boolean;
  text: string;
  language: string;
  model: string;
}

export interface SttResponse {
  success: boolean;
  data: SttTranscriptionResult;
  message?: string;
}

export const sttApi = {
  /**
   * Send audio to the Vaidyaarc backend STT endpoint for transcription.
   *
   * @param audioFile Audio file descriptor with { uri, name, type } or FormData instance
   * @param languageCode Language code (e.g. 'unknown' for auto-detection, 'en-IN', 'te-IN', 'hi-IN')
   */
  transcribeAudio: async (
    audioFile: { uri: string; name: string; type: string } | FormData,
    languageCode: string = 'unknown'
  ): Promise<SttResponse> => {
    let formData: FormData;

    if (audioFile instanceof FormData) {
      formData = audioFile;
    } else {
      formData = new FormData();
      const file = new File(audioFile.uri);

      if (!file.exists) {
        throw new Error(`Audio recording file does not exist at URI: ${audioFile.uri}`);
      }

      formData.append('audio', file as any);

      if (languageCode) {
        formData.append('language_code', languageCode);
      }
    }

    const token = await SecureStore.getItemAsync('auth_token');
    const response = await fetch(`${API_BASE_URL}/stt/transcribe`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json = (await response.json().catch(() => null)) as any;

    if (!response.ok || !json?.success) {
      throw new Error(json?.message || `STT transcription failed (HTTP ${response.status})`);
    }

    return json as SttResponse;
  },

  /**
   * Check the status of the Speech-to-Text service through the backend.
   */
  checkHealth: async (): Promise<any> => {
    return apiClient.get('/stt/health');
  },
};

export default sttApi;
