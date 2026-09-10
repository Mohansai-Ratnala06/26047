import axios from 'axios';
import fs from 'fs';
import crypto from 'crypto';

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

const EXTRACTION_PROMPT = `
You are an expert clinical document analyzer. Analyze the provided clinical document (handwritten prescription, lab report, or diagnostic summary) and extract all clinical details into a strictly valid JSON object.

Follow these strict output rules:
1. Return ONLY the raw JSON object. Do not include markdown code block syntax (like \`\`\`json), commentary, or extra text.
2. Use the exact keys provided below. If a value is missing or not applicable, use null or empty lists [].

Required JSON Schema:
{
  "patient": {
    "name": string or null,
    "age": string or null,
    "gender": string or null,
    "date": string or null
  },
  "vitals": [
    {
      "parameter": string,
      "value": string,
      "unit": string or null
    }
  ],
  "diagnoses": [string],
  "medications": [
    {
      "name": string,
      "dosage": string or null,
      "frequency": string or null,
      "duration": string or null
    }
  ],
  "tests": [
    {
      "test_name": string,
      "result": string,
      "unit": string or null,
      "reference_range": string or null
    }
  ],
  "advice": [string]
}
`;

export function checkDrugSafety(medications: ExtractedMedication[] = []): DrugSafetyAlert[] {
  const alerts: DrugSafetyAlert[] = [];
  const medNames = medications.map((m) => (m.name || '').toLowerCase()).filter(Boolean);

  const nsaids = ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'ketorolac', 'piroxicam', 'meloxicam', 'indomethacin'];
  const detectedNsaids = medNames.filter((m) => nsaids.some((n) => m.includes(n)));
  if (detectedNsaids.length > 1) {
    alerts.push({
      severity: 'HIGH',
      type: 'DRUG_DUPLICATION',
      message: `Multiple concurrent NSAIDs detected: ${detectedNsaids.join(', ')}. High risk of gastric ulceration and renal toxicity.`,
    });
  }

  // Duplicate paracetamol / acetaminophen check
  const paracetamolMatches = medNames.filter((m) => m.includes('paracetamol') || m.includes('acetaminophen') || m.includes('dolo') || m.includes('calpol'));
  if (paracetamolMatches.length > 1) {
    alerts.push({
      severity: 'HIGH',
      type: 'DRUG_DUPLICATION',
      message: `Multiple Paracetamol/Acetaminophen formulations detected: ${paracetamolMatches.join(', ')}. Risk of accidental acetaminophen overdose / hepatotoxicity.`,
    });
  }

  return alerts;
}

