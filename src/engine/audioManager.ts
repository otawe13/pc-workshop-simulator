import { GameSettings } from '../types/game';

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private fanOsc: OscillatorNode | null = null;
  private fanGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private settings: GameSettings = {
    graphicsQuality: 'medium',
    masterVolume: 0.7,
    sfxVolume: 0.85,
    musicVolume: 0.35,
    muted: false,
    showFps: false,
    language: 'id',
    cameraSensitivity: 1,
    cameraSpeed: 1,
    uiScale: 'normal',
    showHints: true,
    showObjectives: true,
    showHardwareEducation: true,
  };

  private ensureContext(): AudioContext | null {
    if (this.settings.muted || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination);
        this.applyGain();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public updateSettings(settings: GameSettings): void {
    this.settings = settings;
    this.applyGain();
    if (settings.muted && this.fanGain) {
      this.fanGain.gain.value = 0;
    }
    if (settings.muted || settings.musicVolume <= 0.01) {
      this.stopAmbientMusic();
    }
  }

  private applyGain(): void {
    if (!this.ctx) return;
    if (this.masterGain) {
      const vol = this.settings.muted ? 0 : this.settings.masterVolume * this.settings.sfxVolume;
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
    if (this.musicGain) {
      const mVol = this.settings.muted ? 0 : this.settings.masterVolume * (this.settings.musicVolume ?? 0.35) * 0.22;
      this.musicGain.gain.setValueAtTime(mVol, this.ctx.currentTime);
    }
  }

  public startAmbientMusic(): void {
    if (typeof window === 'undefined' || this.musicTimer !== null) return;
    if (this.settings.muted || (this.settings.musicVolume ?? 0) <= 0.01) return;
    const notes = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 392.0];
    this.musicTimer = window.setInterval(() => {
      if (this.settings.muted || (this.settings.musicVolume ?? 0) <= 0.01) return;
      const ctx = this.ensureContext();
      if (!ctx || !this.musicGain || ctx.state !== 'running') return;
      const freq = notes[this.musicStep % notes.length];
      this.musicStep++;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 1.55);
    }, 1800);
  }

  public stopAmbientMusic(): void {
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.14, delay = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(gainVal, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  public playClick(): void {
    this.tone(720, 0.045, 'triangle', 0.08);
  }

  public playConfirm(): void {
    this.tone(523.25, 0.09, 'sine', 0.12, 0);
    this.tone(659.25, 0.12, 'sine', 0.12, 0.07);
  }

  public playError(): void {
    this.tone(190, 0.14, 'sawtooth', 0.14, 0);
    this.tone(150, 0.18, 'sawtooth', 0.14, 0.12);
  }

  public playInstallPart(): void {
    this.tone(320, 0.06, 'square', 0.08, 0);
    this.tone(640, 0.09, 'triangle', 0.14, 0.05);
  }

  public playScrewdriver(): void {
    this.tone(440, 0.035, 'sawtooth', 0.06, 0);
    this.tone(520, 0.035, 'sawtooth', 0.06, 0.055);
    this.tone(600, 0.045, 'triangle', 0.08, 0.11);
  }

  public playPowerOn(): void {
    this.tone(110, 0.12, 'triangle', 0.12, 0);
    this.tone(240, 0.2, 'sine', 0.1, 0.08);
  }

  public playPostBeeps(count: number): void {
    for (let i = 0; i < Math.min(count, 5); i++) {
      this.tone(1040, count === 1 ? 0.12 : 0.22, 'square', 0.11, 0.25 + i * 0.3);
    }
  }

  public playCustomerArrival(): void {
    this.tone(784, 0.12, 'sine', 0.11, 0);
    this.tone(1046.5, 0.22, 'sine', 0.11, 0.11);
  }

  public playPayment(): void {
    this.tone(880, 0.08, 'triangle', 0.13, 0);
    this.tone(1174.66, 0.1, 'triangle', 0.13, 0.08);
    this.tone(1567.98, 0.22, 'sine', 0.14, 0.16);
  }

  public setFanHum(running: boolean): void {
    if (!running || this.settings.muted) {
      if (this.fanGain && this.ctx) {
        this.fanGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (!this.fanOsc || !this.fanGain) {
      this.fanOsc = ctx.createOscillator();
      this.fanGain = ctx.createGain();
      this.fanOsc.type = 'triangle';
      this.fanOsc.frequency.value = 68;
      this.fanGain.gain.value = 0;
      this.fanOsc.connect(this.fanGain);
      this.fanGain.connect(this.masterGain);
      this.fanOsc.start();
    }
    this.fanGain.gain.setTargetAtTime(0.025, ctx.currentTime, 0.15);
  }
}

export const audioManager = new AudioManager();
