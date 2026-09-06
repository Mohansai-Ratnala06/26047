import config from '../config';

export interface NormalizedMessageDTO {
  original_text: string;
  original_language?: string;
  english_text?: string | null;
  source?: string;
  confidence?: number | null;
  provenance?: string | null;
}

export interface PatientProfileDTO {
  age?: number | null;
  sex?: string | null;
  medical_conditions?: string[];
  allergies?: string[];
  chronic_medications?: any[];
  surgical_history?: string[];
  family_history?: string[];
}

export interface PatientLocationDTO {
  city?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DocumentDTO {
  document_id: string;
  document_type: string;
  document_date?: string | null;
  extracted_text?: string | null;
  structured_biomarkers?: any[];
  provenance?: string | null;
}

export interface NormalizedClinicalInputDTO {
  patient_id?: string;
  episode_id?: string;
  channel?: string;
  message: NormalizedMessageDTO;
  patient_profile?: PatientProfileDTO;
  patient_location?: PatientLocationDTO | null;
  conversation_context?: Record<string, any> | null;
  previous_encounters?: any[];
  previous_conversations?: any[];
  documents?: DocumentDTO[];
  investigations?: any[];
  state_snapshot?: Record<string, any> | null;
}

export interface TurnResponseDTO {
  session_id: string;
  patient_id: string;
  status: 'in_progress' | 'complete' | 'emergency' | string;
  conversation_message?: string | null;
  information_complete: boolean;
  missing_information: string[];
  immediate_attention_required: boolean;
  red_flag_status: string;
  red_flags: string[];
  updated_state: Record<string, any>;
  clinical_output?: Record<string, any> | null;
}

export interface BrainHealthResult {
  status: string;
  service: string;
  version: string;
  phases: string;
}

export class ClinicalBrainService {
  private get baseUrl(): string {
    return (config.brainServiceUrl || process.env.BRAIN_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
  }

  /**
   * Health and readiness probe for the upstream Python Clinical Brain.
   */
  async checkHealth(): Promise<BrainHealthResult> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Brain health check failed with HTTP status ${response.status}`);
      }

      const data = (await response.json()) as BrainHealthResult;
      return data;
    } catch (error: any) {
      console.error('[ClinicalBrainService] Health check error:', error.message);
      throw new Error(`Upstream Clinical Brain unreachable at ${this.baseUrl}: ${error.message}`);
    }
  }

  /**
   * Process a single clinical conversational/intake turn with the Python Brain.
   *
   * @param input NormalizedClinicalInputDTO payload
   * @returns TurnResponseDTO containing updated state and clinical output
   */
  async processClinicalTurn(input: NormalizedClinicalInputDTO): Promise<TurnResponseDTO> {
    try {
      const endpoint = `${this.baseUrl}/v1/clinical/turn`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Clinical Brain API error [HTTP ${response.status}]: ${errorText}`);
      }

      const data = (await response.json()) as TurnResponseDTO;
      return data;
    } catch (error: any) {
      console.error('[ClinicalBrainService] Turn processing error:', error.message);
      throw error;
    }
  }
}

export const clinicalBrainService = new ClinicalBrainService();
export default clinicalBrainService;

