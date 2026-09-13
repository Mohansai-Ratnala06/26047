import { Request, Response } from 'express';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import Episode from '../models/Episode';
import Patient from '../models/Patient';
import { ApiResponse } from '../types';
import clinicalBrainService, { NormalizedClinicalInputDTO } from '../services/clinicalBrain.service';
import { resolvePatientId } from '../middleware/patientResolver';
import { nmtService } from '../services/stt.service';
import { ttsService } from '../services/tts.service';


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

    // Determine patient's spoken/selected language
    const patientLanguage = language || conversation.language || 'en';

    // 1. INBOUND NMT TRANSLATION (STT -> Brain):
    // Translate regional language text (Telugu, Hindi, Tamil, etc.) to clinical English for the Brain
    let englishContent = content || '';
    if (content && patientLanguage && !patientLanguage.toLowerCase().startsWith('en')) {
      try {
        englishContent = await nmtService.translateToEnglish(content, patientLanguage);
        console.info(`[NMT Inbound] Translated "${content}" (${patientLanguage}) -> "${englishContent}" (en)`);
      } catch (nmtInErr: any) {
        console.warn('[NMT Inbound] Translation failed, proceeding with original text:', nmtInErr.message);
        englishContent = content;
      }
    }

    // 2. Save patient message in MongoDB with original text and English translation metadata
    const safePatientContent = (content && content.trim()) ? content.trim() : (englishContent || 'Patient message');
    const patientMessage = new Message({
      conversationId,
      patientId,
      episodeId: conversation.episodeId,
      role: 'patient',
      inputType: inputType || 'text',
      language: patientLanguage,
      content: safePatientContent,
      structuredData: {
        ...(structuredData || {}),
        englishTranslation: englishContent !== content ? englishContent : undefined,
      },
      audioS3Key,
      timestamp: new Date(),
    });
    await patientMessage.save();

    // 3. Construct NormalizedClinicalInputDTO for Clinical Brain
    const patientDoc = await Patient.findById(patientId);
    const clinicalInput: NormalizedClinicalInputDTO = {
      patient_id: patientId.toString(),
      episode_id: conversation.episodeId ? conversation.episodeId.toString() : conversationId,
      channel: conversation.channel || 'mobile_app',
      message: {
        original_text: safePatientContent,
        original_language: patientLanguage,
        english_text: englishContent,
        source: 'patient',
        confidence: 1.0,
        provenance: inputType === 'voice' ? 'patient_spoken' : 'patient_typed',
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

    // 4. Invoke Clinical Brain (processes clinical reasoning in English)
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

    // 5. OUTBOUND NMT TRANSLATION (Brain -> Patient's Language / future TTS):
    // Fallback default message in case turnResponse.conversation_message is null or empty
    const defaultClinicalMessage = turnResponse.immediate_attention_required || turnResponse.status === 'emergency'
      ? 'EMERGENCY WARNING: Your reported symptoms indicate a potential medical emergency requiring immediate clinical attention. Please seek emergency medical care immediately.'
      : turnResponse.information_complete || turnResponse.status === 'complete'
      ? 'Thank you. Your clinical intake and assessment are complete. Please review your clinical assessment summary.'
      : 'Could you please describe your symptoms or how long you have been experiencing this in more detail?';

    const rawBrainMessage = (turnResponse.conversation_message && turnResponse.conversation_message.trim())
      ? turnResponse.conversation_message.trim()
      : defaultClinicalMessage;

    // Translate Brain's clinical English response back into the patient's native language
    let nativeAssistantContent = rawBrainMessage;
    if (rawBrainMessage && patientLanguage && !patientLanguage.toLowerCase().startsWith('en')) {
      try {
        nativeAssistantContent = await nmtService.translateFromEnglish(rawBrainMessage, patientLanguage);
        console.info(`[NMT Outbound] Translated Brain response (en) -> (${patientLanguage}): "${nativeAssistantContent}"`);
      } catch (nmtOutErr: any) {
        console.warn('[NMT Outbound] Translation failed, proceeding with English response:', nmtOutErr.message);
        nativeAssistantContent = rawBrainMessage;
      }
    }

    // Safety guard: ensure content is never empty or whitespace
    if (!nativeAssistantContent || !nativeAssistantContent.trim()) {
      nativeAssistantContent = rawBrainMessage;
    }

    // 5.1 MULTILINGUAL TTS SYNTHESIS (Assistant Spoken Voice):
    let audioBase64: string | undefined = undefined;
    let audioMimeType: string | undefined = undefined;
    if (inputType === 'voice' || req.body.generateAudio === true) {
      try {
        const ttsResult = await ttsService.synthesize(nativeAssistantContent, patientLanguage);
        if (ttsResult && ttsResult.audioBase64) {
          audioBase64 = ttsResult.audioBase64;
          audioMimeType = ttsResult.mimeType || 'audio/wav';
          console.info(`[TTS Synthesis] Generated ${audioMimeType} audio (${ttsResult.languageCode}) for: "${nativeAssistantContent.substring(0, 40)}..."`);
        }
      } catch (ttsErr: any) {
        console.warn('[TTS Synthesis] Warning: Audio synthesis error, continuing with text-only:', ttsErr.message);
      }
    }

    // 6. Save assistant response message in MongoDB
    const assistantMessage = new Message({
      conversationId,
      patientId,
      episodeId: conversation.episodeId,
      role: 'assistant',
      inputType: 'text',
      language: patientLanguage,
      content: nativeAssistantContent,
      structuredData: {
        englishMessage: rawBrainMessage,
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

    // 7. Update Conversation with stateSnapshot and clinical status
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

    // Auto-update Episode chiefComplaint if currently generic placeholder
    if (conversation.episodeId) {
      const snapComplaint =
        turnResponse.updated_state?.chief_complaint ||
        turnResponse.clinical_output?.clinical_case?.chief_complaint ||
        turnResponse.clinical_output?.clinical_summary?.primary_concern;
      if (
        typeof snapComplaint === 'string' &&
        snapComplaint.trim().length > 1 &&
        !snapComplaint.toLowerCase().includes('fetch whatever records') &&
        !snapComplaint.toLowerCase().includes('voice consultation')
      ) {
        const formatted = snapComplaint.trim().charAt(0).toUpperCase() + snapComplaint.trim().slice(1);
        Episode.findById(conversation.episodeId)
          .then((ep) => {
            if (
              ep &&
              (!ep.chiefComplaint ||
                ep.chiefComplaint.toLowerCase().includes('voice consultation') ||
                ep.chiefComplaint.toLowerCase().includes('ai triage') ||
                ep.chiefComplaint.trim() === 'symptom')
            ) {
              ep.chiefComplaint = formatted;
              ep.save().catch(() => {});
            }
          })
          .catch(() => {});
      }
    }

    // 8. Return response to mobile client with translated content, english original, metadata, and speech audio
    const response: ApiResponse = {
      success: true,
      data: {
        patientMessage,
        assistantMessage,
        englishAssistantMessage: rawBrainMessage,
        turnStatus: turnResponse.status,
        immediateAttentionRequired: turnResponse.immediate_attention_required,
        informationComplete: turnResponse.information_complete,
        missingInformation: turnResponse.missing_information,
        clinicalOutput: turnResponse.clinical_output || null,
        audioBase64,
        audioMimeType,
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
