import type { hi } from './hi';

export type Lang = 'hi' | 'en';

export type Messages = { [K in keyof typeof hi]: string };
