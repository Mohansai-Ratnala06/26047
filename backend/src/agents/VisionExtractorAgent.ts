import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export interface ExtractedMedication {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
}

export interface ExtractedVital {
  parameter: string;
  value: string;
  unit?: string | null;
}

export interface ExtractedLabTest {
  test_name: string;
  result: string;
  unit?: string | null;
  reference_range?: string | null;
}

export interface ExtractedClinicalData {
  patient?: {
    name?: string | null;
    age?: string | null;
    gender?: string | null;
    date?: string | null;
  };
  vitals?: ExtractedVital[];
  diagnoses: string[];
  medications: ExtractedMedication[];
  tests: ExtractedLabTest[];
  advice: string[];
}

export interface DrugSafetyAlert {
  severity: 'HIGH' | 'MODERATE' | 'LOW' | string;
  type: string;
  message: string;
}

export interface VisionExtractorResponse {
  success: boolean;
  filename?: string;
  document_type?: string;
  extracted_data: ExtractedClinicalData;
  safety_alerts: DrugSafetyAlert[];
  fhir_bundle?: any;
}

export class VisionExtractorAgent {
  private serviceUrl: string;

  constructor() {
    this.serviceUrl = process.env.VISION_EXTRACTOR_URL || 'http://localhost:8100';
  }

  /**
   * Forwards a local file to the Python Vision Extractor microservice
   * endpoint POST /scan-and-summarize.
   */
  async scanAndSummarize(filePath: string, originalFilename: string, mimeType: string): Promise<VisionExtractorResponse> {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: originalFilename,
      contentType: mimeType,
    });

    const response = await axios.post<VisionExtractorResponse>(
      `${this.serviceUrl}/scan-and-summarize`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 90000, // 90s — Gemini multimodal OCR on dense medical prescriptions
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.filename || 'Vision extractor failed to process document.');
    }

    return response.data;
  }
}

export const visionExtractorAgent = new VisionExtractorAgent();
