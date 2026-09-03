import { Doctor, IDoctor } from '../models/Doctor';

/**
 * All Doctor collection queries live here — nowhere else.
 * Never mixed with user.repository or the users collection.
 */
export const doctorRepository = {
  findByEmail: (email: string): Promise<IDoctor | null> =>
    Doctor.findOne({ email: email.toLowerCase().trim() }),

  findById: (id: string): Promise<IDoctor | null> =>
    Doctor.findById(id),
};
