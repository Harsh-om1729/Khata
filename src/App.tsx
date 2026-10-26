import { useMemo, useState } from 'preact/hooks';
import { createOwnerAuth, OwnerAuthProvider, useOwnerAuth } from './auth';
import type { OwnerAuth } from './auth';
import { I18nProvider } from './i18n';
import { Home } from './screens/Home';
import { OwnerHome } from './screens/OwnerHome';
import { OwnerLogin } from './screens/OwnerLogin';

type Screen = { name: 'home' } | { name: 'ownerLogin' } | { name: 'ownerHome'; email: string };

function Screens() {
  const auth = useOwnerAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });
  const ownerHome = (email: string) => setScreen({ name: 'ownerHome', email });

  const openOwner = async () => {
    const email = await auth.currentOwnerEmail().catch(() => null);
    setScreen(email ? { name: 'ownerHome', email } : { name: 'ownerLogin' });
  };

  switch (screen.name) {
    case 'home':
      return <Home onOwner={openOwner} />;
    case 'ownerLogin':
      return <OwnerLogin onBack={home} onSignedIn={ownerHome} />;
    case 'ownerHome':
      return <OwnerHome email={screen.email} onSignedOut={home} />;
  }
}

export function App({ ownerAuth }: { ownerAuth?: OwnerAuth }) {
  const auth = useMemo(() => ownerAuth ?? createOwnerAuth(), [ownerAuth]);
  return (
    <I18nProvider>
      <OwnerAuthProvider auth={auth}>
        <Screens />
      </OwnerAuthProvider>
    </I18nProvider>
  );
}
