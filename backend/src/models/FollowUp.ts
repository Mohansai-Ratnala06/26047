import mongoose, { Schema, Document, Types } from 'mongoose';

export type FollowUpStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

export interface IFollowUp extends Document {
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  scheduledAt: Date;
  completedAt?: Date;
  reason: string;
  assignedTo?: Types.ObjectId;
  status: FollowUpStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
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
    scheduledAt: { type: Date, required: true },
    completedAt: { type: Date },
    reason: { type: String, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'missed', 'cancelled'],
      default: 'scheduled',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

FollowUpSchema.index({ patientId: 1 });
FollowUpSchema.index({ episodeId: 1 });
FollowUpSchema.index({ scheduledAt: 1, status: 1 });

export default mongoose.model<IFollowUp>('FollowUp', FollowUpSchema);
