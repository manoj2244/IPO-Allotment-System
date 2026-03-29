export type Role = 'ADMIN' | 'STAFF';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    role: Role;
  };
}

export interface Ipo {
  id: number;
  companyName: string;
  companyCode: string;
  pricePerUnit: string;
  district: string;
  issuedUnits: number;
  minUnits: number;
  maxUnits: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface IpoEntry {
  id: number;
  ipoId: number;
  formNo: string;
  dateBs: string;
  boid: string;
  name: string;
  fatherName: string;
  grandfatherName: string;
  citizenshipNo: string;
  bankName: string;
  accountNo: string;
  mobileNo: string;
  appliedUnits: number;
  depositAmount: string;
  remarks?: string;
  panNo?: string;
  district: string;
}

export interface AddressItem {
  id: number;
  province: string;
  district: string;
  nagarpalika: string;
}
