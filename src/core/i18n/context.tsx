import React, { createContext, useContext, useState, useEffect } from 'react';
import { id, type Translations } from './locales/id';
import { en } from './locales/en';

export type Locale = 'id' | 'en';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18N_STORAGE_KEY = 'akashic_user_locale';

const translationsMap: Record<Locale, Translations> = {
  id,
  en,
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(I18N_STORAGE_KEY);
      if (saved === 'id' || saved === 'en') return saved;
      return navigator.language.startsWith('id') ? 'id' : 'en';
    } catch {
      return 'id';
    }
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(I18N_STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch (err) {
      console.error('Failed to save locale', err);
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: translationsMap[locale],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
