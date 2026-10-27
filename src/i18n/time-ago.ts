import type { Lang } from './types';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "5 मिनट पहले" / "5 minutes ago", using the phone's built-in translations. */
export function timeAgo(iso: string, lang: Lang, now: number = Date.now()): string {
  const format = new Intl.RelativeTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { numeric: 'auto' });
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const size = Math.abs(seconds);
  if (size < MINUTE) return format.format(0, 'second');
  if (size < HOUR) return format.format(Math.round(seconds / MINUTE), 'minute');
  if (size < DAY) return format.format(Math.round(seconds / HOUR), 'hour');
  if (size < WEEK) return format.format(Math.round(seconds / DAY), 'day');
  return format.format(Math.round(seconds / WEEK), 'week');
}
