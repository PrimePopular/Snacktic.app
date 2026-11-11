/**
 * Minimal hash-based router. Owned by the Foundation developer.
 *
 * Why hash routing (e.g. /#/discover)?
 *  - Works on any static host (Cloudflare Pages free tier) with no rewrite rules.
 *  - Works offline once the PWA shell is cached, with no server involved.
 *  - Adds zero dependencies. Replacing it later only touches this file.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, ReactElement } from 'react';

export type Params = Record<string, string>;

export interface RouteDef {
  /** Pattern such as "/games/:id". */
  path: string;
  /** Used for the browser tab title and screen-reader announcements. */
  title: string;
  render: (params: Params) => ReactElement;
}

function normalize(hash: string): string {
  let path = hash.replace(/^#/, '').split('?')[0];
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function getSnapshot(): string {
  return normalize(window.location.hash);
}

/** Returns the current path, e.g. "/discover". Re-renders on navigation. */
export function useRoutePath(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => '/');
}

export function navigate(to: string): void {
  window.location.hash = to;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

export function Link({ to, ...rest }: LinkProps) {
  return <a href={`#${to}`} {...rest} />;
}

export function matchPath(pattern: string, path: string): Params | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

interface RouterProps {
  routes: RouteDef[];
  notFound: ReactElement;
}

export function Router({ routes, notFound }: RouterProps) {
  const path = useRoutePath();
  const isFirstRender = useRef(true);

  let element: ReactElement = notFound;
  let title = 'Page not found';
  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params) {
      element = route.render(params);
      title = route.title;
      break;
    }
  }

  useEffect(() => {
    document.title = `${title} · Snacktic`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // After navigating, start at the top and move focus to the page content
    // so keyboard and screen-reader users land in the right place.
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [path, title]);

  return element;
}
