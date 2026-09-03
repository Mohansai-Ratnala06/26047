import { Request, Response } from 'express';
import HealthProfile from '../models/HealthProfile';
import Patient from '../models/Patient';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

export const getHealthProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const profile = await HealthProfile.findOne({ patientId });

    const response: ApiResponse = { success: true, data: profile };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const updateHealthProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    let profile = await HealthProfile.findOne({ patientId });

    if (profile) {
      // Use $set for top-level fields, handle arrays properly
      profile = await HealthProfile.findOneAndUpdate(
        { patientId },
        { $set: req.body },
        { new: true, runValidators: true }
      );
    } else {
      profile = new HealthProfile({ patientId, ...req.body });
      await profile.save();
    }

    const response: ApiResponse = { success: true, data: profile };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
