import { useAppStore } from '../store/useAppStore';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getMasterGain(customVolume?: number): { ctx: AudioContext; masterGain: GainNode } | null {
  const { soundEffectsEnabled, soundEffectsVolume } = useAppStore.getState();

  if (!soundEffectsEnabled && customVolume === undefined) {
    return null;
  }

  const volPercent = customVolume !== undefined ? customVolume : soundEffectsVolume;
  if (volPercent <= 0) return null;

  const ctx = getAudioContext();
  if (!ctx) return null;

  const now = ctx.currentTime;
  const masterVolume = (volPercent / 100) * 0.25;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(masterVolume, now);
  masterGain.connect(ctx.destination);

  return { ctx, masterGain };
}

/**
 * Plays a cheerful, crystal-clear achievement unlock chime synthesized via Web Audio API.
 * Major pentatonic / fanfare sparkle: C5 -> E5 -> G5 -> C6 -> E6
 */
export function playAchievementSound(customVolume?: number): void {
  const audio = getMasterGain(customVolume);
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const notes = [
    { freq: 523.25, time: 0.0, dur: 0.25, gain: 0.6 }, // C5
    { freq: 659.25, time: 0.08, dur: 0.28, gain: 0.7 }, // E5
    { freq: 783.99, time: 0.16, dur: 0.35, gain: 0.8 }, // G5
    { freq: 1046.5, time: 0.26, dur: 0.65, gain: 1.0 }, // C6 (Peak)
    { freq: 1318.5, time: 0.34, dur: 0.55, gain: 0.5 }, // E6 (Sparkle)
  ];

  notes.forEach(({ freq, time, dur, gain: noteGainMultiplier }) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    noteGain.gain.setValueAtTime(0.0001, now + time);
    noteGain.gain.exponentialRampToValueAtTime(noteGainMultiplier, now + time + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);

    // Subtle harmonic shimmer overtone
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(freq * 2, now + time);

    shimmerGain.gain.setValueAtTime(0.0001, now + time);
    shimmerGain.gain.exponentialRampToValueAtTime(noteGainMultiplier * 0.2, now + time + 0.02);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur * 0.7);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(masterGain);

    shimmer.start(now + time);
    shimmer.stop(now + time + dur + 0.05);
  });
}

/**
 * Snappy tactile toggle click when enabling or disabling a mod.
 * enabled = true: rising chirp (480Hz -> 920Hz)
 * enabled = false: soft falling click (680Hz -> 360Hz)
 */
export function playToggleSound(enabled: boolean): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (enabled) {
    // Rising crisp chirp
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.045);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.055);
  } else {
    // Soft descending switch
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.04);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

/**
 * Energetic arcade power-up chime when clicking Launch Game.
 */
export function playLaunchGameSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  // 1. Rising sweep
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = 'sine';
  sweep.frequency.setValueAtTime(220, now);
  sweep.frequency.exponentialRampToValueAtTime(880, now + 0.22);

  sweepGain.gain.setValueAtTime(0.001, now);
  sweepGain.gain.linearRampToValueAtTime(0.5, now + 0.1);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  sweep.connect(sweepGain);
  sweepGain.connect(masterGain);

  sweep.start(now);
  sweep.stop(now + 0.26);

  // 2. Bright launch chord
  const chordNotes = [523.25, 659.25, 1046.5]; // C5, E5, C6
  chordNotes.forEach((freq) => {
    const chordOsc = ctx.createOscillator();
    const chordGain = ctx.createGain();

    chordOsc.type = 'triangle';
    chordOsc.frequency.setValueAtTime(freq, now + 0.2);

    chordGain.gain.setValueAtTime(0.0001, now + 0.2);
    chordGain.gain.linearRampToValueAtTime(0.4, now + 0.22);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    chordOsc.connect(chordGain);
    chordGain.connect(masterGain);

    chordOsc.start(now + 0.2);
    chordOsc.stop(now + 0.6);
  });
}

/**
 * Positive 3-tone ascending chime when an archive or GameBanana mod finishes installing.
 */
export function playInstallSuccessSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const notes = [
    { freq: 659.25, time: 0.0, dur: 0.15 }, // E5
    { freq: 880.0, time: 0.07, dur: 0.18 }, // A5
    { freq: 1174.66, time: 0.15, dur: 0.35 }, // D6
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.6, now + time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
  });
}

/**
 * Clean double-pop chime when cloud database sync completes.
 */
export function playSyncSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const notes = [
    { freq: 587.33, time: 0.0, dur: 0.12 }, // D5
    { freq: 880.0, time: 0.08, dur: 0.28 }, // A5
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.5, now + time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
  });
}

/**
 * Rapid dice roll rattle resolving into a randomizer affirmative chime.
 */
