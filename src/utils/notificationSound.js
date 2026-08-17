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
// not just that we attempted one. Used to decide whether to show the "Enable Order
// Alerts" prompt.
export function isAudioUnlocked() {
  return !!ctx && ctx.state === 'running';
}

export function playNotificationSound() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    // Browsers suspend a freshly-created (or long-idle) AudioContext until it's resumed
    // from inside a user-gesture-adjacent call stack; resume() is a no-op if already running,
    // and a no-op (context stays suspended) if called with no gesture in the call stack.
    audioCtx.resume();

    const now = audioCtx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const start = now + i * 0.15;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch (err) {
    // Logged, not swallowed — a silent failure here would look like "orders aren't
    // triggering sound" when the real cause is e.g. no AudioContext support at all.
    console.error('playNotificationSound failed', err);
  }
}
