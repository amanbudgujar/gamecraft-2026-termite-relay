// soundManager.js - Web Audio API Sound Effects Synthesizer

class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  // Initialize context on first user click (bypasses browser autoplay policy)
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 1. Jump: Soft termite hop
  playJump() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(280, this.ctx.currentTime + 0.07);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.07);
  }

  // 2. Pod Pickup: Bright, quick chime
  playPodPickup() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.05); // E6

    gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // 3. Colony Nest Delivery: Warmer success chime (pass doubleCount = true for dual delivery)
  playDepotDelivery(doubleCount = false) {
    if (this.isMuted || !this.ctx) return;
    const notes = doubleCount ? [261.63, 329.63, 392.00, 523.25] : [261.63, 329.63, 392.00]; // C4, E4, G4, (C5)
    const duration = doubleCount ? 0.35 : 0.22;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.05);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.05 + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + idx * 0.05);
      osc.stop(this.ctx.currentTime + idx * 0.05 + 0.1);
    });
  }

  // 4. Beetle Hit / Stun: Short bump + dazed wobble pitch
  playBeetleHit() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // 5. Recovery Immunity: Gentle rising shimmer
  playRecoveryImmunity() {
    if (this.isMuted || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.04);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.04 + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + idx * 0.04);
      osc.stop(this.ctx.currentTime + idx * 0.04 + 0.08);
    });
  }

  // 6. Timer Warning: Subtle tick or pulse (call every second under 10s)
  playTimerWarning() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(750, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  // 7. Level Complete: Clear celebratory 8-bit stinger
  playLevelComplete() {
    if (this.isMuted || !this.ctx) return;
    const sequence = [
      { f: 523.25, d: 0.1 },  // C5
      { f: 659.25, d: 0.1 },  // E5
      { f: 783.99, d: 0.1 },  // G5
      { f: 1046.50, d: 0.3 }  // C6 (held)
    ];

    let startTime = this.ctx.currentTime;
    sequence.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + note.d);
      startTime += note.d * 0.8;
    });
  }

  // 8. Portal Warp: rising-then-falling sweep with a bright shimmer layer
  playPortalWarp() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);

    const shimmer = this.ctx.createOscillator();
    const shimmerGain = this.ctx.createGain();

    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(660, this.ctx.currentTime);
    shimmer.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.15);

    shimmerGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    shimmerGain.gain.exponentialRampToValueAtTime(0.09, this.ctx.currentTime + 0.06);
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.ctx.destination);
    shimmer.start();
    shimmer.stop(this.ctx.currentTime + 0.22);
  }

  // 9. Time Up: Short neutral end cue
  playTimeUp() {
    if (this.isMuted || !this.ctx) return;
    const sequence = [
      { f: 440.00, d: 0.12 }, // A4
      { f: 349.23, d: 0.12 }, // F4
      { f: 293.66, d: 0.25 }  // D4
    ];

    let startTime = this.ctx.currentTime;
    sequence.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + note.d);
      startTime += note.d * 0.9;
    });
  }
}

export const sounds = new SoundManager();