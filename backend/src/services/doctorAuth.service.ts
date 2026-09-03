import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { doctorRepository } from '../repositories/doctor.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface DoctorLoginResult {
  token: string;
  doctor: {
    id: string;
    name: string;
    email: string;
    department: string;
    room: string;
    role: 'doctor';
  };
}

export const doctorAuthService = {
  /**
   * Verify doctor credentials and return a signed JWT if valid.
   * Calls doctor.repository only — never touches the users collection.
   */
  async login(email: string, password: string): Promise<DoctorLoginResult> {
    const doctor = await doctorRepository.findByEmail(email);
    if (!doctor) {
      throw new Error('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(password, doctor.passwordHash);
    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    const payload = {
      id: doctor._id.toString(),
      email: doctor.email,
      name: doctor.name,
      department: doctor.department,
      room: doctor.room,
      role: 'doctor',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    return {
      token,
      doctor: {
        id: doctor._id.toString(),
        name: doctor.name,
        email: doctor.email,
        department: doctor.department,
        room: doctor.room,
        role: 'doctor',
      },
    };
  },
};
