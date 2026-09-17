import fs from 'fs';
import path from 'path';
import mongoose, { Types } from 'mongoose';
import {
  Episode,
  MedicalDocument,
  Conversation,
  Message,
  Assessment,
  FollowUp,
  LabResult,
  Outcome,
  Prescription,
  HealthProfile,
} from '../models';

const storageDir = path.join(process.cwd(), 'uploads', 'documents');
const stagingDir = path.join(process.cwd(), 'tmp', 'uploads');

/**
 * Permanently deletes a clinical episode and all traces of related data:
 * - Associated medical documents (including physical files on disk)
 * - Associated lab results
 * - AI conversations and messages
 * - Clinical assessments
 * - Prescriptions
 * - Follow-ups and outcomes
 * - Health profile entries referencing the episode
 * - The episode record itself
 */
export async function deleteEpisodeAndAssociatedData(
  episodeIdOrCode: string,
  requesterPatientId?: Types.ObjectId | string,
  userRole: string = 'patient',
  userId?: string
): Promise<{ success: boolean; message: string; deletedEpisodeCode: string }> {
  let episode: any = null;

  if (mongoose.Types.ObjectId.isValid(episodeIdOrCode)) {
    episode = await Episode.findById(episodeIdOrCode);
  }
  if (!episode) {
    episode = await Episode.findOne({ episodeCode: episodeIdOrCode });
  }

  if (!episode) {
    throw new Error('Episode not found');
  }

  // Authorization check for patient
  if (userRole === 'patient' && requesterPatientId) {
    if (episode.patientId.toString() !== requesterPatientId.toString()) {
      throw new Error('Unauthorized to delete this episode');
    }
  }

  // Authorization check for doctor
  if (userRole === 'doctor' && userId && episode.doctorId) {
    if (episode.doctorId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this episode');
    }
  }

  const episodeId = episode._id;
  const deletedEpisodeCode = episode.episodeCode;

  // 1. Permanently remove all medical documents and their physical files
  try {
    const linkedDocs = await MedicalDocument.find({ episodeId });
    for (const doc of linkedDocs) {
      const filesToDelete: string[] = [];
      if (doc.storage?.key) {
        const fileName = path.basename(doc.storage.key);
        filesToDelete.push(
          path.join(storageDir, fileName),
          path.join(storageDir, doc.storage.key),
          path.join(stagingDir, fileName),
          path.join(stagingDir, doc.storage.key)
        );
      }
      const storageAny = doc.storage as any;
      if (storageAny?.url && typeof storageAny.url === 'string') {
        const urlFileName = path.basename(storageAny.url);
        filesToDelete.push(
          path.join(storageDir, urlFileName),
          path.join(stagingDir, urlFileName)
        );
      }

      for (const filePath of filesToDelete) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (_) {}
        }
      }

      await LabResult.deleteMany({ documentId: doc._id });
      await MedicalDocument.findByIdAndDelete(doc._id);
    }
  } catch (docErr) {
    console.warn('Warning during episode linked documents deletion:', docErr);
  }

  // 2. Delete conversations and messages
  try {
    const convs = await Conversation.find({ episodeId });
    const convIds = convs.map((c) => c._id);
    if (convIds.length > 0) {
      await Message.deleteMany({ conversationId: { $in: convIds } });
    }
    await Message.deleteMany({ episodeId });
    await Conversation.deleteMany({ episodeId });
  } catch (convErr) {
    console.warn('Warning during episode conversations deletion:', convErr);
  }

  // 3. Delete clinical child entities
  try {
    await Assessment.deleteMany({ episodeId });
    await FollowUp.deleteMany({ episodeId });
    await LabResult.deleteMany({ episodeId });
    await Outcome.deleteMany({ episodeId });
    await Prescription.deleteMany({ episodeId });
  } catch (childErr) {
    console.warn('Warning during episode child entities deletion:', childErr);
  }

  // 4. Clean up any HealthProfile entries sourced from this episode
  try {
    await HealthProfile.updateOne(
      { patientId: episode.patientId },
      {
        $pull: {
          chronicConditions: { sourceEpisodeId: episodeId },
          allergies: { sourceEpisodeId: episodeId },
          medications: { sourceEpisodeId: episodeId },
          surgeries: { sourceEpisodeId: episodeId },
        },
      }
    );
  } catch (hpErr) {
    console.warn('Warning during health profile cleanup for episode:', hpErr);
  }

  // 5. Delete the episode record itself
  await Episode.findByIdAndDelete(episodeId);

  return {
    success: true,
    message: 'Clinical episode and all associated data permanently deleted.',
    deletedEpisodeCode,
  };
}
