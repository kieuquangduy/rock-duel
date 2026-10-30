/**
 * Web Audio API Sound Synthesizer
 * 100% procedural sound effects - no external audio files required!
 */
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Gunshot - punchy explosive crack with bass thump & reverb decay
  playGunshot(isOpponent = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const volumeMult = isOpponent ? 0.6 : 1.0;

    // 1. Noise blast (high frequency snap)
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(isOpponent ? 1200 : 2500, t);
    noiseFilter.Q.setValueAtTime(1.5, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8 * volumeMult, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    // 2. Sub-bass boom
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, t);
    subOsc.frequency.exponentialRampToValueAtTime(35, t + 0.25);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.9 * volumeMult, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.35);
  }

  // Bullet ricochet hitting rock (metallic 'tweeeng' / spark)
  playRicochet() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    
    // Quick pitch dive for ricochet twang
    osc.frequency.setValueAtTime(1800 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(250 + Math.random() * 100, t + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Hitmarker / Headshot confirmed ding
  playHitmarker() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.setValueAtTime(2400, t + 0.05);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Bolt action cocking sound
  playBoltCycle() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Click 1: Bolt open
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(600, t + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.15, t + 0.15);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t + 0.15);
    osc1.stop(t + 0.26);

    // Click 2: Bolt close (cocked)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(800, t + 0.45);
    osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.52);
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.2, t + 0.45);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + 0.45);
    osc2.stop(t + 0.56);
  }

  // Victory fanfare
  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.12;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  // Defeat sound
  playDefeat() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [350, 310, 260, 200];
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.18;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // --- TANK DUEL SOUND EFFECTS ---

  // Massive 120mm tank cannon blast: deafening shockwave & muzzle blast
  playTankCannon(isOpponent = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const volumeMult = isOpponent ? 0.7 : 1.0;

    // 1. Massive White Noise Blast (gunpowder ignition)
    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.15));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(isOpponent ? 1800 : 3500, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.5);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0 * volumeMult, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    // 2. Heavy Sub-bass shockwave (chest-thumping boom)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.45);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(1.2 * volumeMult, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.6);
  }

  // Tank Shell Impact (Armor hit / penetration)
  playTankHit(penetrated = true) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Metal clang
    const clang = this.ctx.createOscillator();
    clang.type = 'triangle';
    clang.frequency.setValueAtTime(penetrated ? 450 : 850, t);
    clang.frequency.exponentialRampToValueAtTime(80, t + 0.35);

    const clangGain = this.ctx.createGain();
    clangGain.gain.setValueAtTime(penetrated ? 0.8 : 0.6, t);
    clangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    clang.connect(clangGain);
    clangGain.connect(this.ctx.destination);
    clang.start(t);
    clang.stop(t + 0.4);

    if (penetrated) {
      // Armor breach crunch
      const bufferSize = this.ctx.sampleRate * 0.3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(t);
    }
  }

  // Tank Catastrophic Explosion (When HP drops to 0)
  playTankExplosion() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Low rumble boom
    const boom = this.ctx.createOscillator();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(110, t);
    boom.frequency.exponentialRampToValueAtTime(20, t + 1.2);

    const boomGain = this.ctx.createGain();
    boomGain.gain.setValueAtTime(1.3, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    boom.connect(boomGain);
    boomGain.connect(this.ctx.destination);
    boom.start(t);
    boom.stop(t + 1.3);

    // Blast noise
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    noise.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
  }

  // Autoloader / Shell Breech reload sound
  playTankReload() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Clunk 1: Breech open
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(450, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.25, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc1.connect(g1);
    g1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.16);

    // Clunk 2: Shell locked in breech (Ready)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(600, t + 0.25);
    osc2.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.3, t + 0.25);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc2.connect(g2);
    g2.connect(this.ctx.destination);
    osc2.start(t + 0.25);
    osc2.stop(t + 0.42);
  }
}

export const sounds = new SoundSynthesizer();
