import { Request, Response } from 'express';
import MedicalDocument from '../models/MedicalDocument';
import Patient from '../models/Patient';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

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
