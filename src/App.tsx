import { LangSwitch } from './components/LangSwitch';
import { I18nProvider, useI18n } from './i18n';

function Home() {
  const { t } = useI18n();
  return (
    <main class="home">
      <header class="home__bar">
        <LangSwitch />
      </header>
      <h1>{t.appReady}</h1>
    </main>
  );
}

export function App() {
  return (
    <I18nProvider>
      <Home />
    </I18nProvider>
  );
}
