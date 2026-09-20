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
    const res: any = await apiClient.post('/tts/synthesize', {
      text,
      language,
    });
    // apiClient response interceptor already returns response.data
    // Backend returns: { success: true, data: { success: true, audioBase64: '...', mimeType: 'audio/wav', ... } }
    if (res && res.data && typeof res.data.audioBase64 === 'string') {
      return res as TtsResponse;
    }
    if (res && typeof res.audioBase64 === 'string') {
      return {
        success: true,
        data: res,
      };
    }
    return res;
  },

  /**
   * Health probe for the Text-to-Speech service.
   */
  checkHealth: async (): Promise<any> => {
    const res: any = await apiClient.get('/tts/health');
    return res;
  },
};

export default ttsApi;
