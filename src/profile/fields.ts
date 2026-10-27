/** The shop profile (SPEC §2.1). An unset field is ''. `state` is a GST state code. */
export interface ShopProfile {
  shop_name: string;
  gstin: string;
  phone1: string;
  phone2: string;
  address: string;
  pincode: string;
  state: string;
}

export type ProfileField = keyof ShopProfile;

export const PROFILE_FIELDS: readonly ProfileField[] = ['shop_name', 'gstin', 'phone1', 'phone2', 'address', 'pincode', 'state'];

export const emptyProfile = (): ShopProfile => ({ shop_name: '', gstin: '', phone1: '', phone2: '', address: '', pincode: '', state: '' });
