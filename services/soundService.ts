// Subtle, non-excessive Web Audio API acoustic feedback service for Omni Flow
// Synthesizes soft, modern glassmorphic UI sounds with rate-limiting and user mute preference.

export type SoundEffectType =
  | 'click_soft'
  | 'drag_pickup'
  | 'drag_drop'
  | 'task_complete'
  | 'task_create'
  | 'notification'
  | 'chat_message'
  | 'state_updated'
  | 'warning'
  | 'timer_complete';

const SOUND_ENABLED_KEY = 'omni_ui_sounds_enabled_v1';

class SoundService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private lastPlayedAt: number = 0;
  private lastSoundByType: Record<string, number> = {};

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SOUND_ENABLED_KEY);
      this.enabled = saved === null ? true : saved === 'true';
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_ENABLED_KEY, String(val));
      window.dispatchEvent(new CustomEvent('omni_sound_pref_changed', { detail: { enabled: val } }));
    }
    if (val) {
      this.play('state_updated', true);
    }
  }

  public toggleEnabled(): boolean {
    const next = !this.enabled;
    this.setEnabled(next);
    return next;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public play(type: SoundEffectType, bypassCooldown = false): void {
    if (!this.enabled) return;

    const nowMs = Date.now();
    // Global anti-spam cooldown (minimum 160ms between any two sounds)
    if (!bypassCooldown && nowMs - this.lastPlayedAt < 160) {
      return;
    }
    // Per-type cooldown so rapid updates don't chime repeatedly
    const typeCooldown =
      type === 'notification' || type === 'chat_message'
        ? 1200
        : type === 'task_complete' || type === 'task_create'
        ? 450
        : 220;

    if (!bypassCooldown && nowMs - (this.lastSoundByType[type] || 0) < typeCooldown) {
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    this.lastPlayedAt = nowMs;
    this.lastSoundByType[type] = nowMs;

    const now = ctx.currentTime;

    try {
      switch (type) {
        case 'click_soft': {
          this.playTone(ctx, 520, 640, now, 0.045, 0.04, 'sine');
          break;
        }
        case 'drag_pickup': {
          this.playTone(ctx, 340, 460, now, 0.06, 0.045, 'sine');
          break;
        }
        case 'drag_drop': {
          // Soft wooden/glass tactile lock-in pop
          this.playTone(ctx, 420, 580, now, 0.075, 0.065, 'triangle');
          break;
        }
        case 'state_updated': {
          // Crisp micro-confirmation two-step
          this.playTone(ctx, 587.33, 587.33, now, 0.07, 0.05, 'sine'); // D5
          this.playTone(ctx, 880, 880, now + 0.055, 0.11, 0.055, 'sine'); // A5
          break;
        }
        case 'task_create': {
          // Warm ascending fifth (C5 -> G5)
          this.playTone(ctx, 523.25, 523.25, now, 0.08, 0.06, 'sine');
          this.playTone(ctx, 783.99, 783.99, now + 0.065, 0.14, 0.065, 'sine');
          break;
        }
        case 'task_complete': {
          // Pleasant major triad shimmer (C5 -> E5 -> G5 -> C6)
          this.playTone(ctx, 523.25, 523.25, now, 0.10, 0.06, 'sine');
          this.playTone(ctx, 659.25, 659.25, now + 0.055, 0.12, 0.065, 'sine');
          this.playTone(ctx, 783.99, 783.99, now + 0.11, 0.18, 0.07, 'sine');
          break;
        }
        case 'notification': {
          // Gentle glass marimba two-note chime (E5 -> B5)
          this.playTone(ctx, 659.25, 659.25, now, 0.11, 0.065, 'sine');
          this.playTone(ctx, 987.77, 987.77, now + 0.08, 0.18, 0.06, 'sine');
          break;
        }
        case 'chat_message': {
          // Soft water-drop pop (G5 -> D6)
          this.playTone(ctx, 783.99, 987.77, now, 0.085, 0.055, 'sine');
          break;
        }
        case 'warning': {
          // Muted low double-tap (A3 -> F3)
          this.playTone(ctx, 260, 220, now, 0.09, 0.055, 'triangle');
          this.playTone(ctx, 210, 185, now + 0.08, 0.12, 0.05, 'triangle');
          break;
        }
        case 'timer_complete': {
          // Calm harmonic bell chord
          this.playTone(ctx, 523.25, 523.25, now, 0.35, 0.07, 'sine');
          this.playTone(ctx, 659.25, 659.25, now + 0.09, 0.35, 0.065, 'sine');
          this.playTone(ctx, 1046.5, 1046.5, now + 0.18, 0.45, 0.07, 'sine');
          break;
        }
      }
    } catch {
      // Ignore audio synthesis errors if browser blocks audio before user gesture
    }
  }

  private playTone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    oscType: OscillatorType = 'sine'
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = oscType;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    }

    // Smooth click-free envelope
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.015, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}

export const soundService = new SoundService();
export default soundService;
