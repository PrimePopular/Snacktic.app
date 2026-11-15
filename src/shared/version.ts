/**
 * Which update of Snacktic this is. It is shown at the bottom of Profile, so anyone can see at a glance which version is
 * live (and it is sent with bug reports). Change the number when you apply a new update zip.
 */
export const APP_UPDATE = '023';

export function appVersionLabel(): string {
  const build = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
  return `Update ${APP_UPDATE} · built ${build}`;
}
