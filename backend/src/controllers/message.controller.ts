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
    // Gemini Brain natively understands Indic languages (Telugu, Hindi, etc.) without redundant pre-translation.
    // Only invoke external NMT if running in non-Gemini legacy mode.
    let englishContent = content || '';
    const isGeminiEngine = (process.env.CLINICAL_ENGINE_MODE || 'gemini') === 'gemini';
    if (!isGeminiEngine && content && patientLanguage && !patientLanguage.toLowerCase().startsWith('en')) {
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

    // Retrieve recent conversation messages for this episode & patient to provide multi-turn context
    const previousMessages = await Message.find({
      episodeId: conversation.episodeId,
      patientId,
      _id: { $ne: patientMessage._id },
    })
      .sort({ timestamp: -1 })
      .limit(10);

    const formattedHistory = previousMessages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

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
      previous_conversations: formattedHistory,
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
    const missingList = turnResponse.missing_information || [];
    let dynamicFallback = 'Could you share a few more details about your symptoms to help with your clinical assessment?';
    if (missingList.includes('location')) {
      dynamicFallback = 'Could you tell me where in your body you are feeling this discomfort?';
    } else if (missingList.includes('duration')) {
      dynamicFallback = 'When did these symptoms start, or how long have you been experiencing them?';
    } else if (missingList.includes('severity')) {
      dynamicFallback = 'How severe is the discomfort — would you describe it as mild, moderate, or severe?';
    } else if (missingList.includes('nature_of_pain')) {
      dynamicFallback = 'Could you describe what the sensation or pain feels like (e.g. burning, sharp, or dull)?';
    }

    const defaultClinicalMessage = turnResponse.immediate_attention_required || turnResponse.status === 'emergency'
      ? 'EMERGENCY WARNING: Your reported symptoms indicate a potential medical emergency requiring immediate clinical attention. Please seek emergency medical care immediately.'
      : turnResponse.information_complete || turnResponse.status === 'complete'
      ? 'Thank you. Your clinical intake and assessment are complete. Please review your clinical assessment summary.'
      : dynamicFallback;

    const rawBrainMessage = (turnResponse.conversation_message && turnResponse.conversation_message.trim())
      ? turnResponse.conversation_message.trim()
      : defaultClinicalMessage;

    // Translate Brain's response back into patient's language only if it was returned in English
    let nativeAssistantContent = rawBrainMessage;
    const isIndicLanguage = !patientLanguage.toLowerCase().startsWith('en');
    // Check if the text already contains Telugu, Devanagari, Tamil, Kannada, Malayalam, or Bengali script
    const hasIndicScript = /[\u0900-\u0D7F]/.test(rawBrainMessage);

    if (rawBrainMessage && isIndicLanguage && !hasIndicScript) {
      try {
        nativeAssistantContent = await nmtService.translateFromEnglish(rawBrainMessage, patientLanguage);
        console.info(`[NMT Outbound] Translated Brain response (en) -> (${patientLanguage}): "${nativeAssistantContent}"`);
      } catch (nmtOutErr: any) {
        console.warn('[NMT Outbound] Translation failed, proceeding with English response:', nmtOutErr.message);
        nativeAssistantContent = rawBrainMessage;
      }
    } else if (hasIndicScript) {
      console.info(`[Brain Response] Brain already formulated native response in ${patientLanguage}, skipping redundant NMT.`);
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
    // Keep conversation status active for ongoing patient-companion interaction.
    // Do NOT mark completed prematurely — patient can ask follow-ups, remedy questions, or clarification.
    conversation.status = 'active';
    await conversation.save();

    // Check if patient confirmed starting a new concurrent episode for an unrelated problem
    let activeEpisodeId = conversation.episodeId;
    let activeConversationId = conversation._id;
    let switchedToNewEpisode = false;

    if (turnResponse.confirm_start_new_episode && turnResponse.detected_new_complaint) {
      try {
        const { generateCode } = await import('../utils/codeGenerator');
        const newEpCode = await generateCode('EP', patientId);
        const newEpisode = new Episode({
          patientId,
          episodeCode: newEpCode,
          type: 'symptom',
          chiefComplaint: turnResponse.detected_new_complaint,
          symptoms: [{ name: turnResponse.detected_new_complaint }],
          status: 'open',
          patientConsent: {
            consented: true,
            consentedAt: new Date(),
            scope: 'clinical_intake_and_triage',
            version: '1.0',
          },
          startedAt: new Date(),
        });
        await newEpisode.save();

        const newConversation = new Conversation({
          patientId,
          episodeId: newEpisode._id,
          channel: conversation.channel || 'voice',
          language: patientLanguage,
          status: 'active',
          startedAt: new Date(),
        });
        await newConversation.save();

        activeEpisodeId = newEpisode._id;
        activeConversationId = newConversation._id;
        switchedToNewEpisode = true;

        assistantMessage.episodeId = newEpisode._id;
        assistantMessage.conversationId = newConversation._id;
        await assistantMessage.save();
        console.info(`[MessageController] Patient confirmed new problem -> Spawned concurrent episode ${newEpCode} (${turnResponse.detected_new_complaint}) while preserving previous episode.`);
      } catch (newEpErr: any) {
        console.warn('[MessageController] Failed to spawn concurrent episode:', newEpErr.message);
      }
    }

    // Auto-update Episode chiefComplaint, triage, phase type, and Pre-Consultation Notes
    if (conversation.episodeId) {
      try {
        const ep = await Episode.findById(conversation.episodeId);
        if (ep) {
          let hasChanges = false;

          const snapComplaint =
            turnResponse.clinical_output?.pre_consultation_report?.doctorSummarySOAP?.highlightedProblem ||
            turnResponse.clinical_output?.clinical_summary?.soap?.highlightedProblem ||
            turnResponse.updated_state?.chief_complaint ||
            turnResponse.clinical_output?.clinical_case?.chief_complaint ||
            turnResponse.clinical_output?.clinical_summary?.primary_concern;
          
          const preConsult = turnResponse.clinical_output?.pre_consultation_report;
          const severityScore = turnResponse.clinical_output?.severity_score;

          // Update chiefComplaint if valid and current is placeholder, conversational, or non-English script
          if (
            typeof snapComplaint === 'string' &&
            snapComplaint.trim().length > 1 &&
            !snapComplaint.toLowerCase().includes('fetch whatever records') &&
            !snapComplaint.toLowerCase().includes('voice consultation')
          ) {
            const formatted = snapComplaint.trim().charAt(0).toUpperCase() + snapComplaint.trim().slice(1);
            const hasIndicScript = /[\u0900-\u0D7F]/.test(ep.chiefComplaint || '');
            const isPlaceholderOrConversational =
              !ep.chiefComplaint ||
              hasIndicScript ||
              ep.chiefComplaint.toLowerCase().includes('voice consultation') ||
              ep.chiefComplaint.toLowerCase().includes('ai triage') ||
              ep.chiefComplaint.toLowerCase().includes('clinical consultation') ||
              ep.chiefComplaint.toLowerCase().includes('symptom intake') ||
              ep.chiefComplaint.toLowerCase().includes('health intake') ||
              ep.chiefComplaint.trim().toLowerCase() === 'symptom' ||
              ep.chiefComplaint.trim().toLowerCase() === 'pain' ||
              ep.chiefComplaint.endsWith('.') ||
              ep.chiefComplaint.endsWith('?');

            if (isPlaceholderOrConversational) {
              ep.chiefComplaint = formatted;
              hasChanges = true;
            }
          }

          // Update clinical triage level and transition phase type based on severity escalation
          if (severityScore != null) {
            const level =
              turnResponse.immediate_attention_required || severityScore >= 80
                ? 'urgent'
                : severityScore >= 60
                ? 'high'
                : severityScore >= 35
                ? 'moderate'
                : 'low';
            ep.triage = {
              level,
              redFlags: turnResponse.red_flags || [],
              evaluatedAt: new Date(),
            };
            if (level === 'urgent' || level === 'high') {
              ep.status = 'escalated';
              ep.type = level === 'urgent' ? 'emergency' : 'consultation';
            } else if (turnResponse.clinical_output?.consultation_recommended) {
              ep.type = 'consultation';
            }
            hasChanges = true;
          }

          // Store complete structured clinical assessment report directly on Episode
          if (turnResponse.clinical_output) {
            ep.clinicalOutput = turnResponse.clinical_output;
            hasChanges = true;
          }

          // Sync remedies tracked with relief outcomes
          const remediesOffered = turnResponse.updated_state?.remediesOffered;
          if (Array.isArray(remediesOffered) && remediesOffered.length > 0) {
            ep.remediesTracked = remediesOffered.map((r: any) => ({
              remedyName: r.remedy,
              recordId: r.recordId,
              status: r.status || 'suggested',
              reliefReported: r.reliefReported || 'pending',
              patientFeedback: r.patientFeedback,
              lastReportedAt: r.offeredAt ? new Date(r.offeredAt) : new Date(),
            }));
            hasChanges = true;
          }

          // Store structured pre-consultation report into clinicalNotes
          if (preConsult && preConsult.doctorSummarySOAP) {
            ep.clinicalNotes = `[PRE-CONSULTATION SUMMARY - ${preConsult.recommendedSpecialty || 'General Medicine'}]
Severity: ${preConsult.severityScore}/100 | Generated: ${preConsult.generatedAt}
HPI: ${preConsult.hpiSummary}
SOAP Subjective: ${preConsult.doctorSummarySOAP.subjective}
SOAP Objective: ${preConsult.doctorSummarySOAP.objective}
SOAP Assessment: ${preConsult.doctorSummarySOAP.assessment}
SOAP Plan: ${preConsult.doctorSummarySOAP.plan}
Remedies Attempted: ${preConsult.remediesTried?.join(', ') || 'None'}`;
            hasChanges = true;
          }

          if (hasChanges) {
            await ep.save();
          }
        }
      } catch (epUpdateErr: any) {
        console.warn('[MessageController] Episode update error:', epUpdateErr.message);
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
        activeEpisodeId,
        activeConversationId,
        switchedToNewEpisode,
        detectedNewComplaint: turnResponse.detected_new_complaint || null,
        unrelatedProblemDetected: turnResponse.unrelated_problem_detected || false,
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

/**
 * Retrieve all messages for an episode belonging to the authenticated patient.
 * Ensures complete multi-turn history continuity across turns, app relaunches, and rehydrations.
 */
export const getMessagesByEpisode = async (req: Request, res: Response) => {
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

    const { episodeId } = req.params;

    // Verify episode belongs to this authenticated patient
    const episode = await Episode.findOne({ _id: episodeId, patientId });
    if (!episode) {
      const response: ApiResponse = { success: false, message: 'Episode not found or unauthorized' };
      return res.status(404).json(response);
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const before = req.query.before as string;

    const query: Record<string, any> = { episodeId, patientId };
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: 1 })
      .limit(limit);

    const response: ApiResponse = {
      success: true,
      data: {
        messages,
        pagination: { count: messages.length, limit },
      },
    };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

