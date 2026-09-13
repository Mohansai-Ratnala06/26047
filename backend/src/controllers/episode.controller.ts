import { Request, Response } from 'express';
import Episode from '../models/Episode';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';
import { resolvePatientId } from '../middleware/patientResolver';


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

import Conversation from '../models/Conversation';
import MedicalDocument from '../models/MedicalDocument';
import Assessment from '../models/Assessment';
import Prescription from '../models/Prescription';
import LabResult from '../models/LabResult';
import Consent from '../models/Consent';

/**
 * Resolves the genuine clinical chief complaint for an episode.
 * If the stored complaint is a generic placeholder like "Voice Consultation / AI Triage Intake",
 * this inspects the latest conversation stateSnapshot, clinical output, symptoms, and documents
 * to extract the actual medical problem the patient presented with.
 */
function resolvePatientChiefComplaint(
  ep: any,
  epConvs: any[],
  epDocs: any[]
): { chiefComplaint: string; duration?: string } {
  const raw = ep.chiefComplaint ? String(ep.chiefComplaint).trim() : '';
  const isPlaceholder =
    !raw ||
    raw.toLowerCase().includes('voice consultation') ||
    raw.toLowerCase().includes('ai triage') ||
    raw.toLowerCase() === 'symptom';

  if (!isPlaceholder) {
    return { chiefComplaint: raw };
  }

  // 1. Check conversations in reverse chronological order (newest first)
  for (const c of epConvs) {
    const snapComplaint = c.stateSnapshot?.chief_complaint;
    if (
      typeof snapComplaint === 'string' &&
      snapComplaint.trim().length > 1 &&
      !snapComplaint.toLowerCase().includes('fetch whatever records') &&
      !snapComplaint.toLowerCase().includes('voice consultation')
    ) {
      const trimmed = snapComplaint.trim();
      const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      const duration =
        typeof c.stateSnapshot?.duration === 'string' && c.stateSnapshot.duration.trim()
          ? c.stateSnapshot.duration.trim()
          : undefined;
      return { chiefComplaint: formatted, duration };
    }

    const clinCaseComplaint = c.clinicalOutput?.clinical_case?.chief_complaint;
    if (typeof clinCaseComplaint === 'string' && clinCaseComplaint.trim()) {
      return { chiefComplaint: clinCaseComplaint.trim() };
    }

    const primaryConcern = c.clinicalOutput?.clinical_summary?.primary_concern;
    if (typeof primaryConcern === 'string' && primaryConcern.trim()) {
      return { chiefComplaint: primaryConcern.trim() };
    }
  }

  // 2. Check episode symptoms
  if (Array.isArray(ep.symptoms) && ep.symptoms.length > 0) {
    const symptomNames = ep.symptoms
      .map((s: any) => (typeof s === 'string' ? s : s?.name))
      .filter(Boolean);
    if (symptomNames.length > 0) {
      return { chiefComplaint: symptomNames.join(', ') };
    }
  }

  // 3. Check document diagnoses
  for (const d of epDocs) {
    if (d.extractedData?.diagnosis && typeof d.extractedData.diagnosis === 'string') {
      return { chiefComplaint: d.extractedData.diagnosis };
    }
    if (d.extractedData?.chief_complaint && typeof d.extractedData.chief_complaint === 'string') {
      return { chiefComplaint: d.extractedData.chief_complaint };
    }
  }

  // 4. Patient-friendly clinical phase title fallback
  return { chiefComplaint: 'General Health Assessment & Triage' };
}

