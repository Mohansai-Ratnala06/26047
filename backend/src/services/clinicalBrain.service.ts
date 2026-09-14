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
  unrelated_problem_detected?: boolean;
  detected_new_complaint?: string | null;
  confirm_start_new_episode?: boolean;
}

export interface BrainHealthResult {
  status: string;
  service: string;
  version: string;
  phases: string;
}

import geminiNurseBrainService from './geminiNurseBrain.service';

export class ClinicalBrainService {
  private get baseUrl(): string {
    return (config.brainServiceUrl || process.env.BRAIN_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
  }

  private get engineMode(): string {
    // Defaults to 'gemini' as requested for current primary response, but fully switchable to 'brain_service' or 'fallback'
    return (process.env.CLINICAL_ENGINE_MODE || 'gemini').toLowerCase().trim();
  }

  /**
   * Health and readiness probe for the clinical brain engine.
   */
  async checkHealth(): Promise<BrainHealthResult> {
    const mode = this.engineMode;

    if (mode === 'gemini') {
      return {
        status: 'ok',
        service: 'Vaidyaarc Gemini Dual-Stream Nurse Brain',
        version: '3.5-flash-grounded',
        phases: 'Phase 7, 8B, 12',
      };
    }

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
      console.warn(`[ClinicalBrainService] Python Brain health check failed at ${this.baseUrl}: ${error.message}`);
      return {
        status: 'fallback_ready',
        service: 'Vaidyaarc Python Brain (Offline) -> Gemini Fallback Active',
        version: 'hybrid-v1',
        phases: 'Phase 7, 8B, 12',
      };
    }
  }

  /**
   * Process a clinical turn using the configured engine:
   * - 'gemini': Uses the Gemini 3.5 Flash Nurse Brain with grounded statutory Ayurveda and episode memory.
   * - 'brain_service': Routes to the upstream Python microservice (port 8000).
   * - 'fallback': Tries Python microservice first, then immediately falls back to Gemini if offline.
   */
  async processClinicalTurn(input: NormalizedClinicalInputDTO): Promise<TurnResponseDTO> {
    const mode = this.engineMode;

    if (mode === 'gemini') {
      return this.callGeminiBrain(input);
    }

    if (mode === 'fallback') {
      try {
        return await this.callPythonBrain(input);
      } catch (pythonError: any) {
        console.warn('[ClinicalBrainService] Upstream Python Brain offline/failed, falling back to Gemini Nurse Brain:', pythonError.message);
        return this.callGeminiBrain(input);
      }
    }

    // Default: 'brain_service'
    return this.callPythonBrain(input);
  }

  /**
   * Calls the external Python Brain microservice (Preserved untouched for future use).
   */
  async callPythonBrain(input: NormalizedClinicalInputDTO): Promise<TurnResponseDTO> {
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
      console.error('[ClinicalBrainService] Python Brain turn processing error:', error.message);
      throw error;
    }
  }

  /**
   * Calls the in-process Gemini Dual-Stream Nurse Brain service.
   */
  async callGeminiBrain(input: NormalizedClinicalInputDTO): Promise<TurnResponseDTO> {
    return geminiNurseBrainService.processClinicalTurn(input);
  }
}

export const clinicalBrainService = new ClinicalBrainService();
export default clinicalBrainService;

