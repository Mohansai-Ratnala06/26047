import { Request, Response } from 'express';
import Consent from '../models/Consent';
import Patient from '../models/Patient';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

export const createConsent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { grantedTo, purpose, scope, expiresAt } = req.body;
    const consentCode = await generateCode('CON');

    const consent = new Consent({
      patientId,
      consentCode,
      grantedTo,
      purpose,
      scope,
      expiresAt,
    });
    await consent.save();

    const response: ApiResponse = { success: true, data: consent };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getConsents = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    let consents;
    if (role === 'patient') {
      const patientId = await resolvePatientId(userId);
      if (!patientId) {
        const response: ApiResponse = { success: false, message: 'Patient profile not found' };
        return res.status(404).json(response);
      }
      consents = await Consent.find({ patientId }).populate('grantedTo', 'name phone');
    } else {
      consents = await Consent.find({ grantedTo: userId }).populate('patientId');
    }

    const response: ApiResponse = { success: true, data: consents };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const updateConsent = async (req: Request, res: Response) => {
  try {
    const { consentId } = req.params;
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { status, revokedReason } = req.body;

    const updateData: Record<string, any> = { status };
    if (status === 'REVOKED') {
      updateData.revokedAt = new Date();
      if (revokedReason) updateData.revokedReason = revokedReason;
    }

    const consent = await Consent.findOneAndUpdate(
      { _id: consentId, patientId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!consent) {
      const response: ApiResponse = { success: false, message: 'Consent not found or unauthorized' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: consent };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
