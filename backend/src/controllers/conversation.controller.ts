import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Episode from '../models/Episode';
import Patient from '../models/Patient';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

export const createConversation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId, channel, language } = req.body;

    // Verify episode belongs to patient
    const episode = await Episode.findOne({ _id: episodeId, patientId });
    if (!episode) {
      const response: ApiResponse = { success: false, message: 'Episode not found or unauthorized' };
      return res.status(404).json(response);
    }

    const conversation = new Conversation({
      patientId,
      episodeId,
      channel: channel || 'text',
      language: language || 'en',
      status: 'active',
      startedAt: new Date(),
    });
    await conversation.save();

    const response: ApiResponse = { success: true, data: conversation };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getConversationsByEpisode = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId } = req.params;
    const conversations = await Conversation.find({ episodeId, patientId }).sort({ createdAt: -1 });

    const response: ApiResponse = { success: true, data: conversations };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getConversationById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({ _id: conversationId, patientId });

    if (!conversation) {
      const response: ApiResponse = { success: false, message: 'Conversation not found or unauthorized' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: conversation };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
