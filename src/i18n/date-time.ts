import type { Lang } from './types';

/** "27 अक्टू॰ 2026, 11:30 am" / "27 Oct 2026, 11:30 am", in the phone's own time zone. */
export function dateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
