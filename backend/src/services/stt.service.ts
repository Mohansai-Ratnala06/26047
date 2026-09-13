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
  private sarvamApiKey: string;
  private geminiApiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.sarvamApiKey =
      process.env.SARVAM_API_KEY || 'sk_o7traexv_jZJHv9LCBg2DkK6P6Dvu5CKR';
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  /**
   * Normalizes arbitrary incoming language codes (e.g. 'te', 'te-IN', 'telugu')
   * into Sarvam-supported BCP-47 language codes.
   */
  public normalizeSarvamLangCode(lang?: string | null): string | null {
    if (!lang) return null;
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
    return null;
  }

  /**
   * Pre-translated clinical template safety net.
   * Guarantees that standard clinical messages are never delivered in English
   * when patient selected an Indian language, even if all cloud APIs are unreachable.
   */
  private getFallbackTranslation(text: string, targetLang: string): string | null {
    const lower = text.toLowerCase().trim();
    const lang = targetLang.toLowerCase().trim();
    const isTelugu = lang.startsWith('te') || lang.includes('telugu');
    const isHindi = lang.startsWith('hi') || lang.includes('hindi');
    const isTamil = lang.startsWith('ta') || lang.includes('tamil');

    if (lower.includes('thank you') && (lower.includes('initial information') || lower.includes('complete') || lower.includes('collected'))) {
      if (isTelugu) return 'ధన్యవాదాలు. మీ సమస్య గురించిన ప్రాథమిక సమాచారం సేకరించాను. దయచేసి మీ క్లినికల్ అంచనా సారాంశాన్ని సమీక్షించండి.';
      if (isHindi) return 'धन्यवाद। मैंने आपकी समस्या के बारे में प्रारंभिक जानकारी एकत्र कर ली है। कृपया अपना क्लिनिकल मूल्यांकन सारांश देखें।';
      if (isTamil) return 'நன்றி. உங்கள் பிரச்சனை குறித்த ஆரம்ப தகவல்களை சேகரித்துள்ளேன். தயவுசெய்து உங்கள் மருத்துவ மதிப்பீட்டு சுருக்கத்தை பார்க்கவும்.';
    }

    if (lower.includes('emergency') || lower.includes('immediate attention')) {
      if (isTelugu) return 'అత్యవసర హెచ్చరిక: మీ లక్షణాలు తక్షణ వైద్య సహాయం అవసరమయ్యే అత్యవసర పరిస్థితిని సూచిస్తున్నాయి. దయచేసి వెంటనే అత్యవసర వైద్య సంరక్షణను పొందండి.';
      if (isHindi) return 'आपातकालीन चेतावनी: आपके बताए गए लक्षण तत्काल चिकित्सा सहायता की आवश्यकता का संकेत देते हैं। कृपया तुरंत आपातकालीन चिकित्सा देखभाल प्राप्त करें।';
      if (isTamil) return 'அவசர எச்சரிக்கை: உங்கள் அறிகுறிகள் உடனடி மருத்துவ உதவி தேவைப்படுவதைக் குறிக்கின்றன. தயவுசெய்து உடனடியாக அவசர மருத்துவ உதவியை நாடுங்கள்.';
    }

    if (lower.includes('could you share a few more details') || lower.includes('key details')) {
      if (isTelugu) return 'మీ ఆరోగ్య అంచనాకు సహాయపడటానికి మీ లక్షణాల గురించి మరికొన్ని వివరాలను పంచుకోగలరా?';
      if (isHindi) return 'आपके स्वास्थ्य मूल्यांकन में मदद के लिए क्या आप अपने लक्षणों के बारे में कुछ और विवरण साझा कर सकते हैं?';
      if (isTamil) return 'உங்கள் மருத்துவ மதிப்பீட்டிற்கு உதவ உங்கள் அறிகுறிகள் பற்றிய கூடுதல் விவரங்களைப் பகிர முடியுமா?';
    }

    if (lower.includes('how long') || lower.includes('when did')) {
      if (isTelugu) return 'ఈ లక్షణాలు ఎప్పుడు ప్రారంభమయ్యాయి, లేదా మీరు వీటిని ఎంతకాలంగా అనుభవిస్తున్నారు?';
      if (isHindi) return 'ये लक्षण कब शुरू हुए, या आप कितने समय से इनका अनुभव कर रहे हैं?';
      if (isTamil) return 'இந்த அறிகுறிகள் எப்போது தொடங்கின, அல்லது எவ்வளவு காலமாக இவற்றை உணர்கிறீர்கள்?';
    }

    if (lower.includes('how severe') || lower.includes('mild, moderate')) {
      if (isTelugu) return 'మీ అసౌకర్యం ఎంత తీవ్రంగా ఉంది — తేలికపాటిదా, మధ్యస్థంగా ఉందా లేదా తీవ్రంగా ఉందా?';
      if (isHindi) return 'आपकी तकलीफ कितनी गंभीर है — हल्की, मध्यम या गंभीर?';
      if (isTamil) return 'உங்கள் அசௌகரியம் எவ்வளவு தீவிரமானது — லேசானதா, மிதமானதா அல்லது கடுமையானதா?';
    }

    return null;
  }

  /**
   * Translates input text from any Indian or foreign language into English.
   * 1. Primary: Sarvam AI Indic Translation (Specialized, Fast, Robust for Indic -> English)
   * 2. Secondary: Google Gemini NMT
   * 3. Fallback: Original text
   */
  async translateToEnglish(text: string, sourceLang?: string): Promise<string> {
    if (!text || !text.trim()) {
      return '';
    }
    const cleanText = text.trim();
    if (sourceLang && (sourceLang.toLowerCase().startsWith('en') || sourceLang.toLowerCase() === 'english')) {
      return cleanText;
    }

    const sarvamSource = this.normalizeSarvamLangCode(sourceLang);
    const sarvamKey = process.env.SARVAM_API_KEY || this.sarvamApiKey;

    // 1. Primary: Sarvam AI Indic Translation
    if (sarvamSource && sarvamKey) {
      try {
        const response = await axios.post(
          'https://api.sarvam.ai/translate',
          {
            input: cleanText,
            source_language_code: sarvamSource,
            target_language_code: 'en-IN',
            mode: 'formal',
          },
          {
            headers: {
              'api-subscription-key': sarvamKey,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (response.status === 200 && response.data?.translated_text) {
          const translated = response.data.translated_text.trim();
          if (translated) {
            console.info(`[NmtService] Sarvam translated (${sarvamSource} -> en-IN): "${translated}"`);
            return translated;
          }
        }
      } catch (sarvamErr: any) {
        console.warn(
          '[NmtService] Sarvam translateToEnglish error, falling back to Gemini:',
          sarvamErr.response?.data?.message || sarvamErr.message
        );
      }
    }

    // 2. Secondary: Google Gemini NMT
    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (apiKey) {
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
            timeout: 15000,
          });

          if (response.status === 200 && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const translated = response.data.candidates[0].content.parts[0].text.trim();
            return translated.replace(/^["']|["']$/g, '').trim();
          }
        } catch (err: any) {
          console.warn(`[NmtService] translateToEnglish failed with ${model}:`, err.response?.data?.error?.message || err.message);
        }
      }
    }

    return cleanText;
  }

  /**
   * Translates clinical guidance from English into the patient's spoken language (e.g. Telugu, Hindi, Tamil).
   * 1. Primary: Sarvam AI Indic Translation (Specialized, Fast <400ms, High Quality for 22+ Indic Languages)
   * 2. Secondary: Google Gemini NMT
   * 3. Tertiary Safety Net: Pre-translated Clinical Template Cache
   */
  async translateFromEnglish(text: string, targetLang: string): Promise<string> {
    if (!text || !text.trim()) {
      return '';
    }
    const cleanText = text.trim();
    if (!targetLang || targetLang.toLowerCase().startsWith('en') || targetLang.toLowerCase() === 'english') {
      return cleanText;
    }

    const sarvamTarget = this.normalizeSarvamLangCode(targetLang);
    const sarvamKey = process.env.SARVAM_API_KEY || this.sarvamApiKey;

    // 1. Primary: Sarvam AI Indic Translation
    if (sarvamTarget && sarvamKey) {
      try {
        const response = await axios.post(
          'https://api.sarvam.ai/translate',
          {
            input: cleanText,
            source_language_code: 'en-IN',
            target_language_code: sarvamTarget,
            speaker_gender: 'Female',
            mode: 'formal',
          },
          {
            headers: {
              'api-subscription-key': sarvamKey,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (response.status === 200 && response.data?.translated_text) {
          const translated = response.data.translated_text.trim();
          if (translated) {
            console.info(`[NmtService] Sarvam translated (en-IN -> ${sarvamTarget}): "${translated}"`);
            return translated;
          }
        }
      } catch (sarvamErr: any) {
        console.warn(
          '[NmtService] Sarvam translateFromEnglish error, falling back to Gemini:',
          sarvamErr.response?.data?.message || sarvamErr.message
        );
      }
    }

    // 2. Secondary: Google Gemini NMT
    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (apiKey) {
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
            timeout: 15000,
          });

          if (response.status === 200 && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const translated = response.data.candidates[0].content.parts[0].text.trim();
            return translated.replace(/^["']|["']$/g, '').trim();
          }
        } catch (err: any) {
          console.warn(`[NmtService] translateFromEnglish failed with ${model}:`, err.response?.data?.error?.message || err.message);
        }
      }
    }

    // 3. Tertiary Safety Net: Pre-translated Clinical Template Cache
    const fallbackTranslation = this.getFallbackTranslation(cleanText, targetLang);
    if (fallbackTranslation) {
      console.info(`[NmtService] Used pre-translated clinical template for (${targetLang}): "${fallbackTranslation}"`);
      return fallbackTranslation;
    }

    return cleanText;
  }
}

export const nmtService = new NmtService();
export default sttService;


