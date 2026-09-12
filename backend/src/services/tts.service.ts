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
  private sarvamApiKey: string;

  constructor() {
    this.sarvamApiKey =
      process.env.SARVAM_API_KEY || 'sk_o7traexv_jZJHv9LCBg2DkK6P6Dvu5CKR';
  }

  /**
   * Normalize incoming language codes (e.g. 'te', 'telugu', 'te-IN')
   * into Sarvam-compliant BCP-47 language codes.
   */
  public normalizeLanguageCode(lang?: string | null): string {
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

    const languageCode = this.normalizeLanguageCode(rawLanguage);
    const model = 'bulbul:v3';

    try {
      const endpoint = 'https://api.sarvam.ai/text-to-speech';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'api-subscription-key': this.sarvamApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          language_code: languageCode,
          model,
        }),
      });

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
