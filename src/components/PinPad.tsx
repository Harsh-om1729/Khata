import { useEffect, useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import type { LoginResult } from '../staff/staff-login';
import type { StaffMember } from '../staff/types';
import { Icon } from './Icon';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

type Problem = Exclude<LoginResult, { kind: 'ok' }> | null;

export function PinPad({ member, onUnlocked, onCancel }: { member: StaffMember; onUnlocked: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const { staffLogin } = useServices();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(() => {
    const until = staffLogin.lockedUntil();
    return until !== null ? { kind: 'locked', until } : null;
  });
  const [now, setNow] = useState(Date.now());

  const locked = problem?.kind === 'locked' && problem.until > now;
  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [locked]);

  const submit = async (pin: string) => {
    setBusy(true);
    const result = await staffLogin.login(member, pin);
    setBusy(false);
    setDigits('');
    if (result.kind === 'ok') onUnlocked();
    else {
      setNow(Date.now());
      setProblem(result);
    }
  };

  const press = (digit: string) => {
    if (busy || locked || digits.length >= PIN_LENGTH) return;
    const next = digits + digit;
    setDigits(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const minutesLeft = problem?.kind === 'locked' ? Math.max(1, Math.ceil((problem.until - now) / 60_000)) : 0;

  return (
    <section class="pinpad">
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={onCancel}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2 class="pinpad__name">{member.name}</h2>
      <p>{t.pinTitle}</p>
      <div class="pinpad__dots" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} class={i < digits.length ? 'dot dot--filled' : 'dot'} />
        ))}
      </div>
      {busy && <p role="status">{t.pinChecking}</p>}
      {problem && !busy && (problem.kind !== 'locked' || locked) && (
        <p class="alert" role="alert">
          <Icon name={problem.kind === 'locked' ? 'lock' : 'warning'} />
          {problem.kind === 'wrong' && t.pinWrong}
          {problem.kind === 'needsInternet' && t.pinNeedsInternet}
          {problem.kind === 'locked' && `${t.pinLocked} ${minutesLeft}`}
        </p>
      )}
      <div class="pinpad__keys">
        {KEYS.map((digit) => (
          <button key={digit} type="button" class="key" disabled={busy || locked} onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <span />
        <button type="button" class="key" disabled={busy || locked} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          class="key"
          aria-label={t.deleteDigit}
          disabled={busy || digits.length === 0}
          onClick={() => setDigits(digits.slice(0, -1))}
        >
          <Icon name="backspace" />
        </button>
      </div>
    </section>
  );
}
