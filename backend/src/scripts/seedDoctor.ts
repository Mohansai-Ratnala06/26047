/**
 * Seed script — creates the demo Doctor record (Dr. Meera Rao) in the doctors collection.
 * Idempotent: skips creation if the email already exists.
 *
 * Usage:
 *   npx ts-node src/scripts/seedDoctor.ts
 *   (or: npm run seed:doctor — add to package.json scripts if needed)
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Doctor } from '../models/Doctor';

const DEMO_DOCTOR = {
  name: 'Dr. Meera Rao',
  email: 'meera.rao@vaidyaarc.health',
  password: 'doctor@1234',      // plaintext — will be hashed below
  department: 'Cardiology',
  room: 'Room 4',
};

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌  MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  const existing = await Doctor.findOne({ email: DEMO_DOCTOR.email });
  if (existing) {
    console.log(`ℹ️   Doctor already exists: ${existing.email} — skipping.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_DOCTOR.password, 12);
  await Doctor.create({
    name: DEMO_DOCTOR.name,
    email: DEMO_DOCTOR.email,
    passwordHash,
    department: DEMO_DOCTOR.department,
    room: DEMO_DOCTOR.room,
  });

  console.log(`✅  Seeded doctor: ${DEMO_DOCTOR.name} (${DEMO_DOCTOR.email})`);
  console.log(`   Login with password: ${DEMO_DOCTOR.password}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
