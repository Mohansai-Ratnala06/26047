import mongoose, { Schema, Document, Types } from 'mongoose';

export type ConsentStatus = 'PENDING' | 'GRANTED' | 'REVOKED' | 'EXPIRED';

export interface IConsent extends Document {
  patientId: Types.ObjectId;
  consentCode: string;
  grantedTo: Types.ObjectId;
  purpose: string;
  scope?: string;
  status: ConsentStatus;
  version: number;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
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
      required: true,
    },
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
  },
  { timestamps: true }
);

ConsentSchema.index({ patientId: 1, status: 1 });
ConsentSchema.index({ consentCode: 1 }, { unique: true });
ConsentSchema.index({ grantedTo: 1 });

export default mongoose.model<IConsent>('Consent', ConsentSchema);
