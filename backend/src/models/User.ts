import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  phone: string;
  email?: string;
  passwordHash: string;
  abhaId?: string;
  role: 'patient' | 'doctor' | 'admin';
  onboardingCompleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    abhaId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
