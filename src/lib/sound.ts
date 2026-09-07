import { createContext, useContext } from 'react';

export type SoundCue = 'reveal' | 'lock' | 'complete' | 'share';

export type AudioContextFactory = () => AudioContext;

export type SoundController = Readonly<{
  unlock: () => void;
  play: (cue: SoundCue) => void;
  setMuted: (muted: boolean) => void;
}>;

type Tone = Readonly<{
  frequency: number;
  offset: number;
  duration: number;
  volume: number;
}>;

type CueDefinition = Readonly<{
  duration: number;
  tones: readonly Tone[];
}>;

const CUE_DEFINITIONS: Readonly<Record<SoundCue, CueDefinition>> = {
  reveal: {
    duration: 0.22,
    tones: [
      { frequency: 220, offset: 0, duration: 0.12, volume: 0.55 },
      { frequency: 440, offset: 0.055, duration: 0.15, volume: 0.4 },
    ],
  },
  lock: {
    duration: 0.18,
    tones: [
      { frequency: 260, offset: 0, duration: 0.08, volume: 0.5 },
      { frequency: 390, offset: 0.025, duration: 0.12, volume: 0.42 },
    ],
  },
  complete: {
    duration: 0.42,
    tones: [
      { frequency: 330, offset: 0, duration: 0.22, volume: 0.42 },
      { frequency: 440, offset: 0.08, duration: 0.25, volume: 0.36 },
      { frequency: 660, offset: 0.16, duration: 0.24, volume: 0.3 },
    ],
  },
  share: {
    duration: 0.27,
    tones: [
      { frequency: 440, offset: 0, duration: 0.13, volume: 0.42 },
      { frequency: 587.33, offset: 0.08, duration: 0.17, volume: 0.36 },
    ],
  },
};

const SILENT_SOUND_CONTROLLER: SoundController = {
  unlock: () => undefined,
  play: () => undefined,
  setMuted: () => undefined,
};

type WindowWithWebkitAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getDefaultAudioContextFactory(): AudioContextFactory | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const audioContextConstructor =
    window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;

  if (!audioContextConstructor) {
    return undefined;
  }

  return () => new audioContextConstructor();
}

export function createSoundController(
  options: {
    readonly muted?: boolean;
    readonly contextFactory?: AudioContextFactory;
  } = {},
): SoundController {
  const contextFactory = options.contextFactory ?? getDefaultAudioContextFactory();
  let audioContext: AudioContext | undefined;
  let isMuted = options.muted ?? false;
  let isUnlocked = false;
  let isResuming = false;
  const pendingCues: SoundCue[] = [];
  const activeOscillators = new Set<OscillatorNode>();

  function unlock() {
    if (isMuted || isUnlocked || isResuming || !contextFactory) {
      return;
    }

    try {
      const nextAudioContext = contextFactory();
      audioContext = nextAudioContext;
      isResuming = true;
      const resumeResult = nextAudioContext.resume();
      void resumeResult.then(
        () => {
          isResuming = false;
          if (isMuted || audioContext !== nextAudioContext || nextAudioContext.state === 'closed') {
            pendingCues.length = 0;
            return;
          }

          isUnlocked = true;
          const cuesToPlay = pendingCues.splice(0);
          cuesToPlay.forEach(scheduleCue);
        },
        () => {
          isResuming = false;
          isUnlocked = false;
          pendingCues.length = 0;
          if (audioContext === nextAudioContext) {
            audioContext = undefined;
          }
        },
      );
    } catch {
      // Audio is an enhancement. Unsupported devices and blocked contexts must not affect play.
      isResuming = false;
      isUnlocked = false;
      pendingCues.length = 0;
      audioContext = undefined;
    }
  }

  function play(cue: SoundCue) {
    if (isMuted) {
      return;
    }

    if (!isUnlocked) {
      if (isResuming && pendingCues.length < 8) {
        pendingCues.push(cue);
      }
      return;
    }

    scheduleCue(cue);
  }

  function scheduleCue(cue: SoundCue) {
    if (!audioContext || audioContext.state === 'closed') {
      return;
    }

    const definition = CUE_DEFINITIONS[cue];
    if (!definition) {
      return;
    }

    try {
      const startAt = audioContext.currentTime + 0.01;
      const output = audioContext.createGain();
      output.gain.setValueAtTime(0.0001, startAt);
      output.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
      output.gain.exponentialRampToValueAtTime(0.0001, startAt + definition.duration);
      output.connect(audioContext.destination);

      for (const tone of definition.tones) {
        const oscillator = audioContext.createOscillator();
        const toneGain = audioContext.createGain();
        const toneStart = startAt + tone.offset;
        const toneEnd = toneStart + tone.duration;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        toneGain.gain.setValueAtTime(tone.volume, toneStart);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
        oscillator.connect(toneGain);
        toneGain.connect(output);
        oscillator.addEventListener('ended', () => activeOscillators.delete(oscillator), {
          once: true,
        });
        activeOscillators.add(oscillator);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd + 0.02);
      }
    } catch {
      // A browser can reject an individual scheduled node even after the context unlocks.
    }
  }

  function setMuted(muted: boolean) {
    isMuted = muted;
    if (!muted) {
      return;
    }

    pendingCues.length = 0;

    for (const oscillator of activeOscillators) {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may have ended between the set iteration and stop call.
      }
    }
    activeOscillators.clear();
  }

  return { unlock, play, setMuted };
}

export const SoundContext = createContext<SoundController>(SILENT_SOUND_CONTROLLER);

export function useSound(): SoundController {
  return useContext(SoundContext);
}
