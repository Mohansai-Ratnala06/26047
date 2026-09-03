import { Request, Response } from 'express';
import Episode from '../models/Episode';
import Patient from '../models/Patient';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

export const createEpisode = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { chiefComplaint, type, symptoms, doctorId } = req.body;
    const episodeCode = await generateCode('EP');

    const episode = new Episode({
      patientId,
      episodeCode,
      type: type || 'symptom',
      chiefComplaint,
      symptoms: symptoms || [],
      doctorId,
      status: 'open',
      startedAt: new Date(),
    });
    await episode.save();

    const response: ApiResponse = { success: true, data: episode };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getEpisodes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    let episodes;
    if (role === 'patient') {
      const patientId = await resolvePatientId(userId);
      if (!patientId) {
        const response: ApiResponse = { success: false, message: 'Patient profile not found' };
        return res.status(404).json(response);
      }
      episodes = await Episode.find({ patientId }).populate('doctorId', 'name').sort({ createdAt: -1 });
    } else {
      episodes = await Episode.find({ doctorId: userId }).populate('patientId').sort({ createdAt: -1 });
    }

    const response: ApiResponse = { success: true, data: episodes };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getEpisodeById = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    let query: Record<string, any> = { _id: episodeId };

    if (role === 'patient') {
      const patientId = await resolvePatientId(userId);
      if (!patientId) {
        const response: ApiResponse = { success: false, message: 'Patient profile not found' };
        return res.status(404).json(response);
      }
      query.patientId = patientId;
    } else {
      query.doctorId = userId;
    }

    const episode = await Episode.findOne(query);

    if (!episode) {
      const response: ApiResponse = { success: false, message: 'Episode not found or unauthorized' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: episode };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const updateEpisode = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    let query: Record<string, any> = { _id: episodeId };

    if (role === 'patient') {
      const patientId = await resolvePatientId(userId);
      if (!patientId) {
        const response: ApiResponse = { success: false, message: 'Patient profile not found' };
        return res.status(404).json(response);
      }
      query.patientId = patientId;
    } else {
      query.doctorId = userId;
    }

    const episode = await Episode.findOneAndUpdate(
      query,
      req.body,
      { new: true, runValidators: true }
    );

    if (!episode) {
      const response: ApiResponse = { success: false, message: 'Episode not found or unauthorized' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: episode };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
