import type { Role } from './auth.types';

/** Owner and admins can manage content. */
export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'owner';
}

/** Only the owner can see student details and export emails. */
export function isOwnerRole(role: Role): boolean {
  return role === 'owner';
}

export function roleLabel(role: Role): string {
  return role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Student';
}
