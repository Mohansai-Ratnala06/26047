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
      // 1. Prepare structured HealthProfile payload
      const healthProfilePayload: any = {};

      if (data.medicinesAllergies?.allergies) {
        healthProfilePayload.allergies = data.medicinesAllergies.allergies
          .filter((a) => a && !a.toLowerCase().includes('no known'))
          .map((substance) => ({
            substance,
            severity: 'moderate',
            verified: true,
          }));
      }

      if (data.medicinesAllergies?.chronicConditions) {
        healthProfilePayload.chronicConditions = data.medicinesAllergies.chronicConditions
          .filter((c) => c && !c.toLowerCase().includes('none'))
          .map((condition) => ({
            condition,
            status: 'active',
          }));
      }

      if (data.medicinesAllergies?.medicines) {
        healthProfilePayload.medications = data.medicinesAllergies.medicines.map((name) => ({
          name,
          status: 'current',
        }));
      }

      if (data.lifestyle) {
        healthProfilePayload.lifestyle = {
          physicalActivity: data.lifestyle.activityLevel,
          diet: data.lifestyle.dietPreference,
          smoking: data.lifestyle.tobaccoUse,
          alcohol: data.lifestyle.alcoholUse,
        };
      }

      const response = await healthProfileApi.updateProfile(healthProfilePayload);

      // 2. Persist real demographics & preferences to Patient record
      if (data.basicIdentity || data.communication) {
        try {
          const nameParts = (data.basicIdentity?.preferredName || '').trim().split(/\s+/);
          const firstName = nameParts[0] || undefined;
          const lastName = nameParts.slice(1).join(' ') || undefined;

          // Compute age if DOB is provided
          let computedAge = data.basicIdentity?.age;
          if (!computedAge && data.basicIdentity?.dateOfBirth) {
            const birthDate = new Date(data.basicIdentity.dateOfBirth);
            if (!isNaN(birthDate.getTime())) {
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const m = today.getMonth() - birthDate.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              if (age >= 0) computedAge = age;
            }
          }

          const patientPayload: any = {
            demographics: {
              firstName,
              lastName,
              gender: data.basicIdentity?.gender ? data.basicIdentity.gender.toLowerCase() : undefined,
              dateOfBirth: data.basicIdentity?.dateOfBirth ? new Date(data.basicIdentity.dateOfBirth) : undefined,
              age: computedAge,
              bloodGroup: data.basicIdentity?.bloodGroup,
            },
            preferences: {
              preferredCommunicationMode: data.communication?.interactionPreference,
              accessibilityRequirements: data.communication?.accessibility,
              preferredLanguage: data.communication?.preferredLanguage,
            },
          };

          await patientApi.updateMe(patientPayload);
        } catch (patientErr) {
          console.error('[ProfileService] Failed to update patient demographics:', patientErr);
        }
      }

      return response?.success ? response.data : ({} as PatientProfile);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}

export const profileService = new RealProfileService();
export default profileService;
