const paths = {
  person: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z',
  back: 'M15.5 4 7.5 12l8 8 1.5-1.5L10.5 12 17 5.5 15.5 4Z',
  warning: 'M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z',
  logout: 'M10 3H4v18h6v-2H6V5h4V3Zm6 4-1.4 1.4 2.6 2.6H9v2h8.2l-2.6 2.6L16 17l5-5-5-5Z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4 3.2 3.2-1.4 1.4-3.8-3.8V6h2v6.4Z',
  block: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A8 8 0 0 1 4 12Zm8 8a8 8 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20Z',
  phone: 'M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm0 4v14h10V5H7Zm5 15.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  refresh: 'M17.6 6.4A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4l-2.4 2.4Z',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  );
}
