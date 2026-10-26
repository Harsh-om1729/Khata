import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { DeviceAdmin } from './auth/device-admin';
import type { StaffAdmin } from './auth/staff-admin';
import type { OwnerAuth } from './auth/types';
import type { StaffDirectory } from './staff/server';
import type { StaffLogin } from './staff/staff-login';
import type { DeviceRegistration } from './sync/device-registration';

/** Everything that talks to the cloud, injected so screens can be tested with fakes. */
export interface Services {
  ownerAuth: OwnerAuth;
  device: DeviceRegistration;
  deviceAdmin: DeviceAdmin;
  staffDirectory: StaffDirectory;
  staffLogin: StaffLogin;
  staffAdmin: StaffAdmin;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ComponentChildren }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesProvider');
  return services;
}
