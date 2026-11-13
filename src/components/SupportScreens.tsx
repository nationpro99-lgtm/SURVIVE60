import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Gamepad2,
  Lock,
  RotateCcw,
  Shield,
  Sliders,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ACHIEVEMENTS, DISASTER_META } from '../game/storage';
import { DisasterId, GameSettings, PlayerProfile } from '../game/types';

function ResponderAvatar({ name }: { name: string }) {
  const initial = (name.trim()[0] || 'S').toUpperCase();
  return (
    <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-2 border-orange-500/70 bg-gradient-to-br from-orange-500/25 via-slate-900 to-slate-950 flex items-center justify-center shadow-lg shadow-orange-500/15 shrink-0">
      <svg viewBox="0 0 64 64" className="h-14 w-14 sm:h-16 sm:w-16" aria-hidden="true">
        <circle cx="32" cy="22" r="11" fill="#fed7aa" stroke="#0f172a" strokeWidth="2.5" />
        <path d="M21 20 C21 11, 43 11, 43 20 Z" fill="#f97316" stroke="#0f172a" strokeWidth="2" />
        <path d="M14 54 C14 39, 50 39, 50 54 Z" fill="#f97316" stroke="#0f172a" strokeWidth="2.5" />
        <rect x="20" y="44" width="24" height="4" rx="1" fill="#fde047" />
      </svg>
      <span className="sr-only">{initial}</span>
    </div>
  );
}

