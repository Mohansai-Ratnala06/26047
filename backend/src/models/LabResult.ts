import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILabResult extends Document {
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  testName: string;
  testCode?: string;
  result?: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  performedAt?: Date;
  laboratory?: string;
  documentId?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LabResultSchema = new Schema<ILabResult>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    episodeId: {
      type: Schema.Types.ObjectId,
      ref: 'Episode',
      required: true,
    },
    testName: { type: String, required: true },
    testCode: { type: String },
    result: { type: String },
    unit: { type: String },
    referenceRange: { type: String },
    isAbnormal: { type: Boolean },
    performedAt: { type: Date },
    laboratory: { type: String },
    documentId: { type: Schema.Types.ObjectId, ref: 'MedicalDocument' },
    notes: { type: String },
  },
  { timestamps: true }
);

LabResultSchema.index({ patientId: 1 });
LabResultSchema.index({ episodeId: 1 });

export default mongoose.model<ILabResult>('LabResult', LabResultSchema);
