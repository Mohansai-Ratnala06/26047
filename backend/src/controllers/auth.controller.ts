import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Patient from '../models/Patient';
import HealthProfile from '../models/HealthProfile';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';

const getJwtSecret = () => process.env.JWT_SECRET || 'dev-secret';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, password, abhaId } = req.body;

    const existingUser = await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
    if (existingUser) {
      const response: ApiResponse = { success: false, message: 'User already exists' };
      return res.status(400).json(response);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name, phone, email, passwordHash, abhaId, role: 'patient' });
    await user.save();

    // Auto-create canonical Patient identity
    const patientCode = await generateCode('PAT');
    const nameParts = name.trim().split(/\s+/);
    const patient = new Patient({
      userId: user._id,
      patientCode,
      demographics: {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || undefined,
      },
      contact: {
        phone,
        email,
      },
      identifiers: {
        abhaId: abhaId || undefined,
      },
      status: 'active',
    });
    await patient.save();

    // Auto-create empty HealthProfile
    const healthProfile = new HealthProfile({
      patientId: patient._id,
    });
    await healthProfile.save();

    const token = jwt.sign({ id: user._id, role: user.role }, getJwtSecret(), { expiresIn: '7d' });

    const response: ApiResponse = {
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: { id: user._id, name, phone, email, abhaId },
        patient: { id: patient._id, patientCode },
      },
    };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({ $or: [{ phone: identifier }, { email: identifier }] });
    if (!user) {
      const response: ApiResponse = { success: false, message: 'Invalid credentials' };
      return res.status(401).json(response);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const response: ApiResponse = { success: false, message: 'Invalid credentials' };
      return res.status(401).json(response);
    }

    const token = jwt.sign({ id: user._id, role: user.role }, getJwtSecret(), { expiresIn: '7d' });

    // Include patient info in login response
    const patient = await Patient.findOne({ userId: user._id }).select('_id patientCode status');

    const response: ApiResponse = {
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: { id: user._id, name: user.name, phone: user.phone, email: user.email, abhaId: user.abhaId },
        patient: patient ? { id: patient._id, patientCode: patient.patientCode, status: patient.status } : null,
      },
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req as any).user.id).select('-passwordHash');
    if (!user) {
      const response: ApiResponse = { success: false, message: 'User not found' };
      return res.status(404).json(response);
    }

    const patient = await Patient.findOne({ userId: user._id });

    const response: ApiResponse = { success: true, data: { user, patient } };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
