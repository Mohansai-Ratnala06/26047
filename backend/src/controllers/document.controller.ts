import { Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import MedicalDocument from '../models/MedicalDocument';
import Episode from '../models/Episode';
import LabResult from '../models/LabResult';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';
import { visionExtractorAgent, ExtractedClinicalData } from '../agents/VisionExtractorAgent';
import { brainModelAgent } from '../agents/BrainModelAgent';
import { resolvePatientId } from '../middleware/patientResolver';
import { deleteEpisodeAndAssociatedData } from '../services/episodeDeletion.service';

// Persistent storage directory for medical documents
const storageDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Staging directory for backward-compatibility checks
const stagingDir = path.join(process.cwd(), 'tmp', 'uploads');
if (!fs.existsSync(stagingDir)) {
  fs.mkdirSync(stagingDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storageDir);
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

/**
 * Resolves whether a document belongs to an existing clinical episode or represents a standalone record.
 */
export async function resolveDocumentEpisode(
  patientId: any,
  clinical: ExtractedClinicalData,
  requestedEpisodeId?: string
): Promise<any> {
  if (requestedEpisodeId) {
    const ep = await Episode.findOne({ _id: requestedEpisodeId, patientId });
    if (ep) return ep._id;
  }

  // Canonical clinical date from document
  let docDate: Date | null = null;
  if (clinical.document_date) {
    const d = new Date(clinical.document_date);
    if (!isNaN(d.getTime())) docDate = d;
  }
  if (!docDate && clinical.patient?.date) {
    const d = new Date(clinical.patient.date);
    if (!isNaN(d.getTime())) docDate = d;
  }

  const targetDate = docDate || new Date();
  const targetTime = targetDate.getTime();

  // Find existing episodes for this patient
  const episodes = await Episode.find({ patientId }).sort({ startedAt: -1 });
  if (!episodes || episodes.length === 0) {
    return null;
  }

  // 1. Keyword / clinical relevance matching
  const docKeywords = [
    ...(clinical.diagnoses || []),
    ...(clinical.procedures || []),
    ...(clinical.immunizations || []),
    ...(clinical.tests?.map((t) => t.test_name) || []),
  ].map((s) => s.toLowerCase());

  for (const ep of episodes) {
    const epComplaint = (ep.chiefComplaint || '').toLowerCase();
    const epSymptoms = (ep.symptoms || []).map((s) => (s.name || '').toLowerCase());

    const matchesKeyword = docKeywords.some(
      (kw) =>
        (epComplaint && (kw.includes(epComplaint) || epComplaint.includes(kw))) ||
        epSymptoms.some((s) => kw.includes(s) || s.includes(kw))
    );

    if (matchesKeyword) {
      const epStart = new Date(ep.startedAt).getTime();
      const epEnd = ep.resolvedAt ? new Date(ep.resolvedAt).getTime() : Date.now() + 7 * 86400000;
      const thirtyDays = 30 * 86400000;

      if (targetTime >= epStart - thirtyDays && targetTime <= epEnd + thirtyDays) {
        return ep._id;
      }
    }
  }

  // 2. Active episode matching within tight clinical encounter window (±3 days)
  const openEpisode = episodes.find((e) => e.status === 'open' || e.status === 'under_review');
  if (openEpisode && docDate) {
    const epStart = new Date(openEpisode.startedAt).getTime();
    const diffDays = Math.abs(docDate.getTime() - epStart) / 86400000;
    if (diffDays <= 3) {
      return openEpisode._id;
    }
  }

  // Standalone general record
  return null;
}


export const createDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId, documentType, source, storage } = req.body;
    const documentCode = await generateCode('DOC', patientId);

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

    // Only return documents that are valid or in-process (exclude rejected non-medical uploads)
    const documents = await MedicalDocument.find({
      patientId,
      medicalDocumentStatus: { $ne: 'not_medical_document' },
    }).sort({ createdAt: -1 });

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
    const documents = await MedicalDocument.find({
      episodeId,
      patientId,
      medicalDocumentStatus: { $ne: 'not_medical_document' },
    }).sort({ createdAt: -1 });

    const response: ApiResponse = { success: true, data: documents };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getDocumentById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { documentId } = req.params;
    let document: any = null;
    if (mongoose.Types.ObjectId.isValid(documentId)) {
      document = await MedicalDocument.findOne({ _id: documentId, patientId });
    }
    if (!document) {
      document = await MedicalDocument.findOne({ documentCode: documentId, patientId });
    }

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.status(200).json({ success: true, data: document });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDocumentFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { documentId } = req.params;
    let document: any = null;
    if (mongoose.Types.ObjectId.isValid(documentId)) {
      document = await MedicalDocument.findById(documentId);
    }
    if (!document) {
      document = await MedicalDocument.findOne({ documentCode: documentId });
    }

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Verify patient authorization
    if (document.patientId.toString() !== patientId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to document file' });
    }

    const filename = document.storage?.key;
    if (!filename) {
      return res.status(404).json({ success: false, message: 'File reference not found' });
    }

    const baseName = path.basename(filename);
    const storagePath = path.join(storageDir, baseName);
    const fullKeyPath = path.join(storageDir, filename);
    const fallbackPath = path.join(stagingDir, baseName);

    let filePath = '';
    if (fs.existsSync(storagePath)) {
      filePath = storagePath;
    } else if (fs.existsSync(fullKeyPath)) {
      filePath = fullKeyPath;
    } else if (fs.existsSync(fallbackPath)) {
      filePath = fallbackPath;
    } else {
      return res.status(404).json({ success: false, message: 'Physical file not found on server' });
    }

    const contentType = document.storage?.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.documentCode || 'document'}${path.extname(filename)}"`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { documentId } = req.params;
    let document: any = null;
    if (mongoose.Types.ObjectId.isValid(documentId)) {
      document = await MedicalDocument.findById(documentId);
    }
    if (!document) {
      document = await MedicalDocument.findOne({ documentCode: documentId });
    }

    if (!document) {
      // Check if documentId is actually an episode (e.g. EP-000005 or an Episode ObjectId)
      try {
        const episodeResult = await deleteEpisodeAndAssociatedData(
          documentId,
          patientId,
          (req as any).user.role,
          userId
        );
        return res.status(200).json(episodeResult);
      } catch (epError: any) {
        if (!epError.message.includes('not found')) {
          const statusCode = epError.message.includes('Unauthorized') ? 403 : 500;
          return res.status(statusCode).json({ success: false, message: epError.message });
        }
      }

      return res.status(404).json({ success: false, message: 'Document or record not found' });
    }

    // Verify patient authorization
    if (document.patientId.toString() !== patientId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this document' });
    }

    // 1. Delete physical files from disk without any trace
    const filesToDelete: string[] = [];
    if (document.storage?.key) {
      const fileName = path.basename(document.storage.key);
      filesToDelete.push(
        path.join(storageDir, fileName),
        path.join(storageDir, document.storage.key),
        path.join(stagingDir, fileName),
        path.join(stagingDir, document.storage.key)
      );
    }
    if (document.storage?.url && typeof document.storage.url === 'string') {
      const urlFileName = path.basename(document.storage.url);
      filesToDelete.push(
        path.join(storageDir, urlFileName),
        path.join(stagingDir, urlFileName)
      );
    }

    for (const filePath of filesToDelete) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }

    // 2. Delete any associated LabResults
    try {
      await LabResult.deleteMany({ documentId: document._id });
    } catch (_) {}

    // 3. Delete MongoDB record completely
    await MedicalDocument.findByIdAndDelete(document._id);

    res.status(200).json({
      success: true,
      message: 'Health record and all associated data permanently deleted.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
        try {
          fs.unlinkSync(uploadedFile.path);
        } catch (_) {}
      }
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    if (!uploadedFile) {
      const response: ApiResponse = { success: false, message: 'No document file provided for upload.' };
      return res.status(400).json(response);
    }

    const { episodeId, documentType: requestedType, hospital, doctor, consent, patientConsent } = req.body;
    const documentCode = await generateCode('DOC', patientId);

    const consentGiven =
      consent === 'true' ||
      consent === true ||
      patientConsent === 'true' ||
      patientConsent === true ||
      patientConsent?.consented === true;

    // 1. Create initial document record with 'processing' state
    const document = new MedicalDocument({
      documentCode,
      patientId,
      episodeId: episodeId || undefined,
      documentType: requestedType || 'prescription',
      medicalDocumentStatus: 'pending',
      patientConsent: {
        consented: Boolean(consentGiven),
        consentedAt: new Date(),
        purpose: 'AI-assisted clinical extraction and smart health report generation',
        version: 1,
      },
      source: {
        hospital: hospital || 'Self Uploaded',
        doctor: doctor || undefined,
        documentDate: new Date(),
      },
      storage: {
        provider: 'local',
        bucket: 'uploads/documents',
        key: uploadedFile.filename,
        contentType: uploadedFile.mimetype,
        size: uploadedFile.size,
      },
      extractionStatus: 'processing',
      verification: { status: 'unverified' },
    });
    await document.save();

    // 2. Call Vision Extractor for Two-Stage Clinical Processing
    let visionResult: any = null;
    try {
      visionResult = await visionExtractorAgent.scanAndSummarize(
        uploadedFile.path,
        uploadedFile.originalname,
        uploadedFile.mimetype
      );

      const clinical: ExtractedClinicalData = visionResult.extracted_data || {};

      // Stage 1: Check if the document was rejected as non-medical
      if (clinical.is_medical_document === false) {
        document.medicalDocumentStatus = 'not_medical_document';
        document.extractionStatus = 'failed';
        document.rejectionReason =
          clinical.rejection_reason ||
          'No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).';
        await document.save();

        const response: ApiResponse = {
          success: true,
          data: document,
          message: document.rejectionReason,
        };
        return res.status(200).json(response);
      }

      // Stage 2: Valid medical document processing
      document.medicalDocumentStatus = 'medical_document';

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

      const extractedDateStr = clinical.document_date || clinical.patient?.date || null;
      if (extractedDateStr) {
        const parsedDate = new Date(extractedDateStr);
        if (!isNaN(parsedDate.getTime())) {
          document.source.documentDate = parsedDate;
        }
      }

      // Update document with structured clinical extraction
      document.extractionStatus = 'completed';
      document.extractedData = {
        patientName: clinical.patient?.name || undefined,
        reportedDate: extractedDateStr || undefined,
        clinicName: clinical.clinic?.name || hospital || undefined,
        healthDocumentType: clinical.document_classification || requestedType || undefined,
        diagnoses: clinical.diagnoses || [],
        immunizations: clinical.immunizations || [],
        procedures: clinical.procedures || [],
        medications: formattedMeds,
        investigations: formattedTests,
        tests: clinical.tests || [],
        abnormalValues: [],
        vitals: clinical.vitals || [],
        advice: clinical.advice || [],
      };

      // Server-side Episode Resolution: evaluate against patient's episodes
      const resolvedEpisodeId = await resolveDocumentEpisode(patientId, clinical, episodeId);
      if (resolvedEpisodeId) {
        document.episodeId = resolvedEpisodeId;
      }

      if (visionResult.safety_alerts) {
        document.safetyAlerts = visionResult.safety_alerts;
      }
      if (visionResult.fhir_bundle) {
        document.fhirBundle = visionResult.fhir_bundle;
      }

      document.ocrMetadata = {
        language: 'en',
        confidence: clinical.medical_document_confidence || 0.95,
        model: 'gemini-clinical-vision-extractor',
      };

      await document.save();
    } catch (aiError: any) {
      console.error('[uploadDocument] Vision Extractor error:', aiError.message);
      document.extractionStatus = 'failed';
      document.medicalDocumentStatus = 'not_medical_document';
      document.rejectionReason =
        'No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).';
      await document.save();

      const response: ApiResponse = {
        success: true,
        data: document,
        message: document.rejectionReason,
      };
      return res.status(200).json(response);
    }

    // 3. Forward to Stage-2 Brain Model for clinical synthesis & summary
    if (visionResult?.extracted_data && document.medicalDocumentStatus === 'medical_document') {
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

    // NOTE: The uploaded physical file in storageDir is permanently preserved
    // so the patient can view the Original Report beside the Smart Report.

    const response: ApiResponse = {
      success: true,
      data: document,
      message: 'Medical document uploaded and processed successfully.',
    };
    return res.status(201).json(response);
  } catch (error: any) {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try {
        fs.unlinkSync(uploadedFile.path);
      } catch (_) {}
    }
    const response: ApiResponse = { success: false, message: error.message };
    return res.status(500).json(response);
  }
};

