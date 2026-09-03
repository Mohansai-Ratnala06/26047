import { Request, Response } from 'express';
import Assessment from '../models/Assessment';
import Episode from '../models/Episode';
import Patient from '../models/Patient';
import { generateCode } from '../utils/codeGenerator';
import { ApiResponse } from '../types';

const resolvePatientId = async (userId: string) => {
  const patient = await Patient.findOne({ userId }).select('_id');
  return patient?._id;
};

export const createAssessment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId, assessmentType, findings, prescriptionSummary, consultationSummary } = req.body;

    // Verify episode belongs to patient
    const episode = await Episode.findOne({ _id: episodeId, patientId });
    if (!episode) {
      const response: ApiResponse = { success: false, message: 'Episode not found or unauthorized' };
      return res.status(404).json(response);
    }

    const assessmentCode = await generateCode('ASM');
    const assessment = new Assessment({
      assessmentCode,
      patientId,
      episodeId,
      assessmentType,
      findings,
      prescriptionSummary,
      consultationSummary,
      status: 'draft',
    });
    await assessment.save();

    const response: ApiResponse = { success: true, data: assessment };
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const getAssessmentsByEpisode = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { episodeId } = req.params;
    const assessments = await Assessment.find({ episodeId, patientId }).sort({ createdAt: -1 });

    const response: ApiResponse = { success: true, data: assessments };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};

export const updateAssessment = async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const userId = (req as any).user.id;
    const patientId = await resolvePatientId(userId);

    if (!patientId) {
      const response: ApiResponse = { success: false, message: 'Patient profile not found' };
      return res.status(404).json(response);
    }

    const { findings, prescriptionSummary, workedMedicine, timeTaken, consultationSummary, status } = req.body;

    const updateData: Record<string, any> = {};
    if (findings !== undefined) updateData.findings = findings;
    if (prescriptionSummary !== undefined) updateData.prescriptionSummary = prescriptionSummary;
    if (workedMedicine !== undefined) updateData.workedMedicine = workedMedicine;
    if (timeTaken !== undefined) updateData.timeTaken = timeTaken;
    if (consultationSummary !== undefined) updateData.consultationSummary = consultationSummary;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') updateData.completedAt = new Date();
    }

    const assessment = await Assessment.findOneAndUpdate(
      { _id: assessmentId, patientId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!assessment) {
      const response: ApiResponse = { success: false, message: 'Assessment not found or unauthorized' };
      return res.status(404).json(response);
    }

    const response: ApiResponse = { success: true, data: assessment };
    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, message: error.message };
    res.status(500).json(response);
  }
};
