'use client';

import { useCallback } from 'react';
import { useLanguage } from '@/context/language-context';
import type { Language } from '@/context/language-context';
import en from '@/lib/locales/en.json';
import fr from '@/lib/locales/fr.json';
import ar from '@/lib/locales/ar.json';

const translations = {
  en,
  fr,
  ar,
};

// Helper function to get nested property
const get = (obj: any, path: string) => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) return path; // Return key if not found
  }
  return result;
};


export const useTranslation = () => {
  const { language } = useLanguage();
  const tData = translations[language];

  const t = useCallback((key: string): string => {
    return get(tData, key);
  }, [tData]);

  return { t, language };
};
