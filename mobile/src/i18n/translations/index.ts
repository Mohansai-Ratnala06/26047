import { SupportedLanguage, TranslationSchema } from '../types';
import { en } from './en';
import { te } from './te';
import { hi } from './hi';

export const translations: Record<SupportedLanguage, TranslationSchema> = {
  en,
  te,
  hi,
};

export { en, te, hi };
