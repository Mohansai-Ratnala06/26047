import axios from 'axios';
import { VisionExtractorResponse } from './VisionExtractorAgent';

export interface BrainModelAnalysisResult {
  clinicalSummary?: string;
  riskLevel?: 'low' | 'moderate' | 'high' | 'urgent';
  redFlags?: string[];
  suggestedNextSteps?: string[];
  carePlanHighlights?: string[];
  rawAnalysis?: any;
}

export interface BrainModelPayload {
  documentId: string;
  documentCode: string;
  patientId: string;
  extracted_data: VisionExtractorResponse['extracted_data'];
  safety_alerts: VisionExtractorResponse['safety_alerts'];
  fhir_bundle?: any;
  patientContext?: any;
}

const BRAIN_SYSTEM_PROMPT = `
You are the Vaidyaarc Clinical Diagnostic Brain Model — an advanced clinical intelligence and telemedicine decision-support engine.
You are given structured clinical extraction data from a patient's medical document (prescription, laboratory test, or discharge summary).

Analyze the clinical data thoroughly:
1. Synthesize diagnoses, medications, dosages, vitals, and diagnostic test results.
2. Check for clinical red flags, abnormal biomarker patterns, and contraindications.
3. Determine a clinical risk level: 'low', 'moderate', 'high', or 'urgent'.
4. Formulate actionable next steps and care plan highlights.

Respond ONLY with a strictly valid JSON object conforming to this schema:
{
  "clinicalSummary": "A concise, high-trust clinical synthesis explaining the patient's condition, prescription rationale, and key observations.",
  "riskLevel": "low" | "moderate" | "high" | "urgent",
  "redFlags": ["List of any red flags, abnormal values, or urgent warnings"],
  "suggestedNextSteps": ["List of actionable clinical recommendations or follow-ups"],
  "carePlanHighlights": ["Key patient instructions, medication precautions, or lifestyle guidance"]
}
`;

export class BrainModelAgent {
  private serviceUrl: string;
  private enabled: boolean;
  private geminiApiKey: string | undefined;

  constructor() {
    this.serviceUrl = process.env.BRAIN_MODEL_URL || 'http://localhost:8200';
    this.enabled = process.env.BRAIN_MODEL_ENABLED === 'true';
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Forwards structured clinical extraction data to the Brain Model.
   * If an external Brain service is configured & running, calls it.
   * Otherwise, executes in-process clinical synthesis via Gemini LLM.
   */
  async analyze(payload: BrainModelPayload): Promise<BrainModelAnalysisResult | null> {
    // 1. Try upstream dedicated Brain microservice if explicitly enabled
    if (this.enabled && this.serviceUrl) {
      try {
        const response = await axios.post(
          `${this.serviceUrl}/analyze`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          }
        );

        if (response.data?.data || response.data) {
          return response.data?.data || response.data;
        }
      } catch (error: any) {
        console.warn(
          '[BrainModelAgent] Upstream Brain microservice unreachable, falling back to in-process Clinical Brain:',
          error.message
        );
      }
    }

    // 2. In-Process Clinical Brain Reasoning Fallback via Gemini
    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey) {
      console.info('[BrainModelAgent] GEMINI_API_KEY not found; skipping in-process Brain synthesis.');
      return null;
    }

    try {
      const userPrompt = `
Structured Clinical Document Data:
${JSON.stringify(payload.extracted_data, null, 2)}

Safety Alerts:
${JSON.stringify(payload.safety_alerts, null, 2)}
`;

      const requestPayload = {
        contents: [
          {
            parts: [
              { text: BRAIN_SYSTEM_PROMPT },
              { text: userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: 'application/json',
        },
      };

      const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
          const res = await axios.post(url, requestPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          });

          if (res.status === 200 && res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawText = res.data.candidates[0].content.parts[0].text;
            const cleaned = rawText
              .trim()
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/```$/i, '')
              .trim();

            const parsed = JSON.parse(cleaned) as BrainModelAnalysisResult;
            return parsed;
          }
        } catch (_) {
          // Continue to next model fallback
        }
      }
    } catch (llmErr: any) {
      console.warn('[BrainModelAgent] In-process brain synthesis warning:', llmErr.message);
    }

    return null;
  }
}

export const brainModelAgent = new BrainModelAgent();

