import mongoose, { Schema, Document, Types } from 'mongoose';

export type PrescriptionStatus = 'active' | 'completed' | 'cancelled';

export interface IPrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  instructions?: string;
}

export interface IPrescription extends Document {
  prescriptionCode: string;
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  assessmentId?: Types.ObjectId;
  prescribedBy?: Types.ObjectId;
  medications: IPrescriptionMedication[];
  notes?: string;
  status: PrescriptionStatus;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionSchema = new Schema<IPrescription>(
  {
    prescriptionCode: {
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
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
    },
    prescribedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    medications: [
      {
        name: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        route: { type: String },
        duration: { type: String },
        instructions: { type: String },
      },
    ],
    notes: { type: String },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PrescriptionSchema.index({ patientId: 1 });
PrescriptionSchema.index({ episodeId: 1 });
PrescriptionSchema.index({ prescriptionCode: 1 }, { unique: true });

export default mongoose.model<IPrescription>('Prescription', PrescriptionSchema);
