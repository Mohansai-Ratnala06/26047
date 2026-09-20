export interface TtsSynthesisResult {
  success: boolean;
  audioBase64: string;
  mimeType: string;
  languageCode: string;
  model: string;
}

export interface TtsHealthResult {
  success: boolean;
  status: string;
  service: string;
  model: string;
  hasKey: boolean;
}

export class TtsService {
  private get sarvamApiKey(): string {
    return (process.env.SARVAM_API_KEY || '').trim();
  }

  /**
   * Normalize incoming language codes (e.g. 'te', 'telugu', 'te-IN')
   * into Sarvam-compliant BCP-47 language codes.
   * Also auto-detects Indic Unicode script directly from text to prevent mismatch errors.
   */
  public normalizeLanguageCode(lang?: string | null, text?: string | null): string {
    if (text) {
      if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
      if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Hindi
      if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
      if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'; // Kannada
      if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'; // Malayalam
      if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN'; // Bengali
      if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN'; // Gujarati
      if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN'; // Punjabi
      if (/[\u0B00-\u0B7F]/.test(text)) return 'od-IN'; // Odia
    }

    if (!lang) return 'en-IN';
    const lower = lang.toLowerCase().trim();

    if (lower.startsWith('te') || lower.includes('telugu')) return 'te-IN';
    if (lower.startsWith('hi') || lower.includes('hindi')) return 'hi-IN';
    if (lower.startsWith('ta') || lower.includes('tamil')) return 'ta-IN';
    if (lower.startsWith('kn') || lower.includes('kannada')) return 'kn-IN';
    if (lower.startsWith('ml') || lower.includes('malayalam')) return 'ml-IN';
    if (lower.startsWith('mr') || lower.includes('marathi')) return 'mr-IN';
    if (lower.startsWith('bn') || lower.includes('bengali')) return 'bn-IN';
    if (lower.startsWith('gu') || lower.includes('gujarati')) return 'gu-IN';
    if (lower.startsWith('pa') || lower.includes('punjabi')) return 'pa-IN';
    if (lower.startsWith('od') || lower.includes('odia') || lower.includes('oriya')) return 'od-IN';
    return 'en-IN';
  }

  /**
   * Health and readiness probe for the TTS service.
   */
  async checkHealth(): Promise<TtsHealthResult> {
    const hasKey = Boolean(this.sarvamApiKey && this.sarvamApiKey.trim().length > 0);
    return {
      success: hasKey,
      status: hasKey ? 'ok' : 'missing_api_key',
      service: 'VaidyaArc In-Process Text-to-Speech (TTS)',
      model: 'bulbul:v3',
      hasKey,
    };
  }

  /**
   * Synthesize natural human speech from text using Sarvam AI Bulbul v3.
   *
   * @param text The text to speak (in patient's regional language or English)
   * @param rawLanguage The requested language (e.g. 'te', 'te-IN', 'hi', 'en')
   * @returns TtsSynthesisResult with Base64 WAV audio
   */
  async synthesize(text: string, rawLanguage?: string | null): Promise<TtsSynthesisResult> {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS text cannot be empty.');
    }

    const languageCode = this.normalizeLanguageCode(rawLanguage, cleanText);
    const model = 'bulbul:v3';

    const apiKey = this.sarvamApiKey;
    if (!apiKey) {
      throw new Error('SARVAM_API_KEY is not configured in environment (.env).');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const endpoint = 'https://api.sarvam.ai/text-to-speech';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          language_code: languageCode,
          model,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sarvam TTS API error [HTTP ${response.status}]: ${errorText}`);
      }

      const data = (await response.json()) as { request_id?: string; audios?: string[] };

      if (!data.audios || data.audios.length === 0 || !data.audios[0]) {
        throw new Error('Sarvam TTS returned empty audio payload.');
      }

      return {
        success: true,
        audioBase64: data.audios[0],
        mimeType: 'audio/wav',
        languageCode,
        model,
      };
    } catch (error: any) {
      console.error('[TtsService] Synthesis error:', error?.message || error);
      throw error;
    }
  }
}

export const ttsService = new TtsService();
export default ttsService;
