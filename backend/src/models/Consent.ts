import mongoose, { Schema, Document, Types } from 'mongoose';

export type ConsentStatus = 'PENDING' | 'GRANTED' | 'REVOKED' | 'EXPIRED';

export interface IConsent extends Document {
  patientId: Types.ObjectId;
  consentCode: string;
  grantedTo?: Types.ObjectId;
  organizationName?: string;
  facilityName?: string;
  specialty?: string;
  purpose: string;
  scope?: string;
  status: ConsentStatus;
  version: number;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  preConsultationReport?: Record<string, any>;
  documentsShared?: Array<{
    documentId?: string;
    title?: string;
    type?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentSchema = new Schema<IConsent>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    consentCode: {
      type: String,
      required: true,
      unique: true,
    },
    grantedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    organizationName: { type: String },
    facilityName: { type: String },
    specialty: { type: String },
    purpose: { type: String, required: true },
    scope: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'GRANTED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
    },
    version: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    preConsultationReport: { type: Schema.Types.Mixed },
    documentsShared: [
      {
        documentId: { type: String },
        title: { type: String },
        type: { type: String },
      },
    ],
  },
  { timestamps: true }
);

ConsentSchema.index({ patientId: 1, status: 1 });
ConsentSchema.index({ grantedTo: 1 });
ConsentSchema.index({ createdAt: -1 });

export default mongoose.model<IConsent>('Consent', ConsentSchema);
