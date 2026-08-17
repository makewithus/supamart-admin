// Synthesized two-note chime via the Web Audio API — no audio asset needed. A single
// AudioContext is reused (browsers cap how many can exist, and each carries setup cost).
let ctx = null;

// Lazily creates (once) and returns the shared AudioContext, or null if the browser has
// none. Exported so a caller (the "Enable Order Alerts" gesture) can create + resume it
// from directly inside a click handler, which is what actually satisfies the browser's
// autoplay-unlock requirement — resume() called outside a user-gesture call stack is a
// silent no-op and leaves the context 'suspended'.
export function getAudioContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

// True only once the context actually reports 'running' — i.e. a real unlock happened,
// not just that we attempted one.
export function isAudioUnlocked() {
  return !!ctx && ctx.state === 'running';
}

// Silently resumes the AudioContext the moment the admin interacts with the page in any
// way (click, tap, keypress) — anywhere, not necessarily a specific "Enable" button. A
// fresh AudioContext starts 'suspended' on every page load and only a real user gesture
// can resume it, but that gesture doesn't have to be a dedicated prompt: an admin working
// the dashboard will click something within seconds of opening it regardless. This is what
// lets the explicit "Enable Order Alerts" banner show at most once ever (see
// EnableAlertsPrompt.jsx / App.jsx) instead of nagging on every reload — audio still gets
// unlocked well before an order is likely to arrive.
let autoUnlockAttached = false;
export function autoUnlockOnFirstInteraction() {
  if (autoUnlockAttached || isAudioUnlocked()) return;
  autoUnlockAttached = true;
  const handler = () => {
    getAudioContext()?.resume();
  };
  // 'once' removes the listener after it fires; both are attached since not every browser
  // fires 'pointerdown' the same way for keyboard-only navigation.
  document.addEventListener('pointerdown', handler, { once: true, passive: true });
  document.addEventListener('keydown', handler, { once: true });
}

export function playNotificationSound() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    // Browsers suspend a freshly-created (or long-idle) AudioContext until it's resumed
    // from inside a user-gesture-adjacent call stack; resume() is a no-op if already running,
    // and a no-op (context stays suspended) if called with no gesture in the call stack.
    audioCtx.resume();

    // A limiter on the shared bus lets every note run "hot" (peak gain up near 1.0)
    // without the overlapping tails clipping/distorting into a harsh crackle — it's what
    // makes "louder" still sound clean instead of just turning into noise.
    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    limiter.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    const PEAK_GAIN = 0.9; // was 0.3 — noticeably louder, meant to cut through shop-floor noise
    const NOTE_GAP = 0.16;
    const NOTES = [880, 1174.66]; // ding-dong
    const REPEATS = 2; // plays the two-note chime twice back to back — more attention-grabbing

    for (let rep = 0; rep < REPEATS; rep++) {
      NOTES.forEach((freq, i) => {
        const start = now + rep * (NOTES.length * NOTE_GAP + 0.1) + i * NOTE_GAP;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        // 'triangle' carries more harmonic energy than 'sine' at the same amplitude, so it
        // reads as louder/brighter to the ear without just raising the raw level further.
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
        osc.connect(gain).connect(limiter);
        osc.start(start);
        osc.stop(start + 0.42);
      });
    }
  } catch (err) {
    // Logged, not swallowed — a silent failure here would look like "orders aren't
    // triggering sound" when the real cause is e.g. no AudioContext support at all.
    console.error('playNotificationSound failed', err);
  }
}
