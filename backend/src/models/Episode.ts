import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISymptom {
  name: string;
  onset?: Date;
  duration?: string;
  severity?: number;
  description?: string;
}

export interface ITriage {
  level: 'low' | 'moderate' | 'high' | 'urgent';
  redFlags?: string[];
  evaluatedAt?: Date;
}

export type EpisodeType = 'symptom' | 'consultation' | 'followup' | 'chronic_condition' | 'emergency';
export type EpisodeStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';

export interface IRemedyTracked {
  remedyName: string;
  recordId?: string;
  status: 'suggested' | 'taken' | 'in_progress' | 'discontinued';
  reliefReported?: 'significant_relief' | 'partial_relief' | 'no_change' | 'worsened' | 'pending';
  patientFeedback?: string;
  lastReportedAt?: Date;
}

export interface IPatientConsent {
  consented: boolean;
  consentedAt: Date;
  scope?: string;
  version?: string;
}

export interface IEpisode extends Document {
  patientId: Types.ObjectId;
  episodeCode: string;
  type: EpisodeType;
  chiefComplaint: string;
  symptoms: ISymptom[];
  triage?: ITriage;
  doctorId?: Types.ObjectId;
  clinicalNotes?: string;
  clinicalOutput?: Record<string, any>;
  remediesTracked?: IRemedyTracked[];
  patientConsent?: IPatientConsent;
  status: EpisodeStatus;
  startedAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    episodeCode: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['symptom', 'consultation', 'followup', 'chronic_condition', 'emergency'],
      default: 'symptom',
    },
    chiefComplaint: { type: String, required: true },
    symptoms: [
      {
        name: { type: String, required: true },
        onset: { type: Date },
        duration: { type: String },
        severity: { type: Number, min: 1, max: 10 },
        description: { type: String },
      },
    ],
    triage: {
      level: { type: String, enum: ['low', 'moderate', 'high', 'urgent'] },
      redFlags: [{ type: String }],
      evaluatedAt: { type: Date },
    },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    clinicalNotes: { type: String },
    clinicalOutput: { type: Schema.Types.Mixed },
    remediesTracked: [
      {
        remedyName: { type: String, required: true },
        recordId: { type: String },
        status: {
          type: String,
          enum: ['suggested', 'taken', 'in_progress', 'discontinued'],
          default: 'suggested',
        },
        reliefReported: {
          type: String,
          enum: ['significant_relief', 'partial_relief', 'no_change', 'worsened', 'pending'],
          default: 'pending',
        },
        patientFeedback: { type: String },
        lastReportedAt: { type: Date, default: Date.now },
      },
    ],
    patientConsent: {
      consented: { type: Boolean, default: true },
      consentedAt: { type: Date, default: Date.now },
      scope: { type: String, default: 'clinical_intake_and_triage' },
      version: { type: String, default: '1.0' },
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'escalated', 'closed'],
      default: 'open',
    },
    startedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

EpisodeSchema.index({ patientId: 1, status: 1 });
EpisodeSchema.index({ patientId: 1, createdAt: -1 });

export default mongoose.model<IEpisode>('Episode', EpisodeSchema);
