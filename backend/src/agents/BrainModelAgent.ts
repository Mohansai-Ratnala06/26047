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

export class BrainModelAgent {
  private serviceUrl: string;
  private enabled: boolean;

  constructor() {
    this.serviceUrl = process.env.BRAIN_MODEL_URL || 'http://localhost:8200';
    this.enabled = process.env.BRAIN_MODEL_ENABLED === 'true';
  }

  /**
   * Forwards structured clinical extraction data to the Brain Model (LLaMA / Qwen).
   * Runs fire-and-forget or awaited depending on caller requirements.
   */
  async analyze(payload: BrainModelPayload): Promise<BrainModelAnalysisResult | null> {
    if (!this.enabled) {
      console.info('[BrainModelAgent] Brain Model is currently disabled (BRAIN_MODEL_ENABLED=false). Skipping analysis.');
      return null;
    }

    try {
      const response = await axios.post(
        `${this.serviceUrl}/analyze`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('[BrainModelAgent] Brain model analysis failed (non-fatal):', error.response?.data || error.message);
      return null;
    }
  }
}

export const brainModelAgent = new BrainModelAgent();
