import mongoose, { Schema, Document, Types } from 'mongoose';

export type DocumentType =
  | 'prescription'
  | 'laboratory_report'
  | 'discharge_summary'
  | 'imaging'
  | 'consultation_note'
  | 'other';

export type ExtractionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs_review';

export type VerificationStatus = 'unverified' | 'reviewed' | 'verified';

export interface IMedicalDocument extends Document {
  documentCode: string;
  patientId: Types.ObjectId;
  episodeId?: Types.ObjectId;
  documentType: DocumentType;
  source: {
    hospital?: string;
    doctor?: string;
    documentDate?: Date;
  };
  storage: {
    provider: string;
    bucket: string;
    key: string;
    contentType?: string;
    size?: number;
  };
  extractionStatus: ExtractionStatus;
  extractedData: {
    diagnoses?: string[];
    medications?: string[];
    investigations?: string[];
    procedures?: string[];
    abnormalValues?: string[];
  };
  ocrMetadata?: {
    language?: string;
    confidence?: number;
    model?: string;
  };
  verification: {
    status: VerificationStatus;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MedicalDocumentSchema = new Schema<IMedicalDocument>(
  {
    documentCode: {
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
    },
    documentType: {
      type: String,
      enum: ['prescription', 'laboratory_report', 'discharge_summary', 'imaging', 'consultation_note', 'other'],
      required: true,
    },
    source: {
      hospital: { type: String },
      doctor: { type: String },
      documentDate: { type: Date },
    },
    storage: {
      provider: { type: String, default: 's3' },
      bucket: { type: String, required: true },
      key: { type: String, required: true },
      contentType: { type: String },
      size: { type: Number },
    },
    extractionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'needs_review'],
      default: 'pending',
    },
    extractedData: {
      diagnoses: [{ type: String }],
      medications: [{ type: String }],
      investigations: [{ type: String }],
      procedures: [{ type: String }],
      abnormalValues: [{ type: String }],
    },
    ocrMetadata: {
      language: { type: String },
      confidence: { type: Number },
      model: { type: String },
    },
    verification: {
      status: {
        type: String,
        enum: ['unverified', 'reviewed', 'verified'],
        default: 'unverified',
      },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
    },
  },
  { timestamps: true }
);

MedicalDocumentSchema.index({ patientId: 1 });
MedicalDocumentSchema.index({ episodeId: 1 });
MedicalDocumentSchema.index({ documentCode: 1 }, { unique: true });

export default mongoose.model<IMedicalDocument>('MedicalDocument', MedicalDocumentSchema);
