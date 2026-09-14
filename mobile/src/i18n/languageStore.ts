import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, TimeOfDay, LANGUAGE_OPTIONS } from './types';
import { translations } from './translations';
import { patientApi } from '../api/patientApi';

const STORAGE_KEY = '@vaidyaarc_language';

export interface GreetingInfo {
  greeting: string;
  fullGreeting: string;
  timeOfDay: TimeOfDay;
}

interface LanguageState {
  currentLanguage: SupportedLanguage;
  isHydrated: boolean;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  cycleLanguage: () => Promise<void>;
  hydrateLanguage: () => Promise<void>;
  t: (path: string, fallback?: string) => string;
  getTimeOfDay: () => TimeOfDay;
  getGreeting: (name?: string) => GreetingInfo;
}

// Nested key resolver helper (e.g. 'home.heroTagline')
function resolveKey(obj: any, path: string): string | null {
  if (!obj) return null;
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = current[part];
  }
  return typeof current === 'string' ? current : null;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: 'en',
  isHydrated: false,

  hydrateLanguage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'te' || stored === 'hi') {
        set({ currentLanguage: stored, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  setLanguage: async (lang: SupportedLanguage) => {
    // 1. Instantly update in-memory state so UI updates on the spot
    set({ currentLanguage: lang });

    // 2. Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to persist language to AsyncStorage:', e);
    }

    // 3. Silently sync with backend if online
    try {
      patientApi.updateMe({ preferences: { preferredLanguage: lang } }).catch(() => {});
    } catch {}
  },

  cycleLanguage: async () => {
    const order: SupportedLanguage[] = ['en', 'te', 'hi'];
    const current = get().currentLanguage;
    const currentIndex = order.indexOf(current);
    const nextLang = order[(currentIndex + 1) % order.length];
    await get().setLanguage(nextLang);
  },

  t: (path: string, fallback?: string): string => {
    const lang = get().currentLanguage;
    const localizedVal = resolveKey(translations[lang], path);
    if (localizedVal) return localizedVal;

    // Fallback to English
    const englishVal = resolveKey(translations['en'], path);
    if (englishVal) return englishVal;

    return fallback ?? path;
  },

  getTimeOfDay: (): TimeOfDay => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  },

  getGreeting: (name?: string): GreetingInfo => {
    const timeOfDay = get().getTimeOfDay();
    const lang = get().currentLanguage;
    const dict = translations[lang].greetings;
    const greeting = dict[timeOfDay];

    const cleanName = name?.trim();
    const fullGreeting = cleanName ? `${greeting}, ${cleanName}` : greeting;

    return {
      greeting,
      fullGreeting,
      timeOfDay,
    };
  },
}));

// Auto-hydrate language on module load
useLanguageStore.getState().hydrateLanguage();
