import { apiClient } from './apiClient';

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
      formData.append('audio', {
        uri: audioFile.uri,
        name: audioFile.name,
        type: audioFile.type,
      } as any);

      if (languageCode) {
        formData.append('language_code', languageCode);
      }
    }

    return apiClient.post('/stt/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Check the status of the Speech-to-Text service through the backend.
   */
  checkHealth: async (): Promise<any> => {
    return apiClient.get('/stt/health');
  },
};

export default sttApi;
