import { describe, expect, it, vi } from 'vitest';

import { createSoundController, type AudioContextFactory } from './sound';

function createFakeAudioContext() {
  const resume = vi.fn(() => Promise.resolve());
  const oscillatorStop = vi.fn();
  const createOscillator = vi.fn(() => ({
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    addEventListener: vi.fn(),
    start: vi.fn(),
    stop: oscillatorStop,
  }));
  const createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));
  const context = {
    currentTime: 0,
    destination: {},
    state: 'suspended' as AudioContextState,
    resume,
    createGain,
    createOscillator,
  } as unknown as AudioContext;

  return { context, createGain, createOscillator, oscillatorStop, resume };
}

describe('sound controller', () => {
  it('does not create or play audio until an interaction unlocks it', async () => {
    const fake = createFakeAudioContext();
    const factory = vi.fn<AudioContextFactory>(() => fake.context);
    const sound = createSoundController({ contextFactory: factory });

    sound.play('reveal');

    expect(factory).not.toHaveBeenCalled();
    expect(fake.createOscillator).not.toHaveBeenCalled();

    sound.unlock();
    sound.play('reveal');
    await Promise.resolve();

    expect(factory).toHaveBeenCalledOnce();
    expect(fake.resume).toHaveBeenCalledOnce();
    expect(fake.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('suppresses cues while muted and stops active tones when muted', async () => {
    const fake = createFakeAudioContext();
    const sound = createSoundController({
      contextFactory: () => fake.context,
    });

    sound.unlock();
    sound.play('lock');
    await Promise.resolve();
    expect(fake.createOscillator).toHaveBeenCalledTimes(2);
    expect(fake.oscillatorStop).toHaveBeenCalledTimes(2);

    sound.setMuted(true);
    expect(fake.oscillatorStop).toHaveBeenCalledTimes(4);

    sound.play('complete');
    expect(fake.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('does not schedule cues when the browser rejects audio resume', async () => {
    const fake = createFakeAudioContext();
    fake.resume.mockRejectedValueOnce(new Error('autoplay blocked'));
    const sound = createSoundController({
      contextFactory: () => fake.context,
    });

    sound.unlock();
    sound.play('lock');
    await Promise.resolve();

    expect(fake.createOscillator).not.toHaveBeenCalled();
  });

  it('remains safe when the browser has no audio context', () => {
    const sound = createSoundController({ contextFactory: undefined });

    expect(() => {
      sound.unlock();
      sound.play('share');
      sound.setMuted(true);
    }).not.toThrow();
  });
});
