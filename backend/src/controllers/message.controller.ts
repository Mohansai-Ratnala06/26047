import { Request, Response } from 'express';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import Patient from '../models/Patient';
import { ApiResponse } from '../types';
import clinicalBrainService, { NormalizedClinicalInputDTO } from '../services/clinicalBrain.service';
import { resolvePatientId } from '../middleware/patientResolver';


export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      const response: ApiResponse = { success: false, message: 'Unauthorized: User not authenticated' };
      return res.status(401).json(response);
    }

    const patientId = await resolvePatientId(userId);
    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { conversationId } = req.params;
    const { inputType, language, content, structuredData, audioS3Key } = req.body;

    if (!content && !audioS3Key) {
      const response: ApiResponse = { success: false, message: 'Message content or audio is required' };
      return res.status(400).json(response);
    }

    // Verify conversation belongs to patient
    const conversation = await Conversation.findOne({ _id: conversationId, patientId });
    if (!conversation) {
      const response: ApiResponse = { success: false, message: 'Conversation not found or unauthorized' };
      return res.status(404).json(response);
    }

    // 1. Save patient message exactly as received
    const patientMessage = new Message({
      conversationId,
      patientId,
      episodeId: conversation.episodeId,
      role: 'patient',
      inputType: inputType || 'text',
      language: language || conversation.language || 'en',
      content: content || '',
      structuredData,
      audioS3Key,
      timestamp: new Date(),
    });
    await patientMessage.save();

    // 2. Construct NormalizedClinicalInputDTO for Python Brain
    const patientDoc = await Patient.findById(patientId);
    const clinicalInput: NormalizedClinicalInputDTO = {
      patient_id: patientId.toString(),
      episode_id: conversation.episodeId ? conversation.episodeId.toString() : conversationId,
      channel: conversation.channel || 'mobile_app',
      message: {
        original_text: content || '',
        original_language: language || conversation.language || 'en',
        source: 'patient',
        confidence: 1.0,
        provenance: 'patient_typed',
      },
      patient_profile: {
        age: patientDoc?.demographics?.age,
        sex: patientDoc?.demographics?.gender,
        medical_conditions: [],
        allergies: [],
        chronic_medications: [],
        surgical_history: [],
        family_history: [],
      },
      state_snapshot: conversation.stateSnapshot || null,
    };

    // 3. Invoke Python Clinical Brain
    let turnResponse;
    try {
      turnResponse = await clinicalBrainService.processClinicalTurn(clinicalInput);
    } catch (brainError: any) {
      console.error('[MessageController] Python Brain call failed:', brainError.message);
      const response: ApiResponse = {
        success: false,
        message: `Clinical intelligence service unavailable: ${brainError.message}`,
        data: { patientMessage },
      };
      return res.status(503).json(response);
    }

    // 4. Save assistant response message in MongoDB
    const assistantMessage = new Message({
      conversationId,
      patientId,
      episodeId: conversation.episodeId,
      role: 'assistant',
      inputType: 'text',
      language: language || conversation.language || 'en',
      content: turnResponse.conversation_message || '',
      structuredData: {
        status: turnResponse.status,
        information_complete: turnResponse.information_complete,
        missing_information: turnResponse.missing_information,
        immediate_attention_required: turnResponse.immediate_attention_required,
        red_flag_status: turnResponse.red_flag_status,
        red_flags: turnResponse.red_flags,
      },
      timestamp: new Date(),
    });
    await assistantMessage.save();

    // 5. Update Conversation with stateSnapshot and clinical status
    conversation.stateSnapshot = turnResponse.updated_state;
    conversation.clinicalStatus = turnResponse.status;
    conversation.immediateAttentionRequired = turnResponse.immediate_attention_required;
    if (turnResponse.clinical_output) {
      conversation.clinicalOutput = turnResponse.clinical_output;
    }
    if (turnResponse.information_complete || turnResponse.immediate_attention_required) {
      conversation.status = 'completed';
      conversation.completedAt = new Date();
    }
    await conversation.save();

    // 6. Return response to mobile client
    const response: ApiResponse = {
      success: true,
      data: {
        patientMessage,
        assistantMessage,
        turnStatus: turnResponse.status,
        immediateAttentionRequired: turnResponse.immediate_attention_required,
        informationComplete: turnResponse.information_complete,
        missingInformation: turnResponse.missing_information,
        clinicalOutput: turnResponse.clinical_output || null,
      },
    };
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
