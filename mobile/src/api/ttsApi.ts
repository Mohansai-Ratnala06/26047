import { apiClient } from './apiClient';

export interface TtsSynthesisResult {
  success: boolean;
  audioBase64: string;
  mimeType: string;
  languageCode: string;
  model: string;
}

export interface TtsResponse {
  success: boolean;
  data: TtsSynthesisResult;
  message?: string;
}

export const ttsApi = {
  /**
   * Synthesize multilingual speech audio from text using VaidyaArc's in-process TTS service.
   *
   * @param text The text string to synthesize into speech
   * @param language The target language code (e.g. 'te-IN', 'hi-IN', 'en-IN')
   */
  synthesizeSpeech: async (text: string, language?: string): Promise<TtsResponse> => {
    const res = await apiClient.post<TtsResponse>('/tts/synthesize', {
      text,
      language,
    });
    return res.data;
  },

  /**
   * Health probe for the Text-to-Speech service.
   */
  checkHealth: async (): Promise<any> => {
    const res = await apiClient.get('/tts/health');
    return res.data;
  },
};

export default ttsApi;
