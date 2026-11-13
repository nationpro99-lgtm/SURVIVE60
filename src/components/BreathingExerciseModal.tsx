import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Wind, X } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface BreathingExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  reducedEffects?: boolean;
}

type PatternId = 'calming_446' | 'box_4444';

interface PhaseStep {
  phase: 'inhale' | 'hold' | 'exhale';
  label: string;
  guidance: string;
  seconds: number;
}

const PATTERNS: Record<
  PatternId,
  { name: string; subtitle: string; steps: PhaseStep[] }
> = {
  calming_446: {
    name: '4 · 4 · 6 Calming Breath',
    subtitle: 'Longer exhales gently ease tension and slow your heart rate.',
    steps: [
      { phase: 'inhale', label: 'Breathe In', guidance: 'Draw air in gently through your nose', seconds: 4 },
      { phase: 'hold', label: 'Hold Softly', guidance: 'Relax your shoulders and keep your chest open', seconds: 4 },
      { phase: 'exhale', label: 'Breathe Out', guidance: 'Let the breath flow out slowly and smoothly', seconds: 6 },
    ],
  },
  box_4444: {
    name: '4 · 4 · 4 · 4 Box Breath',
    subtitle: 'Balanced rhythm used by responders to stay clear-headed.',
    steps: [
      { phase: 'inhale', label: 'Breathe In', guidance: 'Slow, steady inhale', seconds: 4 },
      { phase: 'hold', label: 'Hold Gently', guidance: 'Notice stillness without straining', seconds: 4 },
      { phase: 'exhale', label: 'Breathe Out', guidance: 'Steady, unhurried release', seconds: 4 },
      { phase: 'hold', label: 'Rest Empty', guidance: 'Pause softly before the next breath', seconds: 4 },
    ],
  },
};

export function BreathingExerciseModal({
  isOpen,
  onClose,
  reducedEffects = false,
}: BreathingExerciseModalProps) {
  const [patternId, setPatternId] = useState<PatternId>('calming_446');
  const [running, setRunning] = useState(true);
  const [soundCue, setSoundCue] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [cycles, setCycles] = useState(0);

  const lastSoundStepRef = useRef<number>(-1);
  const pattern = PATTERNS[patternId];
  const currentStep = pattern.steps[stepIdx % pattern.steps.length];

  useEffect(() => {
    if (!isOpen) return;
    setStepIdx(0);
    setStepElapsed(0);
    lastSoundStepRef.current = -1;
  }, [isOpen, patternId]);

  useEffect(() => {
    if (!isOpen || !running) return;

    if (soundCue && lastSoundStepRef.current !== stepIdx) {
      lastSoundStepRef.current = stepIdx;
      soundEngine.playBreathingCue(currentStep.phase);
    }

    let lastTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      setStepElapsed((prev) => {
        const next = prev + dt;
        if (next >= currentStep.seconds) {
          setStepIdx((oldIdx) => {
            const nextIdx = (oldIdx + 1) % pattern.steps.length;
            if (nextIdx === 0) setCycles((c) => c + 1);
            return nextIdx;
          });
          return 0;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, running, stepIdx, currentStep.phase, currentStep.seconds, pattern.steps.length, soundCue]);

  if (!isOpen) return null;

  const progress = Math.min(1, stepElapsed / currentStep.seconds);
  const smoothProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);

  let circleScale = 1.0;
  if (currentStep.phase === 'inhale') {
    circleScale = 0.72 + smoothProgress * 0.58;
  } else if (currentStep.phase === 'exhale') {
    circleScale = 1.3 - smoothProgress * 0.58;
  } else {
    circleScale = stepIdx === 1 ? 1.3 : 0.72;
  }

  const secsLeft = Math.max(1, Math.ceil(currentStep.seconds - stepElapsed));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided Breathing Exercise"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
    >
      <div className="w-full max-w-xl rounded-3xl border border-emerald-700/30 bg-[#f7f5ee] text-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-emerald-900/10 bg-[#eef5ee] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-emerald-950">
                Guided Breathing
              </h2>
              <p className="text-sm text-emerald-800/80">
                Pause anytime · Cycles completed: <span className="font-bold tabular-nums">{cycles}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close breathing exercise"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/15 bg-white text-emerald-900 hover:bg-emerald-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pattern Picker */}
        <div className="px-6 pt-5 flex flex-wrap gap-2.5 justify-center">
          {(Object.keys(PATTERNS) as PatternId[]).map((pid) => {
            const active = pid === patternId;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => setPatternId(pid)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-white border border-emerald-900/15 text-emerald-900 hover:bg-emerald-50'
                }`}
              >
                {PATTERNS[pid].name}
              </button>
            );
          })}
        </div>
        <p className="text-center text-sm text-slate-600 mt-2.5 px-6">
          {pattern.subtitle}
        </p>

        {/* Expanding / Contracting Breathing Visual */}
        <div className="py-8 px-6 flex flex-col items-center justify-center">
          <div className="relative h-60 w-60 flex items-center justify-center">
            {!reducedEffects && (
              <div
                style={{
                  transform: `scale(${circleScale * 1.12})`,
                  transition: 'transform 120ms linear',
                }}
                className="absolute h-44 w-44 rounded-full bg-sky-200/60"
              />
            )}
            <div
              style={{
                transform: `scale(${reducedEffects ? 1 : circleScale})`,
                transition: 'transform 120ms linear',
              }}
              className="relative h-44 w-44 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-400 shadow-lg flex flex-col items-center justify-center text-white select-none"
            >
              <span className="font-display text-2xl font-extrabold tracking-wide">
                {currentStep.label}
              </span>
              <span className="text-3xl font-bold tabular-nums mt-1">{secsLeft}</span>
            </div>
          </div>

          <p className="mt-4 text-center text-lg font-semibold text-emerald-950">
            {currentStep.guidance}
          </p>
        </div>

        {/* Controls */}
        <div className="border-t border-emerald-900/10 bg-[#eef5ee] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-base font-bold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{running ? 'Pause' : 'Resume'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStepIdx(0);
                setStepElapsed(0);
                setCycles(0);
                lastSoundStepRef.current = -1;
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-4 py-2.5 text-base font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSoundCue((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 transition-colors whitespace-nowrap"
          >
            {soundCue ? <Volume2 className="h-4 w-4 text-emerald-700" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            <span>{soundCue ? 'Chime Cues On' : 'Silent Visual'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
