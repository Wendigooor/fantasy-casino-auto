import { useState, useCallback } from "react";

type SoundName = "spin" | "win" | "click" | "reel";

const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.08) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playReelStop() {
  [800, 600, 400].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.08, "triangle", 0.05), i * 80);
  });
}

function playWinJingle() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, "sine", 0.06), i * 100);
  });
}

function playClick() {
  playTone(1200, 0.03, "square", 0.02);
}

const sounds: Record<SoundName, () => void> = {
  spin: () => {
    playClick();
    setTimeout(() => playReelStop(), 200);
  },
  win: () => {
    playWinJingle();
  },
  click: playClick,
  reel: playReelStop,
};

export function useSound() {
  const [muted, setMuted] = useState(false);

  const play = useCallback((name: SoundName) => {
    if (muted) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      sounds[name]();
    } catch { /* audio not supported */ }
  }, [muted]);

  return { play, muted, toggle: () => setMuted(!muted) };
}
