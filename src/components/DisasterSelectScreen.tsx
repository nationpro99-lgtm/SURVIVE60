import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Play } from 'lucide-react';
import eqArt from '../assets/images/disaster_card_earthquake_1794565786312.jpg';
import floodArt from '../assets/images/disaster_card_flood_1794565786303.jpg';
import fireArt from '../assets/images/disaster_card_fire_1794565786545.jpg';
import { renderDisasterCardPreview } from '../game/renderer';
import { DISASTER_META } from '../game/storage';
import { DisasterId, GameMode, PlayerProfile } from '../game/types';

interface DisasterSelectScreenProps {
  profile: PlayerProfile;
  defaultMode: GameMode;
  onSelectLevel: (disaster: DisasterId, mode: GameMode) => void;
  onBack: () => void;
}

const CARD_ART: Record<DisasterId, { src: string; alt: string; hoverGlow: string; fallbackGradient: string }> = {
  earthquake: {
    src: eqArt,
    alt: 'Apartment interior shaking during an earthquake with emergency lighting',
    hoverGlow: 'hover:border-amber-500/70 hover:shadow-[0_0_40px_rgba(245,158,11,0.18)]',
    fallbackGradient: 'from-amber-950 via-stone-900 to-slate-950',
  },
  flood: {
    src: floodArt,
    alt: 'Flooded city neighborhood with wooden footbridge leading to high-ground shelter',
    hoverGlow: 'hover:border-sky-500/70 hover:shadow-[0_0_40px_rgba(14,165,233,0.2)]',
    fallbackGradient: 'from-sky-950 via-slate-900 to-slate-950',
  },
  fire: {
    src: fireArt,
    alt: 'Office building corridor engulfed in flames and smoke with green emergency exit sign',
    hoverGlow: 'hover:border-red-500/70 hover:shadow-[0_0_40px_rgba(239,68,68,0.2)]',
    fallbackGradient: 'from-red-950 via-orange-950 to-slate-950',
  },
};

function DisasterArtworkPanel({ disaster }: { disaster: DisasterId }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const art = CARD_ART[disaster];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const render = (time: number) => {
      renderDisasterCardPreview(ctx, disaster, canvas.width, canvas.height, time * 0.001);
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [disaster]);

  return (
    <div className="relative w-full h-52 sm:h-60 rounded-xl overflow-hidden border border-slate-700/70 bg-slate-950">
      {!imgFailed ? (
        <img
          src={art.src}
          alt={art.alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className={`h-full w-full bg-gradient-to-br ${art.fallbackGradient}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b1320] via-transparent to-black/25 pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={420}
        height={220}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />
    </div>
  );
}

export function DisasterSelectScreen({
  profile,
  defaultMode,
  onSelectLevel,
  onBack,
}: DisasterSelectScreenProps) {
  const order: DisasterId[] = ['earthquake', 'flood', 'fire'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative z-10 min-h-screen flex flex-col max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
    >
      <div className="mb-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Main Menu</span>
        </button>

        <h1 className="font-display text-4xl sm:text-[44px] font-extrabold tracking-tight text-slate-50 leading-tight">
          Select Disaster Scenario
        </h1>
        <p className="text-[17px] sm:text-[19px] text-slate-300 mt-2 max-w-3xl leading-relaxed">
          {defaultMode === 'training'
            ? 'Training Mode active — practice navigating hazards and safety actions without a countdown limit.'
            : 'Survival Mode — 60 seconds on the clock. Navigate hazards, complete objectives, and reach the safe zone.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 flex-1 items-stretch">
        {order.map((id, idx) => {
          const meta = DISASTER_META[id];
          const stats = profile.disasterStats[id];
          const art = CARD_ART[id];

          return (
            <motion.article
              key={id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.05 }}
              className={`group flex flex-col rounded-2xl border border-slate-800/90 bg-[#0c1422]/90 backdrop-blur-md p-5 sm:p-6 shadow-2xl transition-all duration-200 hover:-translate-y-1 ${art.hoverGlow}`}
            >
              <DisasterArtworkPanel disaster={id} />

              <div className="mt-5 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:text-base font-semibold">
                  <span className={meta.accentColor}>{meta.location}</span>
                  <span className="text-slate-300">Difficulty: {meta.difficulty}</span>
                </div>

                <h2 className="font-display text-3xl sm:text-[34px] font-extrabold tracking-wide text-slate-50 mt-1.5 leading-none">
                  {meta.title}
                </h2>
                <p className="text-sm sm:text-base font-medium text-slate-300 mt-1.5 mb-3">
                  {meta.subtitle}
                </p>

                <p className="text-[17px] leading-relaxed text-slate-200 flex-1">
                  {meta.description}
                </p>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-sm sm:text-base font-medium text-slate-300 tabular-nums">
                  <span>Wins: {stats.wins}/{stats.plays}</span>
                  <span aria-hidden="true">·</span>
                  <span>Best Score: {stats.bestScore}</span>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectLevel(id, 'survival')}
                    className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-lg sm:text-xl font-bold transition-all duration-150 hover:scale-[1.02] whitespace-nowrap shrink-0 ${
                      defaultMode === 'survival'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400'
                        : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                    }`}
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectLevel(id, 'training')}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-lg font-bold transition-all duration-150 hover:scale-[1.02] whitespace-nowrap shrink-0 ${
                      defaultMode === 'training'
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                        : 'border border-slate-600 bg-slate-900/80 text-slate-100 hover:bg-slate-800'
                    }`}
                  >
                    <BookOpen className="h-5 w-5" />
                    <span>Training</span>
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </motion.div>
  );
}
