import axios from 'axios';

export interface PatientContext {
  patientId?: string;
  age?: number | string;
  gender?: 'male' | 'female' | 'other';
  primaryLanguage?: 'te' | 'en';
  literacyLevel?: 'basic' | 'standard';
}

export interface PatientExplanationResult {
  diagnosisNamePlain: string;
  diagnosisNameEnglish: string;
  summaryTelugu: string;
  summaryEnglish: string;
  bodyExplanationTelugu: string;
  bodyExplanationEnglish: string;
  actionStepsTelugu: string[];
  actionStepsEnglish: string[];
  warningSignsTelugu: string[];
  warningSignsEnglish: string[];
  questionsForDoctorTelugu: string[];
  questionsForDoctorEnglish: string[];
  spokenTeluguScript: string;
  jargonExplanations: Array<{ term: string; plainMeaning: string; teluguMeaning: string }>;
  audioDataUrl?: string;
  audioBase64?: string;
  audioDurationEstimateSec?: number;
}

export class PatientExplainerAgent {
  private agentApiUrl: string;
  private apiKey: string;

  constructor() {
    // URL pointing to this Vaidyaarc Agent service
    this.agentApiUrl = process.env.VAIDYAARC_AGENT_URL || 'http://localhost:3000/api/v1/agent/explain';
    this.apiKey = process.env.VAIDYAARC_AGENT_API_KEY || 'vaidyaarc-dev-secret-key';
  }

  /**
   * Translates the clinical output of the diagnostic brain model
   * into plain Telugu & English for patient-side consumption.
   */
  async generatePatientExplanation(
    clinicalBrainOutput: string,
    patientContext?: PatientContext,
    options?: { simplicityLevel?: 'standard' | 'very_simple'; includeAudio?: boolean; voiceName?: 'Kore' | 'Puck' }
  ): Promise<PatientExplanationResult> {
    try {
      const response = await axios.post(
        this.agentApiUrl,
        {
          clinicalInput: clinicalBrainOutput,
          patientContext,
          simplicityLevel: options?.simplicityLevel || 'standard',
          includeAudio: options?.includeAudio !== false,
          voiceName: options?.voiceName || 'Kore',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-vaidyaarc-api-key': this.apiKey,
          },
          timeout: 45000,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to generate patient explanation');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('[PatientExplainerAgent] Error converting brain model response:', error.response?.data || error.message);
      throw new Error(`Patient explanation service failed: ${error.message}`);
    }
  }
}

export const patientExplainerAgent = new PatientExplainerAgent();
