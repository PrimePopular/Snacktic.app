import type { Role } from './auth.types';

/** Owner, admins and content editors can open the admin area. */
export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'owner' || role === 'editor';
}

/** A content editor sees only Billboards and Events. */
export function isEditorRole(role: Role): boolean {
  return role === 'editor';
}

/** Only the owner can see student details and export emails. */
export function isOwnerRole(role: Role): boolean {
  return role === 'owner';
}

export function roleLabel(role: Role): string {
  return role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : role === 'editor' ? 'Content editor' : 'Student';
}
