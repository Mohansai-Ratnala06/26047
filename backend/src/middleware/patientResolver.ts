import { Request, Response, NextFunction } from 'express';
import Patient from '../models/Patient';
import { ApiResponse } from '../types';

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

    const patient = await Patient.findOne({ userId }).select('_id patientCode');
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
