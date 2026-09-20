export interface PatientProfile {
  id: string;
  userId: string;
  onboardingVersion: number;
  basicIdentity?: {
    preferredName?: string;
    dateOfBirth?: string;
    gender?: string;
    age?: number;
    bloodGroup?: string;
  };
  communication?: {
    preferredLanguage?: string;
    interactionPreference?: string;
    accessibility?: string[];
  };
  medicinesAllergies?: {
    usesRegularMedicines?: boolean;
    medicines?: string[];
    allergies?: string[];
    chronicConditions?: string[];
  };
  lifestyle?: {
    activityLevel?: string;
    dietPreference?: string;
    tobaccoUse?: string;
    alcoholUse?: string;
  };
  healthcarePreferences?: {
    system?: string;
  };
  healthGoals?: string[];
  updatedAt: string;
}

export type OnboardingData = Omit<PatientProfile, 'id' | 'userId' | 'onboardingVersion' | 'updatedAt'>;

export interface IProfileService {
  getProfile(userId: string): Promise<PatientProfile | null>;
  updateProfile(userId: string, data: Partial<OnboardingData>): Promise<PatientProfile>;
}
