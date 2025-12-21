export type UserRole =
  | 'SUPERADMIN'
  | 'BUSINESS_PARTNER'
  | 'FRANCHISE'
  | 'CENTER_MANAGER'
  | 'ADMISSIONS'
  | 'TEACHER'
  | 'STUDENT'
  | 'SALES'
  | string;

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  orgUnitId?: number | null;
  studentId?: number | null;
}
