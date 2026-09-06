import mongoose, { Schema, Document, Types } from 'mongoose';

export type ConversationChannel = 'voice' | 'text' | 'kiosk' | 'mobile' | 'web';
export type ConversationStatus = 'active' | 'completed' | 'abandoned';

export interface IConversation extends Document {
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  channel: ConversationChannel;
  language: string;
  status: ConversationStatus;
  startedAt: Date;
  completedAt?: Date;
  stateSnapshot?: Record<string, any>;
  clinicalStatus?: string;
  immediateAttentionRequired?: boolean;
  clinicalOutput?: Record<string, any>;
  metadata: {
    aiModel?: string;
    modelVersion?: string;
    workflowVersion?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
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
    channel: {
      type: String,
      enum: ['voice', 'text', 'kiosk', 'mobile', 'web'],
      default: 'text',
    },
    language: { type: String, default: 'en' },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    stateSnapshot: { type: Schema.Types.Mixed },
    clinicalStatus: { type: String },
    immediateAttentionRequired: { type: Boolean, default: false },
    clinicalOutput: { type: Schema.Types.Mixed },
    metadata: {
      aiModel: { type: String },
      modelVersion: { type: String },
      workflowVersion: { type: String },
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ episodeId: 1 });
ConversationSchema.index({ patientId: 1, status: 1 });

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
