import { db } from '@/lib/DbContext';

import React, { createContext, useContext, useState, useEffect } from 'react';

// English is the fallback dictionary and is always needed, so it's eagerly
// bundled. Every other locale lives in its own JSON file and is code-split via
// import.meta.glob — only the active locale is fetched, on demand, keeping the
// non-English translations out of the initial bundle. Until a locale finishes
// loading, `t` transparently falls back to English (same behaviour as a
// missing key), so there's no loading state to handle in consumers.
import en from './locales/en.json';

const localeLoaders = import.meta.glob(['./locales/*.json', '!./locales/en.json']);

function loaderFor(lang) {
  return localeLoaders[`./locales/${lang}.json`];
}

const I18nContext = createContext({ t: (key, params) => key, language: 'en', setLanguage: (lang) => {} });

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const [dicts, setDicts] = useState({ en });

  useEffect(() => {
    db.auth
      .me()
      .then((user) => {
        if (user?.language) setLanguage(user.language);
      })
      .catch(() => {});
  }, []);

  // Lazy-load the active locale's dictionary the first time it's selected.
  useEffect(() => {
    if (language === 'en' || dicts[language]) return;
    const load = loaderFor(language);
    if (!load) return;
    let cancelled = false;
    load()
      .then((/** @type {any} */ mod) => {
        if (!cancelled) setDicts((cur) => (cur[language] ? cur : { ...cur, [language]: mod.default }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language, dicts]);

  const t = (key, params) => {
    const dict = dicts[language] || dicts.en;
    let value = getNestedValue(dict, key);
    if (value === null) {
      value = getNestedValue(dicts.en, key) ?? key;
    }
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value || key;
  };

  return (
    <I18nContext.Provider value={{ t, language, setLanguage: (lang) => setLanguage(lang) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