export const getEpisodes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    if (role === 'patient') {
      const patientId = await resolvePatientId(userId);
      if (!patientId) {
        const response: ApiResponse = { success: false, message: 'Patient profile not found' };
        return res.status(404).json(response);
      }

      // Chronological sort: newest episode first
      const episodes = await Episode.find({ patientId })
        .populate('doctorId', 'name email department room')
        .sort({ startedAt: -1, createdAt: -1 });

      const episodeIds = episodes.map((e) => e._id);

      // Parallel lightweight lookup across indexed child relationships
      const [conversations, documents, assessments, prescriptions, labResults, activeConsentsCount] =
        await Promise.all([
          episodeIds.length > 0
            ? Conversation.find({ episodeId: { $in: episodeIds } })
                .select('_id episodeId clinicalOutput stateSnapshot status channel createdAt')
                .sort({ createdAt: -1 })
            : [],
          episodeIds.length > 0
            ? MedicalDocument.find({
                $or: [{ episodeId: { $in: episodeIds } }, { patientId }],
              }).select(
                '_id episodeId documentType documentCode source storage extractedData verification createdAt'
              )
            : [],
          episodeIds.length > 0
            ? Assessment.find({ episodeId: { $in: episodeIds } }).select(
                '_id episodeId assessmentType status findings prescriptionSummary consultationSummary createdAt'
              )
            : [],
          episodeIds.length > 0
            ? Prescription.find({ episodeId: { $in: episodeIds } }).select(
                '_id episodeId medications notes status issuedAt createdAt'
              )
            : [],
          episodeIds.length > 0
            ? LabResult.find({ episodeId: { $in: episodeIds } }).select(
                '_id episodeId testName result unit isAbnormal performedAt createdAt'
              )
            : [],
          Consent.countDocuments({ patientId, status: 'GRANTED' }),
        ]);

      // Group children by episodeId
      const convMap = new Map<string, any[]>();
      conversations.forEach((c) => {
        const k = c.episodeId ? c.episodeId.toString() : '';
        if (k) {
          if (!convMap.has(k)) convMap.set(k, []);
          convMap.get(k)!.push(c);
        }
      });

      const docMap = new Map<string, any[]>();
      documents.forEach((d) => {
        const k = d.episodeId ? d.episodeId.toString() : '';
        if (k) {
          if (!docMap.has(k)) docMap.set(k, []);
          docMap.get(k)!.push(d);
        }
      });

      const asmMap = new Map<string, any[]>();
      assessments.forEach((a) => {
        const k = a.episodeId ? a.episodeId.toString() : '';
        if (k) {
          if (!asmMap.has(k)) asmMap.set(k, []);
          asmMap.get(k)!.push(a);
        }
      });

      const rxMap = new Map<string, any[]>();
      prescriptions.forEach((p) => {
        const k = p.episodeId ? p.episodeId.toString() : '';
        if (k) {
          if (!rxMap.has(k)) rxMap.set(k, []);
          rxMap.get(k)!.push(p);
        }
      });

      const labMap = new Map<string, any[]>();
      labResults.forEach((l) => {
        const k = l.episodeId ? l.episodeId.toString() : '';
        if (k) {
          if (!labMap.has(k)) labMap.set(k, []);
          labMap.get(k)!.push(l);
        }
      });

      const enrichedEpisodes = episodes.map((ep) => {
        const epObj = ep.toObject();
        const epIdStr = ep._id.toString();
        const epDocs = docMap.get(epIdStr) || [];
        const epConvs = convMap.get(epIdStr) || [];
        const epAsms = asmMap.get(epIdStr) || [];
        const epRxs = rxMap.get(epIdStr) || [];
        const epLabs = labMap.get(epIdStr) || [];

        const hasAiSummary = epConvs.some(
          (c) => c.clinicalOutput && Object.keys(c.clinicalOutput).length > 0
        );
        const hasRecords = epDocs.length > 0;
        const hasConsultation =
          epAsms.length > 0 || Boolean(ep.clinicalNotes) || Boolean(ep.doctorId);
        const hasDocuments = epDocs.some((d) =>
          ['discharge_summary', 'imaging', 'other', 'consultation_note'].includes(d.documentType)
        );
        const hasInvestigations =
          epLabs.length > 0 || epDocs.some((d) => d.documentType === 'laboratory_report');
        const hasPrescriptions =
          epRxs.length > 0 || epDocs.some((d) => d.documentType === 'prescription');
        const hasVitals = epDocs.some(
          (d) => d.extractedData?.vitals && d.extractedData.vitals.length > 0
        );
        const hasConsents = activeConsentsCount > 0;

        const totalRxMeds = epRxs.reduce(
          (acc, r) => acc + (Array.isArray(r.medications) ? r.medications.length : 1),
          0
        );

        // Resolve authentic chief complaint and duration from conversations, symptoms, and documents
        const resolved = resolvePatientChiefComplaint(epObj, epConvs, epDocs);
        const resolvedComplaint = resolved.chiefComplaint;

        // Auto-heal placeholder in DB if a genuine complaint was found
        const wasPlaceholder =
          !ep.chiefComplaint ||
          ep.chiefComplaint.toLowerCase().includes('voice consultation') ||
          ep.chiefComplaint.toLowerCase().includes('ai triage');
        if (wasPlaceholder && resolvedComplaint && resolvedComplaint !== 'General Health Assessment & Triage') {
          Episode.updateOne(
            { _id: ep._id },
            { $set: { chiefComplaint: resolvedComplaint } }
          ).exec().catch(() => {});
        }

        return {
          ...epObj,
          episodeId: ep._id,
          chiefComplaint: resolvedComplaint,
          duration: resolved.duration,
          availableData: {
            aiSummary: hasAiSummary,
            records: hasRecords,
            consents: hasConsents,
            consultation: hasConsultation,
            documents: hasDocuments || hasRecords,
            investigations: hasInvestigations,
            prescriptions: hasPrescriptions,
            vitals: hasVitals,
          },
          counts: {
            records: epDocs.length,
            documents: epDocs.length,
            prescriptions: totalRxMeds,
            investigations: epLabs.length,
            consents: activeConsentsCount,
            conversations: epConvs.length,
            assessments: epAsms.length,
          },
          // Include lightweight summary preview if available
          preview: {
            conversations: epConvs.map((c) => ({
              id: c._id,
              channel: c.channel,
              status: c.status,
              hasClinicalOutput: Boolean(c.clinicalOutput),
            })),
            documentCodes: epDocs.map((d) => d.documentCode || d._id),
          },
        };
      });

      const response: ApiResponse = { success: true, data: enrichedEpisodes };
      return res.status(200).json(response);
    }

    // Doctor view
    const episodes = await Episode.find({ doctorId: userId })
      .populate('patientId')
      .sort({ startedAt: -1, createdAt: -1 });

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

    const episode = await Episode.findOne(query).populate('doctorId', 'name email department room');

    if (!episode) {
      const response: ApiResponse = { success: false, message: 'Episode not found or unauthorized' };
      return res.status(404).json(response);
    }

    // Fetch related child records for detailed episode navigation
    const [conversations, documents, assessments, prescriptions, labResults, consents] =
      await Promise.all([
        Conversation.find({ episodeId: episode._id }).sort({ createdAt: -1 }),
        MedicalDocument.find({
          $or: [{ episodeId: episode._id }, { patientId: episode.patientId }],
        }).sort({ createdAt: -1 }),
        Assessment.find({ episodeId: episode._id }).sort({ createdAt: -1 }),
        Prescription.find({ episodeId: episode._id }).sort({ createdAt: -1 }),
        LabResult.find({ episodeId: episode._id }).sort({ createdAt: -1 }),
        Consent.find({ patientId: episode.patientId, status: 'GRANTED' }).sort({ createdAt: -1 }),
      ]);

    const resolved = resolvePatientChiefComplaint(episode.toObject(), conversations, documents);
    const detailedData = {
      ...episode.toObject(),
      episodeId: episode._id,
      chiefComplaint: resolved.chiefComplaint,
      duration: resolved.duration,
      conversations,
      documents,
      assessments,
      prescriptions,
      labResults,
      consents,
    };

    const response: ApiResponse = { success: true, data: detailedData };
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
