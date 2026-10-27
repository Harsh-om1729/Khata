const paths = {
  person: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z',
  back: 'M15.5 4 7.5 12l8 8 1.5-1.5L10.5 12 17 5.5 15.5 4Z',
  warning: 'M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z',
  logout: 'M10 3H4v18h6v-2H6V5h4V3Zm6 4-1.4 1.4 2.6 2.6H9v2h8.2l-2.6 2.6L16 17l5-5-5-5Z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4 3.2 3.2-1.4 1.4-3.8-3.8V6h2v6.4Z',
  block: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A8 8 0 0 1 4 12Zm8 8a8 8 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20Z',
  phone: 'M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm0 4v14h10V5H7Zm5 15.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  lock: 'M17 9V7A5 5 0 0 0 7 7v2H5v13h14V9h-2ZM9 7a3 3 0 0 1 6 0v2H9V7Zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z',
  key: 'M7 14a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.6-4A6 6 0 1 0 12.6 14H17v4h4v-4h2v-4H12.6Z',
  backspace: 'M22 3H7L0 12l7 9h15V3Zm-3 12.6L17.6 17 14 13.4 10.4 17 9 15.6l3.6-3.6L9 8.4 10.4 7l3.6 3.6L17.6 7 19 8.4 15.4 12l3.6 3.6Z',
  edit: 'M3 17.2V21h3.8L17.8 10l-3.8-3.8L3 17.2ZM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8L20.7 7Z',
  chevron: 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z',
  refresh: 'M17.6 6.4A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4l-2.4 2.4Z',
  camera: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  download: 'M5 20h14v-2H5v2Zm7-3 6-6-1.4-1.4L13 13.2V3h-2v10.2L7.4 9.6 6 11l6 6Z',
  upload: 'M5 20h14v-2H5v2Zm7-17-6 6 1.4 1.4L11 6.8V17h2V6.8l3.6 3.6L18 9l-6-6Z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z',
  undo: 'M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8Z',
  list: 'M3 5h2v2H3V5Zm4 0h14v2H7V5ZM3 11h2v2H3v-2Zm4 0h14v2H7v-2Zm-4 6h2v2H3v-2Zm4 0h14v2H7v-2Z',
  cash: 'M2 6h20v12H2V6Zm2 2v8h16V8H4Zm8 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM5 9h2v2H5V9Zm12 4h2v2h-2v-2Z',
  menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4Z',
  receipt: 'M5 2h14v20l-2.3-1.5L14.3 22 12 20.5 9.7 22l-2.4-1.5L5 22V2Zm2 2v14.3l.3-.2 2.4 1.5 2.3-1.5 2.3 1.5 2.4-1.5.3.2V4H7Zm2 3h6v2H9V7Zm0 4h6v2H9v-2Z',
  box: 'M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 6.5 3.3L12 10.8 5.5 7.5 12 4.2ZM5 9.1l6 3v7.3l-6-3V9.1Zm8 10.3v-7.3l6-3v7.3l-6 3Z',
  book: 'M6 2h13v20H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v11.2c.3-.1.6-.2 1-.2h11V4H6Zm0 14a1 1 0 0 0 0 2h11v-2H6Zm3-12h6v2H9V6Z',
  chart: 'M3 21V3h2v16h16v2H3Zm4-4v-7h3v7H7Zm5 0V6h3v11h-3Zm5 0v-4h3v4h-3Z',
  cloud: 'M19 18H6a4 4 0 0 1-.6-8A6 6 0 0 1 17 9a4.5 4.5 0 0 1 2 9Z',
  store: 'M4 3h16l1.5 6a3 3 0 0 1-2.5 3V21H5v-9a3 3 0 0 1-2.5-3L4 3Zm3 11v5h4v-4h2v4h4v-5H7Z',
  filter: 'M3 5h18l-7 8.5V20l-4-2v-4.5L3 5Z',
  tag: 'M3 3h8l10 10-8 8L3 11V3Zm4 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  ruler: 'M2 7h20v10H2V7Zm2 2v6h16V9h-2v3h-2V9h-2v2h-2V9h-2v3H8V9H6v2H4V9Z',
  archive: 'M20 3H4v4h16V3ZM5 8v13h14V8H5Zm4 3h6v2H9v-2Z',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d={paths[name]} fill="currentColor" />
    </svg>
  );
}
