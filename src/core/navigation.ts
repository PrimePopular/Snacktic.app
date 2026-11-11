/** The four bottom tabs. Profile lives in the top bar, next to the points. */
export type NavIconName = 'home' | 'discover' | 'games' | 'rewards' | 'profile';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: NavIconName;
}

export const navItems: NavItem[] = [
  { id: 'home', label: 'Home', path: '/', icon: 'home' },
  { id: 'discover', label: 'Discover', path: '/discover', icon: 'discover' },
  { id: 'games', label: 'Games', path: '/games', icon: 'games' },
  { id: 'rewards', label: 'Rewards', path: '/rewards', icon: 'rewards' },
];

export function isActive(item: NavItem, currentPath: string): boolean {
  if (item.path === '/') return currentPath === '/';
  return currentPath === item.path || currentPath.startsWith(item.path + '/');
}
