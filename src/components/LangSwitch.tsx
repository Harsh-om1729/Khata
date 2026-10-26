import { useI18n } from '../i18n';

export function LangSwitch() {
  const { t, lang, setLang } = useI18n();
  return (
    <button
      type="button"
      class="lang-switch"
      aria-label={t.switchLangLabel}
      onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
    >
      <span class="lang-switch__mark" aria-hidden="true">
        {t.langMark}
      </span>
      {t.switchLang}
    </button>
  );
}
