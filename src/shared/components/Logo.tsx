interface LogoProps {
  /** Height of the cookie in pixels. */
  size?: number;
  /** Show the "Snacktic" wordmark next to the symbol. */
  showWordmark?: boolean;
  /** "dark" is the default. Use "light" on chocolate backgrounds: the cookie sits on a cream tile. */
  tone?: 'dark' | 'light';
}

/** Width divided by height of public/images/logo-mark.png (the cookie with two bites and the badge). */
const MARK_ASPECT = 471 / 422;

/**
 * The Snacktic mark, cut out of the official artwork. The file lives in public/images, so the
 * PWA developer should include it in the offline cache.
 */
export function Logo({ size = 40, showWordmark = false, tone = 'dark' }: LogoProps) {
  return (
    <span className="logo" role="img" aria-label="Snacktic">
      <span className={tone === 'light' ? 'logo__tile' : undefined}>
        <img
          src="/images/logo-mark.png"
          width={Math.round(size * MARK_ASPECT)}
          height={size}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      </span>
      {showWordmark && <span className="logo__word">Snacktic</span>}
    </span>
  );
}
