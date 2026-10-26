import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { en } from './en';
import { hi } from './hi';
import { loadLang, saveLang } from './lang-store';
import type { Lang, Messages } from './types';

const messages: Record<Lang, Messages> = { hi, en };

interface I18n {
  t: Messages;
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    saveLang(next);
    setLangState(next);
  };

  return (
    <I18nContext.Provider value={{ t: messages[lang], lang, setLang }}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
