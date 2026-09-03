import Counter from '../models/Counter';

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

export const generateCode = async (prefix: CodePrefix): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterNames[prefix] },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const padded = String(counter.seq).padStart(6, '0');
  return `${prefix}-${padded}`;
};
