import { useEffect, useRef, useState } from 'preact/hooks';
import { shopProfile } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n/types';
import type { Route } from '../screens/routes';
import { useServices } from '../services';
import { useStaffSession } from '../staff/session';
import { DrawerRow } from './DrawerRow';
import { Icon, type IconName } from './Icon';

interface Leaf {
  icon: IconName;
  label: keyof Messages;
  route: Route;
}

type Entry = Leaf | { icon: IconName; label: keyof Messages; section: 'bill' | 'items'; children: Leaf[] };

const entries: Entry[] = [
  {
    icon: 'receipt', label: 'bill', section: 'bill', children: [
      { icon: 'plus', label: 'newBill', route: 'bill' },
      { icon: 'list', label: 'billHistory', route: 'history' },
    ],
  },
  {
    icon: 'box', label: 'menuItems', section: 'items', children: [
      { icon: 'edit', label: 'manageItems', route: 'items' },
      { icon: 'upload', label: 'excelTitle', route: 'excel' },
    ],
  },
  { icon: 'book', label: 'menuUdhaar', route: 'udhaar' },
  { icon: 'chart', label: 'dashboard', route: 'dashboard' },
  { icon: 'store', label: 'shopProfile', route: 'profile' },
  { icon: 'cloud', label: 'cloudBackup', route: 'sync' },
];

const SWIPE_CLOSE_PX = 60;

interface Props {
  current: Route;
  onGo: (route: Route) => void;
  onOwner: () => void;
  onClose: () => void;
}

export function SideMenu({ current, onGo, onOwner, onClose }: Props) {
  const { t } = useI18n();
  const { db } = useServices();
  const { active } = useStaffSession();
  const profile = useLiveQuery(() => shopProfile(db), [db]);
  const [open, setOpen] = useState(() => {
    const holder = entries.find((e) => 'children' in e && e.children.some((c) => c.route === current));
    return holder && 'section' in holder ? holder.section : null;
  });
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<number | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // The page behind must not scroll while the menu covers it.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const go = (route: Route) => {
    onGo(route);
    onClose();
  };
  const leaf = (item: Leaf, sub = false) => (
    <DrawerRow key={item.route} icon={item.icon} label={t[item.label]} sub={sub} current={item.route === current} onClick={() => go(item.route)} />
  );

  return (
    <div class="drawer-layer">
      <button type="button" class="drawer-scrim" aria-label={t.closeMenu} tabIndex={-1} onClick={onClose} data-testid="drawer-scrim" />
      <div
        class="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t.menu}
        onTouchStart={(e) => (swipeStart.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = swipeStart.current;
          const end = e.changedTouches[0]?.clientX;
          swipeStart.current = null;
          if (start !== null && end !== undefined && start - end > SWIPE_CLOSE_PX) onClose();
        }}
      >
        <header class="drawer__head">
          <span class="drawer__shop">{profile.value?.shop_name || t.appName}</span>
          {active && (
            <span class="drawer__who">
              <Icon name="person" /> {active.name}
            </span>
          )}
          <button ref={closeRef} type="button" class="drawer__close" aria-label={t.closeMenu} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <ul class="drawer__list">
          {entries.map((entry) =>
            'section' in entry ? (
              <li key={entry.section}>
                <DrawerRow
                  icon={entry.icon}
                  label={t[entry.label]}
                  expanded={open === entry.section}
                  onClick={() => setOpen(open === entry.section ? null : entry.section)}
                />
                {open === entry.section && <div class="drawer__sub">{entry.children.map((child) => leaf(child, true))}</div>}
              </li>
            ) : (
              <li key={entry.route}>{leaf(entry)}</li>
            ),
          )}
          <li class="drawer__divider" aria-hidden="true" />
          <li>
            <DrawerRow
              icon="person"
              label={t.owner}
              onClick={() => {
                onClose();
                onOwner();
              }}
            />
          </li>
        </ul>
      </div>
    </div>
  );
}
