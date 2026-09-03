import { IProfileService, PatientProfile, OnboardingData } from './profile.types';
import { healthProfileApi } from '../../api/healthProfileApi';
import { patientApi } from '../../api/patientApi';

class RealProfileService implements IProfileService {
  async getProfile(_userId: string): Promise<PatientProfile | null> {
    try {
      const response = await healthProfileApi.getProfile();
      return response?.success ? response.data : null;
    } catch (e) {
      console.log('Failed to fetch profile', e);
      return null;
    }
  }

  async updateProfile(_userId: string, data: Partial<OnboardingData>): Promise<PatientProfile> {
    try {
      const response = await healthProfileApi.updateProfile(data);
      if (response?.success) {
        if (data.basicIdentity) {
          try {
            await patientApi.updateMe({
              dateOfBirth: data.basicIdentity.dateOfBirth,
              gender: data.basicIdentity.gender,
            });
          } catch {
            // Non-fatal: patient record may not exist yet
          }
        }
        return response.data;
      }
      throw new Error(response?.message || 'Update failed');
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}

export const profileService = new RealProfileService();
export default profileService;
