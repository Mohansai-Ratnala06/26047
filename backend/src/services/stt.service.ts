import config from '../config';

export interface SttTranscriptionResult {
  success: boolean;
  text: string;
  language: string;
  model: string;
}

export interface SttHealthResult {
  success: boolean;
  status: string;
  service: string;
  model: string;
}

export class SttService {
  private get baseUrl(): string {
    return (config.sttApiUrl || 'http://localhost:5001').replace(/\/+$/, '');
  }

  /**
   * Check if the upstream Speech-to-Text API is reachable and healthy.
   */
  async checkHealth(): Promise<SttHealthResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`STT API health check failed with HTTP status ${response.status}`);
      }

      const data = (await response.json()) as SttHealthResult;
      return data;
    } catch (error: any) {
      console.error('[SttService] Health check error:', error.message);
      throw new Error(`Upstream STT service unreachable: ${error.message}`);
    }
  }

  /**
   * Transcribe an audio file buffer by forwarding it to the existing STT API.
   *
   * @param fileBuffer The in-memory buffer of the uploaded audio file
   * @param originalname The filename (e.g. recording.wav, voice.m4a, speech.mp3)
   * @param mimetype The MIME type of the audio file
   * @param languageCode Optional language code (defaults to 'unknown' for automatic detection)
   */
  async transcribe(
    fileBuffer: Buffer,
    originalname: string,
    mimetype: string,
    languageCode?: string
  ): Promise<SttTranscriptionResult> {
    try {
      // Build standard multipart/form-data payload
      const formData = new FormData();
      const audioBlob = new Blob([fileBuffer], { type: mimetype || 'audio/wav' });
      formData.append('audio', audioBlob, originalname || 'recording.wav');

      if (languageCode) {
        formData.append('language_code', languageCode);
      }

      const endpoint = `${this.baseUrl}/api/transcribe`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const json = (await response.json()) as any;

      if (!response.ok || !json.success) {
        const errorDetail = json.error || json.details || `HTTP error ${response.status}`;
        throw new Error(`STT recognition failed: ${errorDetail}`);
      }

      return {
        success: true,
        text: json.text || '',
        language: json.language || 'unknown',
        model: json.model || 'saaras:v3',
      };
    } catch (error: any) {
      console.error('[SttService] Transcription error:', error.message);
      throw error;
    }
  }
}

export const sttService = new SttService();
export default sttService;
