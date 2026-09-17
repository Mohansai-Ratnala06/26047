import Counter from '../models/Counter';
import Patient from '../models/Patient';
import { Types } from 'mongoose';

type CodePrefix = 'PAT' | 'EP' | 'DOC' | 'ASM' | 'RX' | 'CON' | 'CNV';

const counterNames: Record<CodePrefix, string> = {
  PAT: 'patient',
  EP: 'episode',
  DOC: 'document',
  ASM: 'assessment',
  RX: 'prescription',
  CON: 'consent',
  CNV: 'conversation',
};

export const generateCode = async (
  prefix: CodePrefix,
  patientId?: string | Types.ObjectId
): Promise<string> => {
  // If prefix is 'PAT' or no patientId is provided, generate a global sequential code (e.g. PAT-000001, EP-000001)
  if (!patientId || prefix === 'PAT') {
    const counter = await Counter.findOneAndUpdate(
      { _id: counterNames[prefix] },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const padded = String(counter.seq).padStart(6, '0');
    return `${prefix}-${padded}`;
  }

  // When patientId is provided for EP, DOC, ASM, RX, CON, CNV:
  // 1. Resolve patient identifier tag (e.g. PAT-000001 -> P0001)
  let pTag = 'P0001';
  try {
    const patient = await Patient.findById(patientId).select('patientCode').lean();
    if (patient?.patientCode) {
      const match = patient.patientCode.match(/\d+/);
      if (match) {
        const pNum = parseInt(match[0], 10);
        pTag = `P${String(pNum).padStart(4, '0')}`;
      } else {
        pTag = patient.patientCode.replace(/[^A-Za-z0-9]/g, '');
      }
    } else {
      pTag = `P${String(patientId).slice(-4).toUpperCase()}`;
    }
  } catch {
    pTag = `P${String(patientId).slice(-4).toUpperCase()}`;
  }

  // 2. Patient-scoped counter key
  const counterKey = `pat_${patientId.toString()}_${counterNames[prefix]}`;

  // Find or initialize counter based on existing count for this patient
  let counter = await Counter.findById(counterKey);
  let nextSeq = 1;

  if (!counter) {
    let existingCount = 0;
    try {
      if (prefix === 'EP') {
        const Episode = (await import('../models/Episode')).default;
        existingCount = await Episode.countDocuments({ patientId });
      } else if (prefix === 'DOC') {
        const MedicalDocument = (await import('../models/MedicalDocument')).default;
        existingCount = await MedicalDocument.countDocuments({ patientId });
      } else if (prefix === 'ASM') {
        const Assessment = (await import('../models/Assessment')).default;
        existingCount = await Assessment.countDocuments({ patientId });
      } else if (prefix === 'RX') {
        const Prescription = (await import('../models/Prescription')).default;
        existingCount = await Prescription.countDocuments({ patientId });
      } else if (prefix === 'CON') {
        const Consent = (await import('../models/Consent')).default;
        existingCount = await Consent.countDocuments({ patientId });
      }
    } catch {
      existingCount = 0;
    }

    nextSeq = existingCount + 1;
    counter = await Counter.findByIdAndUpdate(
      counterKey,
      { $set: { seq: nextSeq } },
      { new: true, upsert: true }
    );
  } else {
    counter = await Counter.findByIdAndUpdate(
      counterKey,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    nextSeq = counter?.seq ?? (nextSeq + 1);
  }

  let seqPadded = String(nextSeq).padStart(2, '0');
  let candidateCode = `${prefix}-${pTag}-${seqPadded}`;

  // Defensive uniqueness check: ensure candidate code is unique in DB
  try {
    let isDuplicate = false;
    let attempts = 0;
    do {
      if (prefix === 'EP') {
        const Episode = (await import('../models/Episode')).default;
        isDuplicate = Boolean(await Episode.exists({ episodeCode: candidateCode }));
      } else if (prefix === 'DOC') {
        const MedicalDocument = (await import('../models/MedicalDocument')).default;
        isDuplicate = Boolean(await MedicalDocument.exists({ documentCode: candidateCode }));
      }

      if (isDuplicate) {
        nextSeq++;
        seqPadded = String(nextSeq).padStart(2, '0');
        candidateCode = `${prefix}-${pTag}-${seqPadded}`;
        await Counter.findByIdAndUpdate(counterKey, { $set: { seq: nextSeq } });
        attempts++;
      }
    } while (isDuplicate && attempts < 20);
  } catch {
    // If check fails, candidateCode is used
  }

  return candidateCode;
};
