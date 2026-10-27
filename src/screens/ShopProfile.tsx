import { useEffect, useRef, useState } from 'preact/hooks';
import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';
import { OutlinedField } from '../components/OutlinedField';
import { PillButton } from '../components/PillButton';
import { ProgressBar } from '../components/ProgressBar';
import { ProfileInvalidError, saveShopProfile, shopProfile } from '../db';
import { useLiveQuery } from '../db/live';
import { useI18n } from '../i18n';
import { stateName } from '../i18n/state-name';
import type { Messages } from '../i18n/types';
import { PROFILE_FIELDS, STATE_CODES, checkProfile, profileCompletion, type ProfileCheck, type ProfileField, type ProfileProblem, type ShopProfile as Profile } from '../profile';
import { useServices } from '../services';
import { useAuthor } from '../staff/use-author';

const TOAST_MS = 3000;

function problemText(t: Messages, problem: ProfileProblem): string {
  switch (problem) {
    case 'required':
      return t.errorShopName;
    case 'tooLong':
      return t.errorTooLong;
    case 'gstin':
      return t.errorGstin;
    case 'gstinState':
      return t.errorGstinState;
    case 'phone':
      return t.errorPhone;
    case 'pincode':
      return t.errorPincode;
    case 'state':
      return t.errorState;
  }
}

/** Shop profile (UI-VOICE §2.9). Edits stay a draft until Save; leaving with unsaved changes asks first. */
export function ShopProfile({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const { db } = useServices();
  const author = useAuthor();
  const saved = useLiveQuery(() => shopProfile(db), [db]);
  const [draft, setDraft] = useState<Profile | null>(null);
  // What this screen loaded or last saved; compared with the draft to spot unsaved changes without waiting for the live read.
  const [baseline, setBaseline] = useState<Profile | null>(null);
  const [problems, setProblems] = useState<ProfileCheck['problems']>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Start from what is saved, once; later saves from other phones must not wipe what is being typed.
  useEffect(() => {
    if (draft === null && saved.value) {
      setDraft(saved.value);
      setBaseline(saved.value);
    }
  }, [saved.value]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [problems]);

  if (saved.failed) return <Alert text={t.loadFailed} />;
  if (!draft || !baseline) return null;
  const dirty = PROFILE_FIELDS.some((field) => draft[field] !== baseline[field]);

  const set = (field: ProfileField) => (value: string) => {
    setDraft({ ...draft, [field]: value });
    // The mistake is gone from view once someone starts fixing it.
    if (problems[field]) setProblems({ ...problems, [field]: undefined });
  };
  const error = (field: ProfileField) => {
    const problem = problems[field];
    return problem ? problemText(t, problem) : null;
  };

  const save = async (event: Event) => {
    event.preventDefault();
    setFailed(false);
    const check = checkProfile(draft);
    if (Object.keys(check.problems).length > 0) return setProblems(check.problems);
    setBusy(true);
    try {
      const stored = await saveShopProfile(db, author, draft);
      setDraft(stored);
      setBaseline(stored);
      setProblems({});
      setToast(true);
    } catch (e) {
      if (e instanceof ProfileInvalidError) setProblems(e.problems);
      else setFailed(true);
    }
    setBusy(false);
  };
  const leave = () => (dirty ? setAsking(true) : onBack());

  const states = STATE_CODES.map((code) => ({ value: code, label: stateName(code, lang) })).sort((a, b) => a.label.localeCompare(b.label));
  const shownProblems = Object.values(problems).some(Boolean);

  return (
    <form ref={formRef} class="catalog profile" onSubmit={save} noValidate>
      <header class="bar bar--start">
        <button type="button" class="btn" onClick={leave}>
          <Icon name="back" />
          {t.back}
        </button>
      </header>
      <h2>{t.shopProfile}</h2>
      <ProgressBar label={t.profileComplete} percent={profileCompletion(checkProfile(draft).profile)} />
      {shownProblems && <Alert text={t.fixMistakes} />}
      {failed && <Alert text={t.saveFailed} />}

      <OutlinedField label={`${t.fieldShopName} (${t.required})`} value={draft.shop_name} onChange={set('shop_name')} maxLength={80} error={error('shop_name')} />
      <OutlinedField label={t.fieldPhone1} inputMode="tel" maxLength={16} value={draft.phone1} onChange={set('phone1')} error={error('phone1')} />
      <OutlinedField label={t.fieldPhone2} inputMode="tel" maxLength={16} value={draft.phone2} onChange={set('phone2')} error={error('phone2')} />
      <OutlinedField kind="multiline" label={t.fieldAddress} maxLength={200} value={draft.address} onChange={set('address')} error={error('address')} />
      <OutlinedField label={t.fieldPincode} inputMode="numeric" maxLength={7} value={draft.pincode} onChange={set('pincode')} error={error('pincode')} />
      <OutlinedField kind="select" label={t.fieldState} placeholder={t.chooseState} options={states} value={draft.state} onChange={set('state')} error={error('state')} />
      <OutlinedField label={t.fieldGstin} upperCase maxLength={20} value={draft.gstin} onChange={set('gstin')} error={error('gstin')} />

      {toast && !asking && (
        <p class="toast" role="status">
          <Icon name="check" />
          {t.profileSaved}
        </p>
      )}
      <div class="save-bar">
        {asking ? (
          <div class="save-bar__ask" role="alertdialog" aria-label={t.unsavedQuestion}>
            <p class="confirm__question">
              <Icon name="warning" />
              {t.unsavedQuestion}
            </p>
            <div class="save-bar__buttons">
              <PillButton label={t.discardChanges} onClick={onBack} />
              <PillButton primary label={t.keepEditing} onClick={() => setAsking(false)} />
            </div>
          </div>
        ) : (
          <div class="save-bar__buttons">
            <PillButton label={t.cancel} onClick={leave} />
            <PillButton primary type="submit" icon="check" label={busy ? t.saving : t.save} disabled={busy} />
          </div>
        )}
      </div>
    </form>
  );
}