export function playRandomizerSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  // 4 rapid rhythmic clicks
  const clicks = [
    { freq: 620, time: 0.0 },
    { freq: 780, time: 0.04 },
    { freq: 590, time: 0.08 },
    { freq: 940, time: 0.12 },
  ];

  clicks.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.4, now + time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + 0.025);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + 0.03);
  });

  // Resolving chord ding
  const chord = [659.25, 1046.5]; // E5, C6
  chord.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + 0.18);

    gain.gain.setValueAtTime(0.0001, now + 0.18);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now + 0.18);
    osc.stop(now + 0.5);
  });
}

/**
 * Soft muted thud/pop when deleting a mod.
 */
export function playTrashSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * 8-bit retro arcade fanfare when entering the Konami Code.
 */
export function playKonamiSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const arpeggio = [
    { freq: 261.63, time: 0.0, dur: 0.06 }, // C4
    { freq: 329.63, time: 0.06, dur: 0.06 }, // E4
    { freq: 392.0, time: 0.12, dur: 0.06 }, // G4
    { freq: 523.25, time: 0.18, dur: 0.06 }, // C5
    { freq: 659.25, time: 0.24, dur: 0.06 }, // E5
    { freq: 783.99, time: 0.3, dur: 0.06 }, // G5
    { freq: 1046.5, time: 0.36, dur: 0.28 }, // C6
  ];

  arpeggio.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.3, now + time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
  });
}

/**
 * Rich camera sequence: Autofocus lock confirmation chirps + motorized lens arming
 * culminating in a crisp, multi-stage mechanical camera shutter snap.
 */
export function playQuickSnapSuccessSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  // --- Phase 1: Optical Auto-Focus Lock Beeps (t = 0.0s & t = 0.065s) ---
  const playFocusBeep = (time: number, freq: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  };

  playFocusBeep(now, 1046.5, 0.035); // C6 focus blip 1
  playFocusBeep(now + 0.065, 1396.91, 0.04); // F6 focus blip 2 (rising confirmation)

  // --- Phase 2: Motorized Lens / Aperture Pre-tension Sweep (t = 0.11s) ---
  const motorOsc = ctx.createOscillator();
  const motorGain = ctx.createGain();
  motorOsc.type = 'sawtooth';
  motorOsc.frequency.setValueAtTime(320, now + 0.11);
  motorOsc.frequency.exponentialRampToValueAtTime(780, now + 0.16);

  const motorFilter = ctx.createBiquadFilter();
  motorFilter.type = 'lowpass';
  motorFilter.frequency.setValueAtTime(1400, now + 0.11);

  motorGain.gain.setValueAtTime(0.0001, now + 0.11);
  motorGain.gain.linearRampToValueAtTime(0.18, now + 0.13);
  motorGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

  motorOsc.connect(motorFilter);
  motorFilter.connect(motorGain);
  motorGain.connect(masterGain);

  motorOsc.start(now + 0.11);
  motorOsc.stop(now + 0.175);

  // --- Phase 3: The Mechanical Camera Shutter (Culmination at t = 0.18s -> 0.28s) ---
  const playShutterBlade = (
    time: number,
    freq: number,
    qVal: number,
    volume: number,
    dur: number
  ) => {
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(qVal, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(time);
  };

  const playShutterTransient = (
    time: number,
    startFreq: number,
    endFreq: number,
    volume: number,
    dur: number
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + dur);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  };

  // 1. Shutter Mirror Up ("Ka-") at t = 0.175s
  playShutterBlade(now + 0.175, 3400, 2.0, 0.5, 0.022);
  playShutterTransient(now + 0.175, 2200, 900, 0.45, 0.018);

  // 2. Main Shutter Curtain Closure Snap ("-CHAAK!") at t = 0.225s
  const snapTime = now + 0.225;
  playShutterBlade(snapTime, 2400, 1.5, 0.65, 0.035);
  playShutterTransient(snapTime, 1400, 420, 0.6, 0.028);

  // Metallic shutter body ring tail
  const ringOsc = ctx.createOscillator();
  const ringGain = ctx.createGain();
  ringOsc.type = 'sine';
  ringOsc.frequency.setValueAtTime(1760, snapTime); // A6 metallic sheen
  ringOsc.frequency.exponentialRampToValueAtTime(880, snapTime + 0.08);

  ringGain.gain.setValueAtTime(0.0001, snapTime);
  ringGain.gain.linearRampToValueAtTime(0.25, snapTime + 0.005);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, snapTime + 0.09);

  ringOsc.connect(ringGain);
  ringGain.connect(masterGain);

  ringOsc.start(snapTime);
  ringOsc.stop(snapTime + 0.1);
}

/**
 * Soft descending warning chime when Quick Snap cannot proceed.
 */
export function playQuickSnapErrorSound(): void {
  const audio = getMasterGain();
  if (!audio) return;
  const { ctx, masterGain } = audio;
  const now = ctx.currentTime;

  const notes = [
    { freq: 329.63, time: 0.0, dur: 0.12 }, // E4
    { freq: 220.0, time: 0.09, dur: 0.2 }, // A3
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.25, now + time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
  });
}
