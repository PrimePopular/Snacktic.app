import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import './splash.css';

interface SplashProps {
  onDone: () => void;
}

const LETTERS = ['S', 'n', 'a', 'c', 'k', 't', 'i', 'c'];

/**
 * The opening animation: the cookie drops, takes a bite, the notification badge pops and the name
 * spells itself out. It plays once each time the app is opened and covers the app while it loads.
 * Tap anywhere to skip. People who prefer less motion see a quick, still version.
 */
export function Splash({ onDone }: SplashProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setLeaving(true), reduced ? 1200 : 4800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, 450);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

  return (
    <div className={`splash ${leaving ? 'splash--leaving' : ''}`} onClick={() => setLeaving(true)} role="presentation">
      <div className="sp-scene">
        <span className="sp-blob sp-blob-top" aria-hidden="true" />
        <span className="sp-blob sp-blob-bottom" aria-hidden="true" />
        <span className="sp-spark sp-spark-a" aria-hidden="true" />
        <span className="sp-spark sp-spark-b" aria-hidden="true" />
        <span className="sp-spark sp-spark-c" aria-hidden="true" />

        <div className="sp-logo-wrap" aria-hidden="true">
          <span className="sp-logo-shadow" />
          <svg className="sp-cookie" viewBox="0 0 200 200">
            <defs>
              <radialGradient id="spCookieGradient" cx="35%" cy="28%" r="78%">
                <stop offset="0%" stopColor="#9b5735" />
                <stop offset="48%" stopColor="#71351f" />
                <stop offset="100%" stopColor="#3a1d16" />
              </radialGradient>
              <linearGradient id="spChipGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2a1511" />
                <stop offset="100%" stopColor="#160c0a" />
              </linearGradient>
              <mask id="spCookieBite">
                <rect width="200" height="200" fill="white" />
                <circle className="sp-bite" cx="145" cy="43" r="31" fill="black" />
              </mask>
            </defs>

            <g className="sp-cookie-body">
              <g mask="url(#spCookieBite)">
                <circle cx="91" cy="104" r="72" fill="url(#spCookieGradient)" stroke="#3b1d15" strokeWidth="4" />
                <path d="M40 65c15-24 49-38 75-28" fill="none" stroke="#bd8057" strokeWidth="5" strokeLinecap="round" opacity=".25" />
                <g fill="url(#spChipGradient)">
                  <ellipse cx="55" cy="75" rx="8" ry="10" transform="rotate(22 55 75)" />
                  <ellipse cx="91" cy="58" rx="7" ry="9" transform="rotate(-18 91 58)" />
                  <ellipse cx="119" cy="91" rx="9" ry="11" transform="rotate(28 119 91)" />
                  <ellipse cx="69" cy="119" rx="9" ry="11" transform="rotate(-24 69 119)" />
                  <ellipse cx="111" cy="139" rx="7" ry="9" transform="rotate(18 111 139)" />
                  <ellipse cx="145" cy="119" rx="6" ry="8" transform="rotate(-15 145 119)" />
                  <ellipse cx="43" cy="103" rx="5" ry="7" />
                  <ellipse cx="92" cy="101" rx="5" ry="6" />
                </g>
                <g fill="#d59a6e" opacity=".23">
                  <circle cx="49" cy="91" r="2.5" />
                  <circle cx="104" cy="45" r="2" />
                  <circle cx="130" cy="126" r="2.5" />
                  <circle cx="80" cy="151" r="2" />
                  <circle cx="135" cy="70" r="2" />
                </g>
              </g>
            </g>

            <g className="sp-crumb" style={{ '--dx': '-27px', '--dy': '25px' } as CSSProperties} fill="#a85d35">
              <circle cx="29" cy="143" r="4" />
            </g>
            <g className="sp-crumb sp-c2" style={{ '--dx': '24px', '--dy': '30px' } as CSSProperties} fill="#d28a50">
              <circle cx="157" cy="147" r="3.5" />
            </g>
            <g className="sp-crumb sp-c3" style={{ '--dx': '-20px', '--dy': '-22px' } as CSSProperties} fill="#7d3e25">
              <circle cx="34" cy="44" r="3" />
            </g>

            <g className="sp-badge">
              <circle cx="148" cy="42" r="19" fill="#f36f2b" />
              <circle cx="148" cy="42" r="15.5" fill="#ff8a3d" />
              <text x="148" y="49" textAnchor="middle" fill="#fffaf4" fontFamily="Space Grotesk, sans-serif" fontSize="21" fontWeight="700">
                1
              </text>
            </g>
            <g className="sp-rays" fill="none" stroke="#ff8a3d" strokeWidth="5.5" strokeLinecap="round">
              <path d="M177 16l8-10" />
              <path d="M184 39l13-2" />
              <path d="M177 61l10 7" />
            </g>
          </svg>
        </div>

        <h1 className="sp-wordmark" aria-label="Snacktic">
          {LETTERS.map((letter, i) => (
            <span key={i} className={`sp-letter ${i === LETTERS.length - 1 ? 'sp-orange-dot' : ''}`}>
              {letter}
            </span>
          ))}
        </h1>

        <p className="sp-tagline">
          Good snacks, <strong>good moments.</strong>
        </p>

        <div className="sp-loader" aria-hidden="true">
          <span className="sp-loader-fill" />
        </div>
        <p className="sp-hint">Tap to skip</p>
      </div>
    </div>
  );
}