export function HowToPlayScreen({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative z-10 min-h-screen max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Main Menu</span>
      </button>

      <h1 className="font-display text-4xl sm:text-[44px] font-extrabold tracking-tight text-slate-50 leading-tight">
        How to Play
      </h1>
      <p className="text-[17px] sm:text-[19px] text-slate-300 mt-2 mb-8 max-w-3xl leading-relaxed">
        Navigate immersive first-person 3D disaster environments, inspect and use emergency gear, avoid hazards, and evacuate to safety within 60 seconds.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-8">
        <section className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 backdrop-blur-md p-6 sm:p-7 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Gamepad2 className="h-6 w-6 text-orange-400" />
            <h2 className="font-display text-3xl font-bold text-slate-50">Desktop 3D Controls</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-8">
            <div className="flex flex-col items-center gap-2.5">
              <div className="flex justify-center">
                <kbd className="h-14 w-14 rounded-xl border-2 border-slate-600 bg-slate-800 flex items-center justify-center font-mono text-lg font-bold text-slate-100 shadow-inner">
                  W
                </kbd>
              </div>
              <div className="flex gap-2.5">
                <kbd className="h-14 w-14 rounded-xl border-2 border-slate-600 bg-slate-800 flex items-center justify-center font-mono text-lg font-bold text-slate-100 shadow-inner">
                  A
                </kbd>
                <kbd className="h-14 w-14 rounded-xl border-2 border-slate-600 bg-slate-800 flex items-center justify-center font-mono text-lg font-bold text-slate-100 shadow-inner">
                  S
                </kbd>
                <kbd className="h-14 w-14 rounded-xl border-2 border-slate-600 bg-slate-800 flex items-center justify-center font-mono text-lg font-bold text-slate-100 shadow-inner">
                  D
                </kbd>
              </div>
              <span className="text-sm sm:text-base font-medium text-slate-300 mt-1 text-center">
                Move · Click or Drag View to Look
              </span>
            </div>

            <div className="space-y-3.5 w-full sm:w-auto">
              <div className="flex items-center gap-4">
                <kbd className="h-11 min-w-[78px] px-3 rounded-xl border-2 border-emerald-500/70 bg-emerald-500/20 flex items-center justify-center font-mono text-sm font-bold text-emerald-200">
                  SHIFT
                </kbd>
                <div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">Run / Sprint</div>
                  <div className="text-sm sm:text-base text-slate-300">Move faster while stamina lasts</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <kbd className="h-11 min-w-[78px] px-3 rounded-xl border-2 border-purple-400/70 bg-purple-500/20 flex items-center justify-center font-mono text-sm font-bold text-purple-200">
                  C / CTRL
                </kbd>
                <div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">Crouch</div>
                  <div className="text-sm sm:text-base text-slate-300">Lower stance under smoke or debris</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <kbd className="h-11 min-w-[78px] px-3 rounded-xl border-2 border-amber-500/70 bg-amber-500/20 flex items-center justify-center font-mono text-lg font-bold text-amber-200">
                  E
                </kbd>
                <div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">Interact</div>
                  <div className="text-sm sm:text-base text-slate-300">Aim crosshair &amp; press E to use</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <kbd className="h-11 min-w-[78px] px-3 rounded-xl border-2 border-sky-500/70 bg-sky-500/20 flex items-center justify-center font-mono text-sm font-bold text-sky-200">
                  SPACE
                </kbd>
                <div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">Context Action</div>
                  <div className="text-sm sm:text-base text-slate-300">Stay low / Brace / Flood dash</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <kbd className="h-11 min-w-[78px] px-3 rounded-xl border-2 border-slate-600 bg-slate-800 flex items-center justify-center font-mono text-sm font-bold text-slate-200">
                  ESC
                </kbd>
                <div>
                  <div className="text-base sm:text-lg font-bold text-slate-100">Pause Game</div>
                  <div className="text-sm sm:text-base text-slate-300">Adjust audio, motion &amp; 3D quality</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 backdrop-blur-md p-6 sm:p-7 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Smartphone className="h-6 w-6 text-sky-400" />
            <h2 className="font-display text-3xl font-bold text-slate-50">Mobile &amp; Touch</h2>
          </div>

          <div className="flex items-center justify-around gap-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="h-32 w-32 rounded-full border-2 border-slate-500 bg-slate-900/90 flex items-center justify-center shadow-inner">
                <div className="h-14 w-14 rounded-full bg-orange-500 border-2 border-orange-200 shadow-lg" />
              </div>
              <span className="text-sm sm:text-base font-medium text-slate-300 text-center">
                Left Joystick · Drag Right Half to Look
              </span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full border-2 border-emerald-400/80 bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-200">
                  RUN
                </div>
                <div className="h-16 w-16 rounded-full border-2 border-amber-400 bg-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-200">
                  ACT
                </div>
                <div className="h-20 w-20 rounded-full border-2 border-emerald-400 bg-emerald-500/25 flex items-center justify-center text-base font-bold text-emerald-200">
                  USE
                </div>
              </div>
              <span className="text-sm sm:text-base font-medium text-slate-300">Sprint, Context &amp; Interact</span>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 backdrop-blur-md p-6 sm:p-7 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <Shield className="h-6 w-6 text-emerald-400" />
          <h2 className="font-display text-3xl font-bold text-slate-50">Scenario Survival Rules</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5">
            <h3 className="font-display text-2xl font-bold text-amber-400 mb-2">1. Earthquake</h3>
            <p className="text-base leading-relaxed text-slate-200">
              Move away from windows and tall shelves. Walk to a sturdy table, press E to Drop, Cover &amp; Hold On until shaking stops, shut off gas, then exit to the courtyard.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5">
            <h3 className="font-display text-2xl font-bold text-sky-400 mb-2">2. Flash Flood</h3>
            <p className="text-base leading-relaxed text-slate-200">
              Check weather alerts, shut off home breaker power, and avoid entering deep floodwater or energized downed power poles. Cross the north footbridge to higher ground.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5">
            <h3 className="font-display text-2xl font-bold text-red-400 mb-2">3. Office Fire</h3>
            <p className="text-base leading-relaxed text-slate-200">
              Sound the alarm, stay low with Space under smoke, check closed doors for heat before opening, avoid elevators, and evacuate through the emergency stairwell.
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

export function ProfileScreen({
  profile,
  onUpdateName,
  onResetProfile,
  onBack,
}: {
  profile: PlayerProfile;
  onUpdateName: (name: string) => void;
  onResetProfile: () => void;
  onBack: () => void;
}) {
  const [nameInput, setNameInput] = useState(profile.name);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const disasterList: DisasterId[] = ['earthquake', 'flood', 'fire'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative z-10 min-h-screen max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Main Menu</span>
      </button>

      {/* Player Dashboard Header with Large Avatar */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 backdrop-blur-md p-6 sm:p-7 mb-7 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <ResponderAvatar name={profile.name} />
          <div>
            <div className="text-sm font-semibold text-orange-400">Responder Profile</div>
            <h1 className="font-display text-4xl sm:text-[44px] font-extrabold tracking-tight text-slate-50 leading-none mt-1">
              {profile.name}
            </h1>
            <p className="text-base text-slate-300 mt-1.5 tabular-nums">
              {profile.unlockedAchievements.length} / {ACHIEVEMENTS.length} Achievements Earned
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
          <input
            id="player-name"
            type="text"
            maxLength={24}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Responder Name"
            className="flex-1 sm:w-52 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              onUpdateName(nameInput.trim() || 'Survivor');
              setSavedNotice(true);
              setTimeout(() => setSavedNotice(false), 1800);
            }}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-base font-bold text-slate-950 hover:bg-orange-400 transition-colors whitespace-nowrap shrink-0"
          >
            {savedNotice ? 'Saved!' : 'Update Name'}
          </button>
        </div>
      </div>

      {/* Large Stat Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-7">
        <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 p-5 shadow-lg">
          <div className="text-sm sm:text-base font-medium text-slate-300">Best Score</div>
          <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-orange-400 mt-1.5">
            {profile.bestScore}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 p-5 shadow-lg">
          <div className="text-sm sm:text-base font-medium text-slate-300">Survival Wins</div>
          <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-emerald-400 mt-1.5">
            {profile.totalWins}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 p-5 shadow-lg">
          <div className="text-sm sm:text-base font-medium text-slate-300">Games Played</div>
          <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-slate-100 mt-1.5">
            {profile.totalGamesPlayed}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 p-5 shadow-lg">
          <div className="text-sm sm:text-base font-medium text-slate-300">Time Survived</div>
          <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-sky-400 mt-1.5">
            {Math.round(profile.totalTimeSurvived)}s
          </div>
        </div>
      </div>

      {/* Disaster-Specific Progress Bars */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 backdrop-blur-md p-6 sm:p-7 mb-7 space-y-6 shadow-xl">
        <h2 className="font-display text-3xl font-bold text-slate-50">Disaster Mastery Progress</h2>
        <div className="space-y-5">
          {disasterList.map((id) => {
            const meta = DISASTER_META[id];
            const st = profile.disasterStats[id];
            const masteryParts =
              (st.wins > 0 ? 1 : 0) +
              (profile.trainingCompleted[id] ? 1 : 0) +
              (profile.kitsCollected[id] ? 1 : 0);
            const pct = Math.round((masteryParts / 3) * 100);
            const barColor =
              id === 'earthquake' ? 'bg-amber-500' : id === 'flood' ? 'bg-sky-500' : 'bg-red-500';

            return (
              <div key={id} className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                  <div>
                    <div className={`font-display text-2xl font-bold ${meta.accentColor}`}>{meta.title}</div>
                    <div className="text-sm text-slate-300">
                      {meta.location} · Training {profile.trainingCompleted[id] ? 'Complete' : 'Pending'} · Kit{' '}
                      {profile.kitsCollected[id] ? 'Collected' : 'Not Collected'}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm sm:text-base font-semibold tabular-nums text-slate-200">
                    <span>Wins: {st.wins}/{st.plays}</span>
                    <span>Best: {st.bestScore}</span>
                  </div>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Progress */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {confirmReset ? (
          <>
            <span className="text-base font-medium text-red-300">Erase all saved scores and achievements?</span>
            <button
              type="button"
              onClick={() => {
                onResetProfile();
                setNameInput('Survivor');
                setConfirmReset(false);
              }}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm sm:text-base font-bold text-white hover:bg-red-500 transition-colors"
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm sm:text-base font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm sm:text-base font-semibold text-slate-300 hover:border-red-500/60 hover:text-red-300 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Progress</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function AchievementsScreen({
  profile,
  onBack,
}: {
  profile: PlayerProfile;
  onBack: () => void;
}) {
  const unlockedCount = profile.unlockedAchievements.length;
  const pct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative z-10 min-h-screen max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Main Menu</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Award className="h-9 w-9 text-amber-400 shrink-0" />
          <div>
            <h1 className="font-display text-4xl sm:text-[44px] font-extrabold tracking-tight text-slate-50 leading-none">
              Achievements
            </h1>
            <p className="text-base sm:text-lg text-slate-300 mt-1.5 tabular-nums">
              {unlockedCount} of {ACHIEVEMENTS.length} badges earned through live survival runs
            </p>
          </div>
        </div>
        <div className="w-full sm:w-56">
          <div className="flex justify-between text-sm font-bold text-amber-300 mb-1 tabular-nums">
            <span>Completion</span>
            <span>{pct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ACHIEVEMENTS.map((ach) => {
          const unlocked = profile.unlockedAchievements.includes(ach.id);
          return (
            <div
              key={ach.id}
              className={`rounded-2xl border p-6 flex items-start gap-4 transition-all ${
                unlocked
                  ? 'border-amber-500/60 bg-[#121c2d]/95 shadow-lg shadow-amber-500/10'
                  : 'border-slate-800 bg-[#0b111b]/85 opacity-80'
              }`}
            >
              <div
                className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 ${
                  unlocked ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {unlocked ? <CheckCircle2 className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-300">
                  {ach.category} · {unlocked ? 'Unlocked' : 'Locked'}
                </div>
                <h2 className="font-display text-2xl sm:text-[26px] font-bold text-slate-50 mt-0.5 leading-snug">
                  {ach.title}
                </h2>
                <p className="text-base leading-relaxed text-slate-300 mt-1.5">{ach.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function SettingsScreen({
  settings,
  onChange,
  onBack,
}: {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative z-10 min-h-screen max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Main Menu</span>
      </button>

      <div className="flex items-center gap-3.5 mb-8">
        <Sliders className="h-8 w-8 text-orange-400" />
        <h1 className="font-display text-4xl sm:text-[44px] font-extrabold tracking-tight text-slate-50 leading-none">
          Settings
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1422]/90 backdrop-blur-md divide-y divide-slate-800 shadow-xl">
        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {settings.muted ? (
              <VolumeX className="h-6 w-6 text-slate-400" />
            ) : (
              <Volume2 className="h-6 w-6 text-orange-400" />
            )}
            <div>
              <div className="text-lg font-bold text-slate-100">Sound Effects &amp; Ambience</div>
              <div className="text-sm sm:text-base text-slate-300">Toggle synthesized disaster and UI audio</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, muted: !settings.muted })}
            className={`px-5 py-2.5 rounded-xl text-base font-bold transition-colors whitespace-nowrap shrink-0 ${
              settings.muted
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {settings.muted ? 'Muted' : 'Audio On'}
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between text-lg">
            <span className="font-bold text-slate-100">Master Volume</span>
            <span className="font-mono-tabular text-base font-bold text-orange-300">
              {Math.round(settings.masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.masterVolume * 100)}
            onChange={(e) =>
              onChange({ ...settings, masterVolume: Number(e.target.value) / 100 })
            }
            className="w-full h-3 accent-orange-500 cursor-pointer"
          />
        </div>

        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-100">Show Contextual Safety Hints</div>
            <div className="text-sm sm:text-base text-slate-300">Display helpful survival notes during Training Mode</div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, showTrainingHints: !settings.showTrainingHints })}
            className={`px-5 py-2.5 rounded-xl text-base font-bold transition-colors whitespace-nowrap shrink-0 ${
              settings.showTrainingHints
                ? 'bg-orange-500 text-slate-950 hover:bg-orange-400'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {settings.showTrainingHints ? 'Enabled' : 'Hidden'}
          </button>
        </div>

        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-100">3D Graphics Quality</div>
            <div className="text-sm sm:text-base text-slate-300">Tune dynamic shadows, resolution scale, and particle count</div>
          </div>
          <div className="flex items-center gap-2">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onChange({ ...settings, graphicsQuality: q })}
                className={`px-4 py-2 rounded-xl text-base font-bold capitalize transition-colors whitespace-nowrap shrink-0 ${
                  settings.graphicsQuality === q
                    ? 'bg-orange-500 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-100">Reduce Camera Motion</div>
            <div className="text-sm sm:text-base text-slate-300">Soften head bobbing, strafe tilt, sprint FOV shifts, and tremor shake</div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, reducedCameraMotion: !settings.reducedCameraMotion })}
            className={`px-5 py-2.5 rounded-xl text-base font-bold transition-colors whitespace-nowrap shrink-0 ${
              settings.reducedCameraMotion
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {settings.reducedCameraMotion ? 'Reduced' : 'Standard'}
          </button>
        </div>

        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-100">Always Show On-Screen Joystick</div>
            <div className="text-sm sm:text-base text-slate-300">Enable virtual touch controls on tablets or desktop</div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, forceTouchControls: !settings.forceTouchControls })}
            className={`px-5 py-2.5 rounded-xl text-base font-bold transition-colors whitespace-nowrap shrink-0 ${
              settings.forceTouchControls
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {settings.forceTouchControls ? 'Always On' : 'Auto Detect'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
