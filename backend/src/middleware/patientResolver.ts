import { Request, Response, NextFunction } from 'express';
import Patient from '../models/Patient';
import User from '../models/User';
import HealthProfile from '../models/HealthProfile';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';

/**
 * Resolves an existing Patient record for the given userId.
 * If no Patient record exists (e.g. legacy/demo user or omitted signup profile),
 * automatically creates the canonical Patient profile and HealthProfile on the fly.
 */
export const resolveOrCreatePatient = async (userId: string): Promise<any> => {
  if (!userId) return null;

  let patient = await Patient.findOne({ userId });
  if (patient) {
    return patient;
  }

  // Auto-heal missing patient profile for existing authenticated user
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  try {
    const patientCode = await generateCode('PAT');
    const nameParts = (user.name || 'Patient').trim().split(/\s+/);
    patient = new Patient({
      userId: user._id,
      patientCode,
      demographics: {
        firstName: nameParts[0] || 'Patient',
        lastName: nameParts.slice(1).join(' ') || undefined,
      },
      contact: {
        phone: user.phone,
        email: user.email,
      },
      identifiers: {
        abhaId: user.abhaId,
      },
      status: 'active',
    });
    await patient.save();

    // Ensure HealthProfile exists
    const existingHp = await HealthProfile.findOne({ patientId: patient._id });
    if (!existingHp) {
      const healthProfile = new HealthProfile({
        patientId: patient._id,
      });
      await healthProfile.save().catch(() => {});
    }

    console.info(`[AutoHeal] Automatically created missing Patient profile (${patientCode}) for user: ${user._id}`);
    return patient;
  } catch (err: any) {
    const existing = await Patient.findOne({ userId });
    if (existing) return existing;
    console.error(`[AutoHeal] Failed to auto-create patient for user ${userId}:`, err.message);
    return null;
  }
};

/**
 * Resolves or auto-creates a patient ID for the given user ID.
 */
export const resolvePatientId = async (userId: string): Promise<any> => {
  const patient = await resolveOrCreatePatient(userId);
  return patient?._id || null;
};

export const resolvePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      const response: ApiResponse = { success: false, message: 'Authentication required' };
      res.status(401).json(response);
      return;
    }

    const patient = await resolveOrCreatePatient(userId);
    if (!patient) {
      const response: ApiResponse = {
        success: false,
        message: 'Patient profile not found. Please complete registration.',
      };
      res.status(404).json(response);
      return;
    }

    (req as any).patientId = patient._id;
    (req as any).patientCode = patient.patientCode;
    next();
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

