export type EffectSound = "open" | "heart" | "flip" | "puzzle" | "gift" | "secret";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

function playTone(context: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

const soundNotes: Record<EffectSound, readonly number[]> = {
  open: [523.25, 659.25, 783.99],
  heart: [659.25, 783.99],
  flip: [493.88],
  puzzle: [392, 523.25],
  gift: [523.25, 659.25, 880],
  secret: [440, 659.25, 987.77],
};

/** Plays only after a user gesture invokes this function; no media file or network request is used. */
export function playEffectSound(effect: EffectSound, configuredVolume: number) {
  const context = getAudioContext();
  if (!context) return;
  const volume = Math.min(0.65, Math.max(0, configuredVolume)) * 0.24;
  if (volume <= 0) return;
  const schedule = () => {
    const start = context.currentTime + 0.01;
    soundNotes[effect].forEach((frequency, index) => {
      const duration = effect === "flip" ? 0.09 : 0.16;
      playTone(context, frequency, start + index * 0.075, duration, volume * (1 - index * 0.12), effect === "flip" ? "triangle" : "sine");
    });
  };
  if (context.state === "suspended") void context.resume().then(schedule).catch(() => undefined);
  else schedule();
}
