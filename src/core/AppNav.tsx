import { Logo } from '../shared/components';
import { navItems, isActive } from './navigation';
import { NavIcon } from './NavIcons';
import { Link, useRoutePath } from './router';

/** Bottom tab bar on phones, left rail on tablets and desktops. */
export function AppNav() {
  const path = useRoutePath();

  return (
    <nav className="app-nav" aria-label="Main">
      <div className="app-nav__brand">
        <Logo size={36} tone="light" />
      </div>
      <ul className="app-nav__list">
        {navItems.map((item) => (
          <li key={item.id}>
            <Link
              to={item.path}
              className="app-nav__link"
              aria-current={isActive(item, path) ? 'page' : undefined}
            >
              <span className="app-nav__icon">
                <NavIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
