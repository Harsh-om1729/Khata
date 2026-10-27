import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { DeviceAdmin } from './auth/device-admin';
import type { StaffAdmin } from './auth/staff-admin';
import type { KhataDb } from './db';
import type { StorageGuard } from './db/persist';
import type * as Workbook from './excel/workbook';
import type { OwnerAuth } from './auth/types';
import type { StaffDirectory } from './staff/server';
import type { StaffLogin } from './staff/staff-login';
import type { DeviceRegistration } from './sync/device-registration';

/** Everything that talks to the cloud or the phone's storage, injected so screens can be tested with fakes. */
export interface Services {
  ownerAuth: OwnerAuth;
  device: DeviceRegistration;
  deviceAdmin: DeviceAdmin;
  staffDirectory: StaffDirectory;
  staffLogin: StaffLogin;
  staffAdmin: StaffAdmin;
  db: KhataDb;
  storage: StorageGuard;
  /** Loads the Excel code on demand; it is too big to ship in the app's start-up code. */
  loadExcel: () => Promise<typeof Workbook>;
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
