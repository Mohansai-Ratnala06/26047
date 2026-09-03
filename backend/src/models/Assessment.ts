import mongoose, { Schema, Document, Types } from 'mongoose';

export type AssessmentType = 'ai_triage' | 'clinical_review' | 'follow_up_assessment' | 'discharge';
export type AssessmentStatus = 'draft' | 'in_progress' | 'completed' | 'reviewed';

export interface IAssessment extends Document {
  assessmentCode: string;
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  assessmentType: AssessmentType;
  findings: string;
  prescriptionSummary?: string;
  workedMedicine?: string;
  timeTaken?: string;
  consultationSummary?: string;
  status: AssessmentStatus;
  completedAt?: Date;
  assessedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>(
  {
    assessmentCode: {
      type: String,
      required: true,
      unique: true,
    },
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
    assessmentType: {
      type: String,
      enum: ['ai_triage', 'clinical_review', 'follow_up_assessment', 'discharge'],
      required: true,
    },
    findings: { type: String, required: true },
    prescriptionSummary: { type: String },
    workedMedicine: { type: String },
    timeTaken: { type: String },
    consultationSummary: { type: String },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'completed', 'reviewed'],
      default: 'draft',
    },
    completedAt: { type: Date },
    assessedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AssessmentSchema.index({ patientId: 1 });
AssessmentSchema.index({ episodeId: 1 });
AssessmentSchema.index({ assessmentCode: 1 }, { unique: true });

export default mongoose.model<IAssessment>('Assessment', AssessmentSchema);
