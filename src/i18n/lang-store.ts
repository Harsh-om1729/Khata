import type { Lang } from './types';

const KEY = 'khata.lang';

export function loadLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'hi';
  } catch {
    return 'hi';
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Storage can be blocked; the choice then lasts only until the app closes.
  }
}
