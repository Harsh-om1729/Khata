import { useMemo, useState } from 'preact/hooks';
import { createDeviceAdmin, createOwnerAuth } from './auth';
import { I18nProvider } from './i18n';
import { Home } from './screens/Home';
import { OwnerHome } from './screens/OwnerHome';
import { OwnerLogin } from './screens/OwnerLogin';
import { ServicesProvider, useServices } from './services';
import type { Services } from './services';
import { createDeviceRegistration } from './sync/device-registration';

type Screen = { name: 'home' } | { name: 'ownerLogin' } | { name: 'ownerHome'; email: string };

function Screens() {
  const { ownerAuth } = useServices();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });
  const ownerHome = (email: string) => setScreen({ name: 'ownerHome', email });

  const openOwner = async () => {
    const email = await ownerAuth.currentOwnerEmail().catch(() => null);
    setScreen(email ? { name: 'ownerHome', email } : { name: 'ownerLogin' });
  };

  switch (screen.name) {
    case 'home':
      return <Home onOwner={openOwner} />;
    case 'ownerLogin':
      return <OwnerLogin onBack={home} onSignedIn={ownerHome} />;
    case 'ownerHome':
      return <OwnerHome email={screen.email} onSignedOut={home} onBack={home} />;
  }
}

export function App({ services }: { services?: Partial<Services> }) {
  const all = useMemo<Services>(
    () => ({
      ownerAuth: services?.ownerAuth ?? createOwnerAuth(),
      device: services?.device ?? createDeviceRegistration(),
      deviceAdmin: services?.deviceAdmin ?? createDeviceAdmin(),
    }),
    [services],
  );
  return (
    <I18nProvider>
      <ServicesProvider services={all}>
        <Screens />
      </ServicesProvider>
    </I18nProvider>
  );
}
