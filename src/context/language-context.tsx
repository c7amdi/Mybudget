'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

export type Language = 'en' | 'fr' | 'ar';
type Direction = 'ltr' | 'rtl';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  direction: Direction;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode | ((context: { language: Language, direction: Direction }) => ReactNode) }) => {
  const [language, setLanguage] = useState<Language>('en');
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  const value = { language, setLanguage, direction };

  return (
    <LanguageContext.Provider value={value}>
      {typeof children === 'function' ? children({ language, direction }) : children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
