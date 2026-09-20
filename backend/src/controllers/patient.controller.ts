import { Request, Response } from 'express';
import Patient from '../models/Patient';
import User from '../models/User';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';
import { resolveOrCreatePatient } from '../middleware/patientResolver';

export const createPatient = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { demographics, contact, preferences, identifiers } = req.body;

    const existing = await Patient.findOne({ userId });
    if (existing) {
      const response: ApiResponse = { success: false, message: 'Patient profile already exists' };
      return res.status(400).json(response);
    }

    const patientCode = await generateCode('PAT');
    const patient = new Patient({
      userId,
      patientCode,
      demographics,
      contact,
      preferences,
      identifiers,
      status: 'active',
    });
    await patient.save();

    const response: ApiResponse = { success: true, data: patient };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    let patient = await Patient.findOne({ userId }).populate('userId', '-passwordHash');

    if (!patient) {
      patient = await resolveOrCreatePatient(userId);
      if (patient) {
        await patient.populate('userId', '-passwordHash');
      }
    }

    if (!patient) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: patient };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { demographics, contact, preferences, identifiers } = req.body;

    // Ensure patient document exists
    await resolveOrCreatePatient(userId);

    const updateData: Record<string, any> = {};
    if (demographics) {
      for (const [key, value] of Object.entries(demographics)) {
        updateData[`demographics.${key}`] = value;
      }
    }
    if (contact) {
      if (contact.address) {
        for (const [key, value] of Object.entries(contact.address)) {
          updateData[`contact.address.${key}`] = value;
        }
        delete contact.address;
      }
      for (const [key, value] of Object.entries(contact)) {
        updateData[`contact.${key}`] = value;
      }
    }
    if (preferences) {
      for (const [key, value] of Object.entries(preferences)) {
        updateData[`preferences.${key}`] = value;
      }
    }
    if (identifiers) {
      for (const [key, value] of Object.entries(identifiers)) {
        updateData[`identifiers.${key}`] = value;
      }
    }

    const patient = await Patient.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (identifiers?.abhaId) {
      await User.findByIdAndUpdate(userId, { abhaId: identifiers.abhaId }).catch(() => {});
    }

    if (demographics?.firstName) {
      const fullName = `${demographics.firstName} ${demographics.lastName || ''}`.trim();
      if (fullName) {
        await User.findByIdAndUpdate(userId, { name: fullName }).catch(() => {});
      }
    }

    if (!patient) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: patient };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
