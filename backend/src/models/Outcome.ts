import mongoose, { Schema, Document, Types } from 'mongoose';

export type OutcomeResult = 'improved' | 'resolved' | 'unchanged' | 'worsened' | 'unknown';

export interface IOutcome extends Document {
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  result: OutcomeResult;
  summary?: string;
  patientFeedback?: string;
  clinicianNotes?: string;
  evaluatedAt?: Date;
  evaluatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OutcomeSchema = new Schema<IOutcome>(
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
    result: {
      type: String,
      enum: ['improved', 'resolved', 'unchanged', 'worsened', 'unknown'],
      required: true,
    },
    summary: { type: String },
    patientFeedback: { type: String },
    clinicianNotes: { type: String },
    evaluatedAt: { type: Date },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

OutcomeSchema.index({ patientId: 1 });
OutcomeSchema.index({ episodeId: 1 });

export default mongoose.model<IOutcome>('Outcome', OutcomeSchema);
