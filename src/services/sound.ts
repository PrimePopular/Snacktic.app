/**
 * Small sound effects made in the browser (no audio files, no cost). Owned by the Foundation developer.
 * Phones only allow sound after the person has touched the screen at least once, so a sound that
 * would play before the first tap is simply silent. A switch in Profile turns all sounds off.
 */
const KEY = 'snacktic.sound';

let context: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
}

function audio(): AudioContext | null {
  if (!isSoundEnabled()) return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function note(ctx: AudioContext, frequency: number, start: number, length: number, type: OscillatorType, volume: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(t0);
  oscillator.stop(t0 + length + 0.02);
}

/** A soft two-note chime, for important announcements. */
export function playChime(): void {
  const ctx = audio();
  if (!ctx) return;
  note(ctx, 659.25, 0, 0.35, 'sine', 0.18);
  note(ctx, 880, 0.14, 0.5, 'sine', 0.16);
}

/** A short tap. */
export function playTap(): void {
  const ctx = audio();
  if (!ctx) return;
  note(ctx, 520, 0, 0.07, 'triangle', 0.12);
}

/** A bright coin sound, for earning, sending or spending points. */
export function playCoin(): void {
  const ctx = audio();
  if (!ctx) return;
  note(ctx, 987.77, 0, 0.09, 'square', 0.07);
  note(ctx, 1318.51, 0.08, 0.35, 'square', 0.07);
}
