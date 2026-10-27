import { useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { compressPhoto } from '../pictures/compress';
import { Alert } from './Alert';
import { Icon } from './Icon';

interface Props {
  label: string;
  onPhoto: (photo: Blob) => Promise<void> | void;
}

/** Opens the phone camera; the photo is shrunk on the phone before it is saved. */
export function PhotoButton({ label, onPhoto }: Props) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const picked = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      await onPhoto(await compressPhoto(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label class={busy ? 'btn btn--busy' : 'btn'}>
        <Icon name="camera" />
        {busy ? t.photoSaving : label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="visually-hidden"
          disabled={busy}
          onChange={(e) => void picked(e.currentTarget)}
        />
      </label>
      {failed && <Alert text={t.photoFailed} />}
    </>
  );
}
