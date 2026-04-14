// Audio engine — uses HTMLAudioElement for reliable iOS Safari playback.
//
// Web Audio API (AudioContext + decodeAudioData) has a known iOS bug where
// decodeAudioData silently hangs forever when the context is suspended.
// The context gets suspended by the async DeviceMotionEvent.requestPermission()
// dialog, and cannot always be resumed outside a user gesture.
//
// HTMLAudioElement.play() is natively supported on iOS without any of this,
// and once unlocked by a single tap it can be called programmatically forever —
// including from accelerometer events and the test button.

class AudioEngine {
  constructor() {
    this.elements = new Map();   // filename → HTMLAudioElement
    this.volume   = 1.0;
    this.current  = null;        // the currently playing <audio> element
    this._unlocked = false;
  }

  // Unlocks iOS HTML5 audio by playing a zero-volume silent sound.
  // MUST be called synchronously inside a user tap handler.
  // After this, el.play() can be called from any context (accelerometer, timers, etc.)
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;

    // Minimal valid WAV (44 bytes, 1 channel, 0 samples) as a data URI.
    // Playing it in the tap handler is what satisfies iOS's "user gesture" requirement.
    const el = document.createElement('audio');
    el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    el.volume = 0;
    el.play().catch(() => {});
  }

  // Creates <audio> elements for every spell file.
  // Completes immediately — no decoding, no hanging.
  // iOS will load the actual audio on first play() call.
  async preload(filenames) {
    filenames.forEach(filename => {
      if (this.elements.has(filename)) return;
      const el = document.createElement('audio');
      el.src      = `audio/${filename}`;
      el.preload  = 'auto';
      el.volume   = this.volume;
      this.elements.set(filename, el);
    });
    // Brief yield so the caller can update UI before returning
    await new Promise(r => setTimeout(r, 80));
  }

  // Plays a spell. Stops any currently playing spell first.
  async play(filename) {
    const el = this.elements.get(filename);
    if (!el) return;

    // Stop the current spell
    if (this.current) {
      try {
        this.current.pause();
        this.current.currentTime = 0;
      } catch (_) {}
    }

    el.volume      = this.volume;
    el.currentTime = 0;
    try {
      await el.play();
      this.current = el;
    } catch (e) {
      console.warn('DeviceMagic: play failed for', filename, e);
    }
  }

  // Sets master volume (0.0 – 1.0). Applied to all elements immediately.
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.elements.forEach(el => { el.volume = this.volume; });
  }

  // True once unlock() has been called and elements are registered.
  get isReady() {
    return this._unlocked && this.elements.size > 0;
  }
}
