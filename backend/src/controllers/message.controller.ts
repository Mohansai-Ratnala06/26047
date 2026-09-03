import { Request, Response } from 'express';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import Patient from '../models/Patient';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { conversationId } = req.params;
    const { role, inputType, language, content, structuredData, audioS3Key } = req.body;

    // Verify conversation belongs to patient
    const conversation = await Conversation.findOne({ _id: conversationId, patientId });
    if (!conversation) {
      const response: ApiResponse = { success: false, message: 'Conversation not found or unauthorized' };
      return res.status(404).json(response);
    }

    const message = new Message({
      conversationId,
      patientId,
      episodeId: conversation.episodeId,
      role: role || 'patient',
      inputType: inputType || 'text',
      language: language || 'en',
      content,
      structuredData,
      audioS3Key,
      timestamp: new Date(),
    });
    await message.save();

    const response: ApiResponse = { success: true, data: message };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { conversationId } = req.params;

    // Verify conversation belongs to patient
    const conversation = await Conversation.findOne({ _id: conversationId, patientId });
    if (!conversation) {
      const response: ApiResponse = { success: false, message: 'Conversation not found or unauthorized' };
      return res.status(404).json(response);
    }

    // Cursor-based pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string; // timestamp cursor

    const query: Record<string, any> = { conversationId };
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].timestamp.toISOString() : null;

    const response: ApiResponse = {
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: { hasMore, nextCursor, limit },
      },
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