export function buildFhirBundle(clinicalData: ExtractedClinicalData): any {
  const bundleId = crypto.randomUUID();
  const compositionId = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const entries: any[] = [];
  const medicationReferences: any[] = [];
  const vitalReferences: any[] = [];
  const testReferences: any[] = [];

  // 1. Patient Resource
  const patientInfo = clinicalData.patient || {};
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    name: [{ text: patientInfo.name || 'Unknown' }],
    gender: (patientInfo.gender || 'unknown').toLowerCase(),
  };
  entries.push({
    fullUrl: `urn:uuid:${patientId}`,
    resource: patientResource,
  });

  // 2. MedicationRequest Resources
  for (const med of clinicalData.medications || []) {
    const medId = crypto.randomUUID();
    entries.push({
      fullUrl: `urn:uuid:${medId}`,
      resource: {
        resourceType: 'MedicationRequest',
        id: medId,
        status: 'active',
        intent: 'order',
        subject: { reference: `urn:uuid:${patientId}` },
        medicationCodeableConcept: { text: med.name },
        dosageInstruction: [
          {
            text: `Dosage: ${med.dosage || 'N/A'}, Frequency: ${med.frequency || 'N/A'}, Duration: ${med.duration || 'N/A'}`,
          },
        ],
      },
    });
    medicationReferences.push({ reference: `urn:uuid:${medId}` });
  }

  // 3. Vital Sign Observations
  for (const vital of clinicalData.vitals || []) {
    const obsId = crypto.randomUUID();
    entries.push({
      fullUrl: `urn:uuid:${obsId}`,
      resource: {
        resourceType: 'Observation',
        id: obsId,
        status: 'final',
        category: [{ coding: [{ code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { text: vital.parameter },
        subject: { reference: `urn:uuid:${patientId}` },
        valueString: `${vital.value} ${vital.unit || ''}`.trim(),
      },
    });
    vitalReferences.push({ reference: `urn:uuid:${obsId}` });
  }

  // 4. Laboratory Test Observations
  for (const test of clinicalData.tests || []) {
    const obsId = crypto.randomUUID();
    const testResource: any = {
      resourceType: 'Observation',
      id: obsId,
      status: 'final',
      category: [{ coding: [{ code: 'laboratory', display: 'Laboratory' }] }],
      code: { text: test.test_name },
      subject: { reference: `urn:uuid:${patientId}` },
      valueString: `${test.result} ${test.unit || ''}`.trim(),
    };
    if (test.reference_range) {
      testResource.referenceRange = [{ text: test.reference_range }];
    }
    entries.push({
      fullUrl: `urn:uuid:${obsId}`,
      resource: testResource,
    });
    testReferences.push({ reference: `urn:uuid:${obsId}` });
  }

  // 5. Composition Resource
  const sections: any[] = [];
  if (medicationReferences.length > 0) {
    sections.push({
      title: 'Prescription',
      code: { coding: [{ system: 'http://snomed.info/sct', code: '440545006', display: 'Prescription record' }] },
      entry: medicationReferences,
    });
  }
  if (vitalReferences.length > 0) {
    sections.push({
      title: 'Vital Signs',
      code: { coding: [{ system: 'http://snomed.info/sct', code: '1184593002', display: 'Vital signs' }] },
      entry: vitalReferences,
    });
  }
  if (testReferences.length > 0) {
    sections.push({
      title: 'Diagnostic Investigations',
      code: { coding: [{ system: 'http://snomed.info/sct', code: '721981007', display: 'Diagnostic studies report' }] },
      entry: testReferences,
    });
  }

  const compositionResource = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [{ system: 'http://snomed.info/sct', code: '440545006', display: 'Prescription record' }],
      text: 'Prescription record',
    },
    subject: { reference: `urn:uuid:${patientId}` },
    date: timestamp,
    title: 'Prescription Record',
    section: sections,
  };

  entries.unshift({
    fullUrl: `urn:uuid:${compositionId}`,
    resource: compositionResource,
  });

  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      versionId: '1',
      lastUpdated: timestamp,
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle'],
    },
    identifier: {
      system: 'https://ndhm.in/phr',
      value: bundleId,
    },
    type: 'document',
    timestamp,
    entry: entries,
  };
}

export class VisionExtractorAgent {
  private geminiApiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  /**
   * Directly extracts structured clinical data from image buffer or local file
   * using Google Gemini Multimodal Vision API in-process (Zero Python microservice overhead).
   */
  async scanAndSummarize(
    filePath: string,
    originalFilename: string,
    mimeType: string
  ): Promise<VisionExtractorResponse> {
    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in environment. Please set GEMINI_API_KEY in your .env file.'
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const encodedData = fileBuffer.toString('base64');

    // Normalize MIME type
    let normalizedMimeType = mimeType || 'image/jpeg';
    if (normalizedMimeType.includes('jpg')) normalizedMimeType = 'image/jpeg';

    const payload = {
      contents: [
        {
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: normalizedMimeType,
                data: encodedData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json',
      },
    };

    const models = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-robotics-er-2-preview',
      'gemini-2.5-computer-use-preview-10-2025',
    ];

    let lastError: string | null = null;
    let extractedClinicalData: ExtractedClinicalData | null = null;

    for (const model of models) {
      const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;
      try {
        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 75000,
        });

        if (response.status === 200 && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = response.data.candidates[0].content.parts[0].text;
          const cleanedText = rawText
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();

          extractedClinicalData = JSON.parse(cleanedText) as ExtractedClinicalData;
          break;
        } else {
          lastError = JSON.stringify(response.data);
        }
      } catch (err: any) {
        lastError = err.response?.data?.error?.message || err.message;
      }
    }

    if (!extractedClinicalData) {
      throw new Error(`Multimodal clinical extraction failed across all models. Last error: ${lastError}`);
    }

    // Run clinical safety checks & FHIR bundling in-process
    const safetyAlerts = checkDrugSafety(extractedClinicalData.medications || []);
    const fhirBundle = buildFhirBundle(extractedClinicalData);

    return {
      success: true,
      filename: originalFilename,
      document_type: normalizedMimeType,
      extracted_data: extractedClinicalData,
      safety_alerts: safetyAlerts,
      fhir_bundle: fhirBundle,
    };
  }
}

export const visionExtractorAgent = new VisionExtractorAgent();

