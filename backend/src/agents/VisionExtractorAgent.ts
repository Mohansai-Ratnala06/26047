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
  is_medical_document: boolean;
  medical_document_confidence?: number;
  document_classification?: string;
  rejection_reason?: string | null;
  patient?: {
    name?: string | null;
    age?: string | null;
    gender?: string | null;
    date?: string | null;
  };
  clinic?: {
    name?: string | null;
    doctor?: string | null;
  };
  document_date?: string | null;
  vitals?: ExtractedVital[];
  diagnoses: string[];
  immunizations?: string[];
  procedures?: string[];
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
You are an expert clinical document analyzer for VAIDYAARC. Analyze the provided file (image or PDF) in TWO MANDATORY STAGES.

STAGE 1: MEDICAL DOCUMENT VALIDATION
Carefully examine the entire image/document:
- Is this a genuine medical, health, or clinical document? (Examples: doctor prescription, lab/pathology test report, hospital discharge summary, radiology/imaging report, blood donation certificate, vaccination card, medical certificate, clinic bill/receipt with diagnoses or medications).
- If it is clearly NON-MEDICAL (e.g. a photo of a bedsheet, fabric, furniture, random pet/selfie, grocery bill, food item, scenery, blank page, meme):
  Set "is_medical_document": false
  Set "medical_document_confidence": 0.98
  Set "document_classification": "Non-Medical"
  Set "rejection_reason": "We were unable to process your record because the uploaded file is not a medical document."
  Set all clinical fields (patient, clinic, vitals, diagnoses, immunizations, procedures, medications, tests, advice) to empty or null.
- If it IS a medical or healthcare document:
  Set "is_medical_document": true
  Set "medical_document_confidence": 0.95+
  Set "document_classification": (e.g., "Doctor Prescription", "Laboratory/Pathology Report", "Hospital Discharge Summary", "Diagnostic Imaging/Radiology", "Blood Donor Certificate", "Vaccination / Immunization Record", or other specific medical type)
  Set "rejection_reason": null

STAGE 2: STRUCTURED CLINICAL EXTRACTION (when is_medical_document is true)
Extract all available structured clinical data:
- patient: name, age, gender, date.
- clinic: clinic / hospital / laboratory facility name, doctor name.
- document_date: the canonical clinical event or test date (YYYY-MM-DD or standard date format).
- vitals: parameter (e.g. BP, Pulse, Temperature, SpO2), value, unit.
- diagnoses: list of clinical diagnoses, conditions, impressions, or reasons for encounter.
- immunizations: list of vaccines / immunizations mentioned.
- procedures: list of surgeries, interventions, or clinical procedures performed.
- medications: list of prescribed/administered drugs with name, dosage, frequency, duration.
- tests: laboratory tests or investigations with test_name, result, unit, reference_range.
- advice: doctor's advice, lifestyle advice, diet, precautions, follow-up instructions.

Follow these strict output rules:
1. Return ONLY the raw JSON object. Do not include markdown code block syntax (like \`\`\`json), commentary, or extra text.
2. Use the exact keys provided below. If a value is missing or not applicable, use null or empty lists [].

Required JSON Schema:
{
  "is_medical_document": boolean,
  "medical_document_confidence": number,
  "document_classification": string,
  "rejection_reason": string or null,
  "patient": {
    "name": string or null,
    "age": string or null,
    "gender": string or null,
    "date": string or null
  },
  "clinic": {
    "name": string or null,
    "doctor": string or null
  },
  "document_date": string or null,
  "vitals": [
    {
      "parameter": string,
      "value": string,
      "unit": string or null
    }
  ],
  "diagnoses": [string],
  "immunizations": [string],
  "procedures": [string],
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
   * Extracts structured clinical data from an uploaded image using Google Gemini
   * Multimodal Vision API as the sole decision-maker for medical document validation.
   * Gemini determines whether the image is a medical document AND extracts clinical data.
   */
  async scanAndSummarize(
    filePath: string,
    originalFilename: string,
    mimeType: string
  ): Promise<VisionExtractorResponse> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    // Normalize MIME type
    let normalizedMimeType = mimeType || 'image/jpeg';
    if (normalizedMimeType.includes('jpg')) normalizedMimeType = 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey || apiKey.includes('placeholder') || apiKey.trim().length < 16) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please set a valid Gemini API key in backend/.env to enable medical document validation.'
      );
    }

    // Read file and encode as base64 for Gemini Vision
    const fileBuffer = fs.readFileSync(filePath);
    const encodedData = fileBuffer.toString('base64');

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

    // Use modern active Gemini vision models (3.5-flash-lite is fastest for multimodal OCR)
    const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
    let extractedClinicalData: ExtractedClinicalData | null = null;
    let lastError: string | null = null;

    for (const model of models) {
      const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;
      try {
        console.log(`[VisionExtractorAgent] Sending to Gemini model: ${model}`);
        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
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
          console.log(
            `[VisionExtractorAgent] Gemini (${model}) decision — is_medical_document: ${extractedClinicalData.is_medical_document}`
          );

          // If Gemini didn't set is_medical_document explicitly, infer from extracted content
          if (typeof extractedClinicalData.is_medical_document !== 'boolean') {
            const hasClinicalSignals =
              (extractedClinicalData.diagnoses?.length || 0) > 0 ||
              (extractedClinicalData.medications?.length || 0) > 0 ||
              (extractedClinicalData.tests?.length || 0) > 0 ||
              (extractedClinicalData.immunizations?.length || 0) > 0 ||
              (extractedClinicalData.procedures?.length || 0) > 0 ||
              Boolean(extractedClinicalData.patient?.name);
            extractedClinicalData.is_medical_document = hasClinicalSignals;
          }

          // Set rejection reason if not a medical document
          if (!extractedClinicalData.is_medical_document && !extractedClinicalData.rejection_reason) {
            extractedClinicalData.rejection_reason =
              'No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).';
          }

          // Ensure all array fields are always present
          extractedClinicalData.diagnoses = extractedClinicalData.diagnoses || [];
          extractedClinicalData.immunizations = extractedClinicalData.immunizations || [];
          extractedClinicalData.procedures = extractedClinicalData.procedures || [];
          extractedClinicalData.medications = extractedClinicalData.medications || [];
          extractedClinicalData.tests = extractedClinicalData.tests || [];
          extractedClinicalData.vitals = extractedClinicalData.vitals || [];
          extractedClinicalData.advice = extractedClinicalData.advice || [];

          break; // Success — stop trying more models
        } else {
          lastError = `Unexpected response structure from ${model}: ` + JSON.stringify(response.data);
          console.warn(`[VisionExtractorAgent] ${lastError}`);
        }
      } catch (err: any) {
        lastError = err.response?.data?.error?.message || err.message;
        console.warn(`[VisionExtractorAgent] Gemini model ${model} failed: ${lastError}`);
      }
    }

    // If both models failed, throw — let the controller return a proper rejection to the user
    if (!extractedClinicalData) {
      throw new Error(
        `Gemini Vision analysis failed: ${lastError || 'No response from API'}. Please try again.`
      );
    }

    // Run clinical safety checks & FHIR bundling only for valid medical documents
    const safetyAlerts = extractedClinicalData.is_medical_document
      ? checkDrugSafety(extractedClinicalData.medications || [])
      : [];
    const fhirBundle = extractedClinicalData.is_medical_document
      ? buildFhirBundle(extractedClinicalData)
      : null;

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

