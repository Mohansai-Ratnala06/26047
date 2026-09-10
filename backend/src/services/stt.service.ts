import axios from 'axios';
import FormData from 'form-data';

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
  private sarvamApiKey: string;
  private geminiApiKey: string | undefined;

  constructor() {
    this.sarvamApiKey =
      process.env.SARVAM_API_KEY || 'sk_o7traexv_jZJHv9LCBg2DkK6P6Dvu5CKR';
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Health and readiness probe for in-process STT engine.
   */
  async checkHealth(): Promise<SttHealthResult> {
    const hasSarvam = Boolean(this.sarvamApiKey);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY || this.geminiApiKey);

    if (!hasSarvam && !hasGemini) {
      throw new Error(
        'Neither SARVAM_API_KEY nor GEMINI_API_KEY is configured in environment.'
      );
    }

    return {
      success: true,
      status: 'ok',
      service: 'Vaidyaarc In-Process Speech-to-Text',
      model: hasSarvam ? 'saaras:v3' : 'gemini-2.0-flash-audio',
    };
  }

  /**
   * Transcribe an audio file buffer directly in-process via Sarvam AI (saaras:v3)
   * with automatic fallback to Gemini Multimodal Audio.
   *
   * @param fileBuffer The in-memory buffer of the uploaded audio file
   * @param originalname The filename (e.g. recording.m4a, recording.wav, speech.mp3)
   * @param mimetype The MIME type of the audio file
   * @param languageCode Optional language code (defaults to 'unknown' for automatic detection)
   */
  async transcribe(
    fileBuffer: Buffer,
    originalname: string,
    mimetype: string,
    languageCode: string = 'unknown'
  ): Promise<SttTranscriptionResult> {
    let lastError: string | null = null;

    // 1. Primary: Sarvam AI Saaras v3 (Specialized for 22+ Indian Languages)
    const sarvamKey = process.env.SARVAM_API_KEY || this.sarvamApiKey;
    if (sarvamKey) {
      try {
        const form = new FormData();
        form.append('file', fileBuffer, {
          filename: originalname || 'recording.m4a',
          contentType: mimetype || 'audio/m4a',
        });
        form.append('model', 'saaras:v3');
        if (languageCode && languageCode !== 'unknown') {
          form.append('language_code', languageCode);
        }

        const response = await axios.post(
          'https://api.sarvam.ai/speech-to-text',
          form,
          {
            headers: {
              ...form.getHeaders(),
              'api-subscription-key': sarvamKey,
            },
            timeout: 30000,
          }
        );

        if (response.status === 200 && response.data?.transcript) {
          return {
            success: true,
            text: response.data.transcript,
            language: response.data.language_code || languageCode || 'unknown',
            model: 'saaras:v3',
          };
        }
      } catch (err: any) {
        lastError = err.response?.data?.message || err.response?.data?.error || err.message;
        console.warn(
          '[SttService] Sarvam AI transcription note (falling back to Gemini Audio):',
          lastError
        );
      }
    }

    // 2. Fallback: Google Gemini Multimodal Audio Transcription
    const geminiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (geminiKey) {
      try {
        const encodedAudio = fileBuffer.toString('base64');
        let normalizedMime = mimetype || 'audio/m4a';
        if (normalizedMime.includes('octet-stream')) normalizedMime = 'audio/m4a';

        const prompt = `
You are an expert multilingual speech-to-text transcription engine for a clinical healthcare app.
Listen to the provided audio file carefully and transcribe what was spoken accurately word-for-word.
Language hint: ${languageCode || 'unknown'}. The speaker may be speaking in English, Telugu, Hindi, Tamil, Kannada, or Bengali.

Respond ONLY with a valid JSON object matching this schema:
{
  "transcript": "exact transcription of the spoken audio",
  "language_code": "detected BCP-47 language tag (e.g. en-IN, te-IN, hi-IN)"
}
`;

        const payload = {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: normalizedMime,
                    data: encodedAudio,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.0,
            response_mime_type: 'application/json',
          },
        };

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 35000,
          }
        );

        if (response.status === 200 && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = response.data.candidates[0].content.parts[0].text;
          const cleaned = rawText
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();

          const parsed = JSON.parse(cleaned);
          return {
            success: true,
            text: parsed.transcript || '',
            language: parsed.language_code || languageCode || 'unknown',
            model: 'gemini-2.0-flash-audio',
          };
        }
      } catch (geminiErr: any) {
        lastError = geminiErr.response?.data?.error?.message || geminiErr.message;
        console.error('[SttService] Gemini audio fallback failed:', lastError);
      }
    }

    throw new Error(`All STT transcription engines failed. Last error: ${lastError}`);
  }
}

export const sttService = new SttService();
export default sttService;

