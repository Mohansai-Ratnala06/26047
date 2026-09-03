import { Schema, model, Document } from 'mongoose';

export interface IDoctor extends Document {
  name: string;
  email: string;
  passwordHash: string;
  department: string;
  room: string;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    department: { type: String, required: true, trim: true },
    room: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'doctors' }
);

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
export default Doctor;
