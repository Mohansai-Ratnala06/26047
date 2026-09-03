import { create } from 'zustand';
import { PatientProfile, profileService } from '../services/profile';

interface ProfileState {
  profile: PatientProfile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  error: null,
  fetchProfile: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const data = await profileService.getProfile(userId);
      set({ profile: data, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch profile', loading: false });
    }
  },
}));
