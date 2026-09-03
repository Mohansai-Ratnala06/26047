import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPatientAddress {
  line1?: string;
  line2?: string;
  village?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface IExternalPatientId {
  system: string;
  value: string;
}

export interface IPatient extends Document {
  userId: Types.ObjectId;
  patientCode: string;
  demographics: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    age?: number;
    gender?: string;
    bloodGroup?: string;
  };
  contact: {
    phone?: string;
    email?: string;
    address?: IPatientAddress;
  };
  preferences: {
    preferredLanguage?: string;
    preferredCommunicationMode?: string;
    accessibilityRequirements?: string[];
  };
  identifiers: {
    abhaId?: string;
    externalPatientIds?: IExternalPatientId[];
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    patientCode: {
      type: String,
      required: true,
      unique: true,
    },
    demographics: {
      firstName: { type: String },
      lastName: { type: String },
      dateOfBirth: { type: Date },
      age: { type: Number },
      gender: { type: String },
      bloodGroup: { type: String },
    },
    contact: {
      phone: { type: String },
      email: { type: String },
      address: {
        line1: { type: String },
        line2: { type: String },
        village: { type: String },
        district: { type: String },
        state: { type: String },
        country: { type: String },
        pincode: { type: String },
      },
    },
    preferences: {
      preferredLanguage: { type: String, default: 'en' },
      preferredCommunicationMode: { type: String },
      accessibilityRequirements: [{ type: String }],
    },
    identifiers: {
      abhaId: { type: String },
      externalPatientIds: [
        {
          system: { type: String },
          value: { type: String },
        },
      ],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

PatientSchema.index({ userId: 1 }, { unique: true });
PatientSchema.index({ patientCode: 1 }, { unique: true });
PatientSchema.index({ 'identifiers.abhaId': 1 }, { sparse: true });

export default mongoose.model<IPatient>('Patient', PatientSchema);
