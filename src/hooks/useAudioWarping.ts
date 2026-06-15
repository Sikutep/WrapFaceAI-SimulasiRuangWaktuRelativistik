import { useEffect, useRef, useState } from 'react';

export function useAudioWarping(isReady: boolean, dopplerFactor: number, speed: number, stream: MediaStream | null) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const oscGainRef = useRef<GainNode | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !stream) return;

    async function initAudio() {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream!);

        // === FILTER (Doppler frequency shift) ===
        const filter = ctx.createBiquadFilter();
        filter.type = 'allpass';
        filterRef.current = filter;

        // === DELAY + FEEDBACK (Space Echo / Reverb) ===
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.0;
        delayRef.current = delay;

        const feedback = ctx.createGain();
        feedback.gain.value = 0.0;
        feedbackRef.current = feedback;

        // Master gain
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        gainRef.current = gain;

        // === ENGINE HUM OSCILLATOR ===
        const oscillator = ctx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 40; // Deep bass hum
        oscillatorRef.current = oscillator;

        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.0; // Silent by default
        oscGainRef.current = oscGain;

        // === SIGNAL CHAIN ===
        // Mic → Filter → Delay → Master Gain → Speakers
        source.connect(filter);
        filter.connect(delay);
        delay.connect(gain);

        // Delay feedback loop: Delay → Feedback Gain → Delay
        delay.connect(feedback);
        feedback.connect(delay);

        // Engine hum: Oscillator → Osc Gain → Speakers
        oscillator.connect(oscGain);
        oscGain.connect(ctx.destination);
        oscillator.start();

        // Final output
        gain.connect(ctx.destination);

      } catch (err) {
        console.error("Audio initialization failed:", err);
        setAudioError((err as Error).message);
      }
    }

    initAudio();

    return () => {
      if (oscillatorRef.current) {
        try { oscillatorRef.current.stop(); } catch (_) { /* already stopped */ }
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [isReady, stream]);

  // === UPDATE AUDIO EFFECTS EVERY RENDER ===
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !filterRef.current || !delayRef.current || !feedbackRef.current) return;
    if (!oscillatorRef.current || !oscGainRef.current) return;

    const t = ctx.currentTime;
    const filter = filterRef.current;
    const delay = delayRef.current;
    const feedback = feedbackRef.current;
    const osc = oscillatorRef.current;
    const oscGain = oscGainRef.current;

    // --- DOPPLER AUDIO SHIFT ---
    if (dopplerFactor > 0.05) {
      // BLUESHIFT — moving toward camera → high pitch, tinny
      filter.type = 'highpass';
      filter.frequency.setTargetAtTime(800 + dopplerFactor * 4000, t, 0.08);
      filter.Q.setTargetAtTime(5 + dopplerFactor * 15, t, 0.08);
    } else if (dopplerFactor < -0.05) {
      // REDSHIFT — moving away → deep, muffled, bassy
      filter.type = 'lowpass';
      filter.frequency.setTargetAtTime(600 - Math.abs(dopplerFactor) * 400, t, 0.08);
      filter.Q.setTargetAtTime(3 + Math.abs(dopplerFactor) * 8, t, 0.08);
    } else {
      // Neutral
      filter.type = speed > 0.5 ? 'bandpass' : 'allpass';
      if (speed > 0.5) {
        filter.frequency.setTargetAtTime(1200, t, 0.1);
        filter.Q.setTargetAtTime(1 + speed * 3, t, 0.1);
      }
    }

    // --- SPACE ECHO (increases with speed) ---
    if (speed > 0.3) {
      const echoStrength = (speed - 0.3) / 0.7; // 0..1
      delay.delayTime.setTargetAtTime(0.08 + echoStrength * 0.25, t, 0.1);
      feedback.gain.setTargetAtTime(0.2 + echoStrength * 0.5, t, 0.1);
    } else {
      delay.delayTime.setTargetAtTime(0.0, t, 0.1);
      feedback.gain.setTargetAtTime(0.0, t, 0.1);
    }

    // --- ENGINE HUM (deep rumble at high speed) ---
    if (speed > 0.2) {
      const humPower = (speed - 0.2) / 0.8;
      // Frequency rises with speed: 40Hz → 120Hz (deep → aggressive)
      osc.frequency.setTargetAtTime(40 + humPower * 80, t, 0.1);
      // Volume scales with speed²
      oscGain.gain.setTargetAtTime(humPower * humPower * 0.12, t, 0.1);
    } else {
      oscGain.gain.setTargetAtTime(0.0, t, 0.1);
    }

  }, [dopplerFactor, speed]);

  return { audioError };
}
