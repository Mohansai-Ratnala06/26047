import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChronicCondition {
  condition: string;
  status: 'active' | 'resolved' | 'unknown';
  diagnosedAt?: Date;
  sourceEpisodeId?: Types.ObjectId;
  notes?: string;
}

export interface IAllergy {
  substance: string;
  reaction?: string;
  severity?: string;
  verified?: boolean;
  sourceEpisodeId?: Types.ObjectId;
}

export interface IMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  purpose?: string;
  startDate?: Date;
  endDate?: Date;
  status: 'current' | 'stopped' | 'unknown';
  sourceEpisodeId?: Types.ObjectId;
}

export interface ISurgery {
  procedure: string;
  date?: Date;
  hospital?: string;
  notes?: string;
  sourceEpisodeId?: Types.ObjectId;
}

export interface IFamilyHistory {
  condition: string;
  relation: string;
  notes?: string;
}

export interface ILifestyle {
  diet?: string;
  smoking?: string;
  alcohol?: string;
  physicalActivity?: string;
  occupation?: string;
  sleep?: string;
}

export interface IAyurvedaProfile {
  prakriti?: string;
  vikriti?: string;
  agni?: string;
  koshtha?: string;
  sara?: string;
  samhanana?: string;
  pramana?: string;
  satmya?: string;
  sattva?: string;
  aharaShakti?: string;
  vyayamaShakti?: string;
  vaya?: string;
}

export interface IHealthProfile extends Document {
  patientId: Types.ObjectId;
  chronicConditions: IChronicCondition[];
  allergies: IAllergy[];
  medications: IMedication[];
  surgeries: ISurgery[];
  familyHistory: IFamilyHistory[];
  lifestyle: ILifestyle;
  ayurvedaProfile: IAyurvedaProfile;
  summaryVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const HealthProfileSchema = new Schema<IHealthProfile>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true,
    },
    chronicConditions: [
      {
        condition: { type: String, required: true },
        status: { type: String, enum: ['active', 'resolved', 'unknown'], default: 'unknown' },
        diagnosedAt: { type: Date },
        sourceEpisodeId: { type: Schema.Types.ObjectId, ref: 'Episode' },
        notes: { type: String },
      },
    ],
    allergies: [
      {
        substance: { type: String, required: true },
        reaction: { type: String },
        severity: { type: String },
        verified: { type: Boolean, default: false },
        sourceEpisodeId: { type: Schema.Types.ObjectId, ref: 'Episode' },
      },
    ],
    medications: [
      {
        name: { type: String, required: true },
        dosage: { type: String },
        frequency: { type: String },
        route: { type: String },
        purpose: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        status: { type: String, enum: ['current', 'stopped', 'unknown'], default: 'unknown' },
        sourceEpisodeId: { type: Schema.Types.ObjectId, ref: 'Episode' },
      },
    ],
    surgeries: [
      {
        procedure: { type: String, required: true },
        date: { type: Date },
        hospital: { type: String },
        notes: { type: String },
        sourceEpisodeId: { type: Schema.Types.ObjectId, ref: 'Episode' },
      },
    ],
    familyHistory: [
      {
        condition: { type: String, required: true },
        relation: { type: String, required: true },
        notes: { type: String },
      },
    ],
    lifestyle: {
      diet: { type: String },
      smoking: { type: String },
      alcohol: { type: String },
      physicalActivity: { type: String },
      occupation: { type: String },
      sleep: { type: String },
    },
    ayurvedaProfile: {
      prakriti: { type: String },
      vikriti: { type: String },
      agni: { type: String },
      koshtha: { type: String },
      sara: { type: String },
      samhanana: { type: String },
      pramana: { type: String },
      satmya: { type: String },
      sattva: { type: String },
      aharaShakti: { type: String },
      vyayamaShakti: { type: String },
      vaya: { type: String },
    },
    summaryVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

HealthProfileSchema.index({ patientId: 1 }, { unique: true });

export default mongoose.model<IHealthProfile>('HealthProfile', HealthProfileSchema);
