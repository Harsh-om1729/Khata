import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { en, hi } from '../../src/i18n';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('language switch', () => {
  it('opens in Hindi by default', () => {
    render(<App />);
    expect(screen.getByText(hi.appReady)).toBeTruthy();
    expect(document.documentElement.lang).toBe('hi');
  });

  it('switches to English and back', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: hi.switchLangLabel }));

    expect(screen.getByText(en.appReady)).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('button', { name: en.switchLangLabel }).textContent).toContain(en.switchLang);

    fireEvent.click(screen.getByRole('button', { name: en.switchLangLabel }));
    expect(screen.getByText(hi.appReady)).toBeTruthy();
  });

  it('remembers the choice after the app reopens', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: hi.switchLangLabel }));
    cleanup();

    render(<App />);
    expect(screen.getByText(en.appReady)).toBeTruthy();
  });

  it('still opens in Hindi when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<App />);
    expect(screen.getByText(hi.appReady)).toBeTruthy();
  });

  it('has an English text for every Hindi text', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(hi).sort());
  });
});
