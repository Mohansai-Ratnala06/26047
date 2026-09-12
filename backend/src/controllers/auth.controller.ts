import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Patient from '../models/Patient';
import HealthProfile from '../models/HealthProfile';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';
import { resolveOrCreatePatient } from '../middleware/patientResolver';

const getJwtSecret = () => process.env.JWT_SECRET || 'dev-secret';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, password, abhaId } = req.body;

    if (!name || !phone || !password) {
      const response: ApiResponse = { success: false, message: 'Name, phone, and password are required' };
      return res.status(400).json(response);
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined;
    const cleanAbhaId = abhaId && typeof abhaId === 'string' && abhaId.trim() ? abhaId.trim() : undefined;

    const existingUser = await User.findOne({
      $or: [
        { phone: cleanPhone },
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanAbhaId ? [{ abhaId: cleanAbhaId }] : []),
      ],
    });
    if (existingUser) {
      // Check if user has a corresponding patient record
      const existingPatient = await Patient.findOne({ userId: existingUser._id });
      if (!existingPatient) {
        // User record was orphaned by a previously failed registration. Clean up and proceed.
        console.log(`[Auth] Cleaning up orphaned user ${existingUser._id} from failed previous registration`);
        await User.deleteOne({ _id: existingUser._id });
      } else {
        const response: ApiResponse = { success: false, message: 'User already exists' };
        return res.status(400).json(response);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      passwordHash,
      abhaId: cleanAbhaId,
      role: 'patient',
    });

    let savedUser;
    try {
      savedUser = await user.save();

      // Auto-create canonical Patient identity
      const patientCode = await generateCode('PAT');
      const nameParts = name.trim().split(/\s+/);
      const patient = new Patient({
        userId: savedUser._id,
        patientCode,
        demographics: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || undefined,
        },
        contact: {
          phone: cleanPhone,
          email: cleanEmail,
        },
        identifiers: {
          abhaId: cleanAbhaId,
        },
        status: 'active',
      });
      await patient.save();

      // Auto-create empty HealthProfile
      const healthProfile = new HealthProfile({
        patientId: patient._id,
      });
      await healthProfile.save();

      const token = jwt.sign({ id: savedUser._id, role: savedUser.role }, getJwtSecret(), { expiresIn: '7d' });

      const response: ApiResponse = {
        success: true,
        message: 'Registration successful',
        data: {
          token,
          user: { id: savedUser._id, name: savedUser.name, phone: savedUser.phone, email: savedUser.email, abhaId: savedUser.abhaId },
          patient: { id: patient._id, patientCode },
        },
      };
      return res.status(201).json(response);
    } catch (saveError: any) {
      if (savedUser && savedUser._id) {
        await User.deleteOne({ _id: savedUser._id }).catch(() => {});
      }
      throw saveError;
    }
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      const response: ApiResponse = { success: false, message: 'Identifier and password are required' };
      return res.status(400).json(response);
    }

    const cleanIdentifier = identifier.trim();
    const user = await User.findOne({
      $or: [
        { phone: cleanIdentifier },
        { email: cleanIdentifier.toLowerCase() },
        { abhaId: cleanIdentifier },
      ],
    });
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
    let patient = await Patient.findOne({ userId: user._id }).select('_id patientCode status');
    if (!patient && user.role === 'patient') {
      patient = await resolveOrCreatePatient(user._id.toString());
    }

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

    let patient = await Patient.findOne({ userId: user._id });
    if (!patient && user.role === 'patient') {
      patient = await resolveOrCreatePatient(user._id.toString());
    }

    const response: ApiResponse = { success: true, data: { user, patient } };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
