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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
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

export interface NmtTranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export class NmtService {
  private geminiApiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  /**
   * Translates input text from any Indian or foreign language into English
   * using Google Gemini in-process with low temperature and strict instructions.
   */
  async translateToEnglish(text: string, sourceLang?: string): Promise<string> {
    if (!text || !text.trim()) {
      return '';
    }
    const cleanText = text.trim();
    if (sourceLang && (sourceLang.toLowerCase().startsWith('en') || sourceLang.toLowerCase() === 'english')) {
      return cleanText;
    }

    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey) {
      console.warn('[NmtService] GEMINI_API_KEY not configured, passing through original text.');
      return cleanText;
    }

    const systemInstruction =
      "You are a highly capable translation engine. Your task is to accurately translate the user's text into English. " +
      "If the text is already in English, output the exact same text. " +
      "Return ONLY the translated English text. Do NOT include any conversational filler, explanations, markdown, or quotation marks.";

    const models = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    for (const model of models) {
      try {
        const payload = {
          contents: [{ parts: [{ text: cleanText }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.1,
          },
        };

        const response = await axios.post(`${this.baseUrl}/${model}:generateContent?key=${apiKey}`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000,
        });

        if (response.status === 200 && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const translated = response.data.candidates[0].content.parts[0].text.trim();
          return translated.replace(/^["']|["']$/g, '').trim();
        }
      } catch (err: any) {
        console.warn(`[NmtService] translateToEnglish failed with ${model}:`, err.response?.data?.error?.message || err.message);
      }
    }

    return cleanText;
  }

  /**
   * Translates clinical guidance from English into the patient's spoken language (e.g. Telugu, Hindi, Tamil).
   * Maintains polite, empathetic clinical tone suitable for patient healthcare triage.
   */
  async translateFromEnglish(text: string, targetLang: string): Promise<string> {
    if (!text || !text.trim()) {
      return '';
    }
    const cleanText = text.trim();
    if (!targetLang || targetLang.toLowerCase().startsWith('en') || targetLang.toLowerCase() === 'english') {
      return cleanText;
    }

    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey) {
      console.warn('[NmtService] GEMINI_API_KEY not configured, passing through original text.');
      return cleanText;
    }

    const langMap: Record<string, string> = {
      te: 'Telugu',
      'te-in': 'Telugu',
      hi: 'Hindi',
      'hi-in': 'Hindi',
      ta: 'Tamil',
      'ta-in': 'Tamil',
      kn: 'Kannada',
      'kn-in': 'Kannada',
      mr: 'Marathi',
      'mr-in': 'Marathi',
      bn: 'Bengali',
      'bn-in': 'Bengali',
      gu: 'Gujarati',
      'gu-in': 'Gujarati',
      ml: 'Malayalam',
      'ml-in': 'Malayalam',
      pa: 'Punjabi',
      'pa-in': 'Punjabi',
      or: 'Odia',
      'or-in': 'Odia',
    };

    const readableTarget = langMap[targetLang.toLowerCase()] || targetLang;

    const systemInstruction =
      `You are an expert medical translation engine. Your task is to accurately translate clinical guidance and questions from English into ${readableTarget}. ` +
      `Maintain a polite, empathetic, and culturally appropriate tone suited for a doctor-patient conversation. ` +
      `Preserve any essential clinical terms, medication names, or measurements clearly. ` +
      `Return ONLY the translated ${readableTarget} text. Do NOT include any conversational filler, explanations, markdown, or quotation marks.`;

    const models = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    for (const model of models) {
      try {
        const payload = {
          contents: [{ parts: [{ text: cleanText }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.1,
          },
        };

        const response = await axios.post(`${this.baseUrl}/${model}:generateContent?key=${apiKey}`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000,
        });

        if (response.status === 200 && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const translated = response.data.candidates[0].content.parts[0].text.trim();
          return translated.replace(/^["']|["']$/g, '').trim();
        }
      } catch (err: any) {
        console.warn(`[NmtService] translateFromEnglish failed with ${model}:`, err.response?.data?.error?.message || err.message);
      }
    }

    return cleanText;
  }
}

export const nmtService = new NmtService();
export default sttService;


