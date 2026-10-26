import { beforeEach, describe, expect, it } from 'vitest';
import { loadLang, saveLang } from '../../src/i18n/lang-store';

beforeEach(() => {
  localStorage.clear();
});

describe('lang store', () => {
  it('falls back to Hindi for an unknown saved value', () => {
    localStorage.setItem('khata.lang', 'fr');
    expect(loadLang()).toBe('hi');
  });

  it('reads back a saved choice', () => {
    saveLang('en');
    expect(loadLang()).toBe('en');
  });
});
