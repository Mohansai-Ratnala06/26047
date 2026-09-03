import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageRole = 'patient' | 'assistant' | 'system' | 'clinician';
export type MessageInputType = 'voice' | 'text' | 'button' | 'option';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  patientId: Types.ObjectId;
  episodeId: Types.ObjectId;
  role: MessageRole;
  inputType: MessageInputType;
  language: string;
  content: string;
  structuredData?: Record<string, any>;
  audioS3Key?: string;
  timestamp: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
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
    role: {
      type: String,
      enum: ['patient', 'assistant', 'system', 'clinician'],
      required: true,
    },
    inputType: {
      type: String,
      enum: ['voice', 'text', 'button', 'option'],
      default: 'text',
    },
    language: { type: String, default: 'en' },
    content: { type: String, required: true },
    structuredData: { type: Schema.Types.Mixed },
    audioS3Key: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  // No timestamps needed — we use the explicit `timestamp` field
  { timestamps: false }
);

MessageSchema.index({ conversationId: 1, timestamp: 1 });
MessageSchema.index({ patientId: 1 });
MessageSchema.index({ episodeId: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
