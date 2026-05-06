import { SetMetadata } from '@nestjs/common';

export type UserRole = 'admin' | 'clinic_admin' | 'doctor' | 'patient';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
