import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { t } from '../../src/i18n';

describe('App', () => {
  it('shows the Hindi ready text', () => {
    render(<App />);
    expect(screen.getByText(t.appReady)).toBeTruthy();
  });
});
