import { DisasterId } from './types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.65;
  private muted = false;
  private ambientNodes: AudioNode[] = [];
  private ambientTimer: number | null = null;
  private calmMusicGain: GainNode | null = null;
  private calmNatureGain: GainNode | null = null;
  private lastStepTime = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
  }

  public stopAmbient(): void {
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    for (const node of this.ambientNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this.ambientNodes = [];
    this.calmMusicGain = null;
    this.calmNatureGain = null;
  }

  public startMenuAmbient(): void {
    this.stopAmbient();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 55;
    osc2.type = 'triangle';
    osc2.frequency.value = 82.4;

    filter.type = 'lowpass';
    filter.frequency.value = 220;
    gain.gain.value = 0.06;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    this.ambientNodes.push(osc1, osc2, filter, gain);
  }

  public startDisasterAmbient(disaster: DisasterId): void {
    this.stopAmbient();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // White noise buffer for rain, fire crackle, or rumble
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (disaster === 'flood') {
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.6;
      gain.gain.value = 0.08;
    } else if (disaster === 'fire') {
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      gain.gain.value = 0.065;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 140;
      gain.gain.value = 0.05;
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
    this.ambientNodes.push(noise, filter, gain);
  }

  public startCalmAmbient(musicVol = 0.55, natureVol = 0.65): void {
    this.stopAmbient();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const musicGain = ctx.createGain();
    musicGain.gain.value = Math.max(0, Math.min(1, musicVol)) * 0.14;
    musicGain.connect(this.masterGain);
    this.calmMusicGain = musicGain;

    const natureGain = ctx.createGain();
    natureGain.gain.value = Math.max(0, Math.min(1, natureVol)) * 0.12;
    natureGain.connect(this.masterGain);
    this.calmNatureGain = natureGain;

    // Warm harmonic ambient pad (C3 + G3 + D4 + E4 soft sine wash)
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.connect(musicGain);
    this.ambientNodes.push(musicGain, natureGain, padFilter);

    const padFreqs = [130.81, 196.0, 293.66, 329.63];
    padFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      g.gain.value = idx < 2 ? 0.28 : 0.12;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      this.ambientNodes.push(osc, g);
    });

    // Gentle filtered breeze & soft brook flow (pinkish smoothed noise + slow LFO)
    const bufferSize = ctx.sampleRate * 3;
    const breezeBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const ch = breezeBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      ch[i] = lastOut * 2.6;
    }

    const breeze = ctx.createBufferSource();
    breeze.buffer = breezeBuffer;
    breeze.loop = true;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 380;
    breezeFilter.Q.value = 0.7;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.11; // ~9-second gentle wind swell
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(breezeFilter.frequency);

    breeze.connect(breezeFilter);
    breezeFilter.connect(natureGain);
    breeze.start();
    lfo.start();
    this.ambientNodes.push(breeze, breezeFilter, lfo, lfoGain);

    // Gentle melodic pentatonic notes & birdsong chirps
    const melodyNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    let step = 0;
    this.ambientTimer = window.setInterval(() => {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      step += 1;

      // Peaceful harp/marimba melody note
      if (this.calmMusicGain && this.calmMusicGain.gain.value > 0.002) {
        const noteFreq = melodyNotes[(step * 3 + Math.floor(Math.random() * 2)) % melodyNotes.length];
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, t);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.24, t + 0.08);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        osc.connect(env);
        env.connect(this.calmMusicGain);
        osc.start(t);
        osc.stop(t + 2.25);
      }

      // Occasional soft songbird trill in nature layer
      if (step % 2 === 0 && this.calmNatureGain && this.calmNatureGain.gain.value > 0.002) {
        const chirps = Math.random() > 0.45 ? 2 : 3;
        const baseBird = 1950 + Math.random() * 650;
        for (let c = 0; c < chirps; c++) {
          const ct = t + 0.35 + c * 0.14;
          const bOsc = this.ctx.createOscillator();
          const bEnv = this.ctx.createGain();
          bOsc.type = 'sine';
          bOsc.frequency.setValueAtTime(baseBird + c * 140, ct);
          bOsc.frequency.exponentialRampToValueAtTime(baseBird * 1.18 + c * 90, ct + 0.055);
          bOsc.frequency.exponentialRampToValueAtTime(baseBird * 0.94, ct + 0.095);
          bEnv.gain.setValueAtTime(0.0001, ct);
          bEnv.gain.linearRampToValueAtTime(0.14, ct + 0.018);
          bEnv.gain.exponentialRampToValueAtTime(0.0001, ct + 0.1);
          bOsc.connect(bEnv);
          bEnv.connect(this.calmNatureGain);
          bOsc.start(ct);
          bOsc.stop(ct + 0.11);
        }
      }
    }, 2400);
  }

  public setCalmLevels(musicVol: number, natureVol: number): void {
    if (!this.ctx) return;
    if (this.calmMusicGain) {
      this.calmMusicGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, musicVol)) * 0.14,
        this.ctx.currentTime,
        0.06
      );
    }
    if (this.calmNatureGain) {
      this.calmNatureGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, natureVol)) * 0.12,
        this.ctx.currentTime,
        0.06
      );
    }
  }

  public playCalmChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const t = ctx.currentTime + idx * 0.055;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  public playBreathingCue(phase: 'inhale' | 'hold' | 'exhale'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const startFreq = phase === 'inhale' ? 329.63 : phase === 'hold' ? 392.0 : 293.66;
    const endFreq = phase === 'inhale' ? 392.0 : phase === 'hold' ? 392.0 : 261.63;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.35);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  public playFootstep(surface: 'floor' | 'water', running = false): void {
    const nowMs = performance.now();
    const minInterval = running ? 165 : 270;
    if (nowMs - this.lastStepTime < minInterval) return;
    this.lastStepTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (surface === 'water') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(running ? 290 : 230, t);
      osc.frequency.exponentialRampToValueAtTime(105, t + 0.11);
      gain.gain.setValueAtTime(running ? 0.1 : 0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime((running ? 142 : 118) + Math.random() * 24, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.055);
      gain.gain.setValueAtTime(running ? 0.062 : 0.042, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playDoorOpen(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(135, t + 0.18);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  public playImpactThud(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(88, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.25);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.29);
  }

  public playInteract(good = true): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (good) {
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.setValueAtTime(760, t + 0.07);
    } else {
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.setValueAtTime(160, t + 0.09);
    }
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playDamage(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playRumble(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(48, t);
    osc.frequency.linearRampToValueAtTime(36, t + 0.5);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.56);
  }

  public playFireAlarmPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(660, t + 0.14);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playThunder(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.65);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.72);
  }

  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const notes = [293.66, 261.63, 220, 164.81];
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }
}

export const soundEngine = new SoundEngine();
