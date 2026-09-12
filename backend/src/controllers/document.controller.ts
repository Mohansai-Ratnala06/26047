import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import MedicalDocument from '../models/MedicalDocument';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';
import { visionExtractorAgent } from '../agents/VisionExtractorAgent';
import { brainModelAgent } from '../agents/BrainModelAgent';
import { resolvePatientId } from '../middleware/patientResolver';


// Upload staging directory
const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

export const multerUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|pdf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and PDF files are supported.'));
    }
  },
});


export const createDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId, documentType, source, storage } = req.body;
    const documentCode = await generateCode('DOC');

    const document = new MedicalDocument({
      documentCode,
      patientId,
      episodeId,
      documentType,
      source,
      storage,
      extractionStatus: 'pending',
      verification: { status: 'unverified' },
    });
    await document.save();

    const response: ApiResponse = { success: true, data: document };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getDocumentsByPatient = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const documents = await MedicalDocument.find({ patientId }).sort({ createdAt: -1 });

    const response: ApiResponse = { success: true, data: documents };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getDocumentsByEpisode = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId } = req.params;
    const documents = await MedicalDocument.find({ episodeId, patientId }).sort({ createdAt: -1 });

    const response: ApiResponse = { success: true, data: documents };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const updateExtractionStatus = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { extractionStatus, extractedData, ocrMetadata } = req.body;

    const updateData: Record<string, any> = {};
    if (extractionStatus) updateData.extractionStatus = extractionStatus;
    if (extractedData) updateData.extractedData = extractedData;
    if (ocrMetadata) updateData.ocrMetadata = ocrMetadata;

    const document = await MedicalDocument.findByIdAndUpdate(
      documentId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!document) {
      const response: ApiResponse = { success: false, message: 'Document not found' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: document };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
  const uploadedFile = (req as any).file;

  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
        try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
      }
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    if (!uploadedFile) {
      const response: ApiResponse = { success: false, message: 'No document file provided for upload.' };
      return res.status(400).json(response);
    }

    const { episodeId, documentType: requestedType, hospital, doctor } = req.body;
    const documentCode = await generateCode('DOC');

    // 1. Create initial document record with 'processing' state
    const document = new MedicalDocument({
      documentCode,
      patientId,
      episodeId: episodeId || undefined,
      documentType: requestedType || 'prescription',
      source: {
        hospital: hospital || 'Self Uploaded',
        doctor: doctor || undefined,
        documentDate: new Date(),
      },
      storage: {
        provider: 'local',
        bucket: 'tmp/uploads',
        key: uploadedFile.filename,
        contentType: uploadedFile.mimetype,
        size: uploadedFile.size,
      },
      extractionStatus: 'processing',
      verification: { status: 'unverified' },
    });
    await document.save();

    // 2. Call Vision Extractor microservice (FastAPI on port 8100)
    let visionResult: any = null;
    try {
      visionResult = await visionExtractorAgent.scanAndSummarize(
        uploadedFile.path,
        uploadedFile.originalname,
        uploadedFile.mimetype
      );

      const clinical = visionResult.extracted_data || {};

      // Map medications to formatted strings for clean display
      const formattedMeds: string[] = (clinical.medications || []).map((m: any) => {
        const parts = [m.name];
        if (m.dosage) parts.push(m.dosage);
        if (m.frequency) parts.push(`- ${m.frequency}`);
        if (m.duration) parts.push(`(${m.duration})`);
        return parts.join(' ').trim();
      });

      // Map tests to formatted strings
      const formattedTests: string[] = (clinical.tests || []).map((t: any) => {
        let text = `${t.test_name}: ${t.result}`;
        if (t.unit) text += ` ${t.unit}`;
        if (t.reference_range) text += ` (Ref: ${t.reference_range})`;
        return text.trim();
      });

      // Update document with structured clinical extraction
      document.extractionStatus = 'completed';
      document.extractedData = {
        diagnoses: clinical.diagnoses || [],
        medications: formattedMeds,
        investigations: formattedTests,
        procedures: [],
        abnormalValues: [],
        vitals: clinical.vitals || [],
        advice: clinical.advice || [],
      };

      if (clinical.patient?.date) {
        const parsedDate = new Date(clinical.patient.date);
        if (!isNaN(parsedDate.getTime())) {
          document.source.documentDate = parsedDate;
        }
      }

      if (visionResult.safety_alerts) {
        document.safetyAlerts = visionResult.safety_alerts;
      }
      if (visionResult.fhir_bundle) {
        document.fhirBundle = visionResult.fhir_bundle;
      }

      document.ocrMetadata = {
        language: 'en',
        confidence: 0.95,
        model: 'gemini-clinical-vision-extractor',
      };

      await document.save();
    } catch (aiError: any) {
      console.warn('[uploadDocument] Vision Extractor warning (document preserved):', aiError.message);
      document.extractionStatus = 'needs_review';
      await document.save();
    }

    // 3. Forward to Stage-2 Brain Model for clinical synthesis & summary
    if (visionResult?.extracted_data) {
      try {
        const analysis = await brainModelAgent.analyze({
          documentId: document._id.toString(),
          documentCode: document.documentCode,
          patientId: patientId.toString(),
          extracted_data: visionResult.extracted_data,
          safety_alerts: visionResult.safety_alerts || [],
          fhir_bundle: visionResult.fhir_bundle,
        });
        if (analysis) {
          document.brainAnalysis = analysis;
          await document.save();
        }
      } catch (brainErr: any) {
        console.warn('[uploadDocument] Brain Model warning (non-fatal):', brainErr.message);
      }
    }

    // 4. Clean up temporary uploaded file from local staging
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
    }

    const response: ApiResponse = {
      success: true,
      data: document,
      message: 'Medical document uploaded and processed successfully.',
    };
    return res.status(201).json(response);
  } catch (error: any) {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
    }
    const response: ApiResponse = { success: false, message: error.message };
    return res.status(500).json(response);
  }
};

