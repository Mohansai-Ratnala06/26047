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

export type MedicalDocumentStatus =
  | 'pending'
  | 'medical_document'
  | 'not_medical_document'
  | 'unreadable'
  | 'failed';

export interface IMedicalDocument extends Document {
  documentCode: string;
  patientId: Types.ObjectId;
  episodeId?: Types.ObjectId;
  documentType: DocumentType;
  medicalDocumentStatus: MedicalDocumentStatus;
  rejectionReason?: string;
  patientConsent?: {
    consented: boolean;
    consentedAt: Date;
    purpose?: string;
    version?: number;
  };
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
    patientName?: string;
    reportedDate?: string;
    clinicName?: string;
    healthDocumentType?: string;
    diagnoses?: string[];
    immunizations?: string[];
    procedures?: string[];
    medications?: string[];
    investigations?: string[];
    tests?: Array<{
      test_name: string;
      result: string;
      unit?: string | null;
      reference_range?: string | null;
    }>;
    abnormalValues?: string[];
    vitals?: Array<{ parameter: string; value: string; unit?: string | null }>;
    advice?: string[];
  };
  safetyAlerts?: Array<{
    severity: string;
    type: string;
    message: string;
  }>;
  fhirBundle?: any;
  brainAnalysis?: any;
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
    medicalDocumentStatus: {
      type: String,
      enum: ['pending', 'medical_document', 'not_medical_document', 'unreadable', 'failed'],
      default: 'pending',
    },
    rejectionReason: { type: String },
    patientConsent: {
      consented: { type: Boolean, default: false },
      consentedAt: { type: Date },
      purpose: { type: String },
      version: { type: Number, default: 1 },
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
      patientName: { type: String },
      reportedDate: { type: String },
      clinicName: { type: String },
      healthDocumentType: { type: String },
      diagnoses: [{ type: String }],
      immunizations: [{ type: String }],
      procedures: [{ type: String }],
      medications: [{ type: String }],
      investigations: [{ type: String }],
      tests: [
        {
          test_name: { type: String },
          result: { type: String },
          unit: { type: String },
          reference_range: { type: String },
        },
      ],
      abnormalValues: [{ type: String }],
      vitals: [
        {
          parameter: { type: String },
          value: { type: String },
          unit: { type: String },
        },
      ],
      advice: [{ type: String }],
    },
    safetyAlerts: [
      {
        severity: { type: String },
        type: { type: String },
        message: { type: String },
      },
    ],
    fhirBundle: { type: Schema.Types.Mixed },
    brainAnalysis: { type: Schema.Types.Mixed },
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

export default mongoose.model<IMedicalDocument>('MedicalDocument', MedicalDocumentSchema);
