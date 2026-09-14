import { useLanguageStore } from './languageStore';
import { LANGUAGE_OPTIONS, SupportedLanguage, LanguageOption } from './types';

export const useTranslation = () => {
  const currentLanguage = useLanguageStore((state) => state.currentLanguage);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const cycleLanguage = useLanguageStore((state) => state.cycleLanguage);
  const t = useLanguageStore((state) => state.t);
  const getGreeting = useLanguageStore((state) => state.getGreeting);
  const getTimeOfDay = useLanguageStore((state) => state.getTimeOfDay);

  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.code === currentLanguage) || LANGUAGE_OPTIONS[0];

  return {
    currentLanguage,
    setLanguage,
    cycleLanguage,
    t,
    getGreeting,
    timeOfDay: getTimeOfDay(),
    isEnglish: currentLanguage === 'en',
    isTelugu: currentLanguage === 'te',
    isHindi: currentLanguage === 'hi',
    languageOptions: LANGUAGE_OPTIONS,
    currentOption,
  };
};
