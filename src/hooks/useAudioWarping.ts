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

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !filterRef.current || !delayRef.current || !feedbackRef.current) return;
    if (!oscillatorRef.current || !oscGainRef.current || !gainRef.current) return;

    const t = ctx.currentTime;
    const filter = filterRef.current;
    const delay = delayRef.current;
    const feedback = feedbackRef.current;
    const osc = oscillatorRef.current;
    const oscGain = oscGainRef.current;
    const masterGain = gainRef.current;

    // --- DOPPLER AUDIO SHIFT (Extreme) ---
    if (dopplerFactor > 0.05) {
      filter.type = 'highpass';
      filter.frequency.setTargetAtTime(1000 + dopplerFactor * 5000, t, 0.05);
      filter.Q.setTargetAtTime(10 + dopplerFactor * 20, t, 0.05);
    } else if (dopplerFactor < -0.05) {
      filter.type = 'lowpass';
      filter.frequency.setTargetAtTime(400 - Math.abs(dopplerFactor) * 300, t, 0.05);
      filter.Q.setTargetAtTime(5 + Math.abs(dopplerFactor) * 15, t, 0.05);
    } else {
      filter.type = speed > 0.5 ? 'bandpass' : 'allpass';
      if (speed > 0.5) {
        filter.frequency.setTargetAtTime(1500, t, 0.1);
        filter.Q.setTargetAtTime(2 + speed * 5, t, 0.1);
      }
    }

    // --- EXTREME SPACE ECHO ---
    if (speed > 0.2) {
      const echoStrength = (speed - 0.2) / 0.8;
      delay.delayTime.setTargetAtTime(0.1 + echoStrength * 0.4, t, 0.1);
      feedback.gain.setTargetAtTime(0.3 + echoStrength * 0.65, t, 0.1);
    } else {
      delay.delayTime.setTargetAtTime(0.0, t, 0.1);
      feedback.gain.setTargetAtTime(0.0, t, 0.1);
    }

    // --- ENGINE HUM (Deep rumble to screaming pitch) ---
    if (speed > 0.1) {
      const humPower = (speed - 0.1) / 0.9;
      // 40Hz deep rumble -> 300Hz scream
      osc.frequency.setTargetAtTime(40 + Math.pow(humPower, 3) * 260, t, 0.1);
      oscGain.gain.setTargetAtTime(Math.pow(humPower, 2) * 0.2, t, 0.1);
    } else {
      oscGain.gain.setTargetAtTime(0.0, t, 0.1);
    }

    // --- STUTTER / GLITCH EFFECT (Real-time Tremolo) ---
    if (speed > 0.8) {
      // Rapid volume modulation
      const stutterRate = 20.0 + (speed - 0.8) * 100.0; // 20Hz to 40Hz flutter
      const lfo = Math.sin(t * stutterRate * Math.PI * 2);
      // Map -1..1 to 0..1, then mix with 1.0 based on speed
      const stutterDepth = (speed - 0.8) / 0.2; // 0..1
      const stutterVal = 1.0 - (stutterDepth * 0.8 * (0.5 - lfo * 0.5));
      masterGain.gain.setTargetAtTime(stutterVal, t, 0.02);
    } else {
      masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    }

  }, [dopplerFactor, speed]);

  return { audioError };
}
