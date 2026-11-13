import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Compass,
  HelpCircle,
  Leaf,
  Play,
  ShieldAlert,
  Sliders,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AICoachModal } from './components/AICoachModal';
import { CalmModeView } from './components/CalmModeView';
import { DisasterSelectScreen } from './components/DisasterSelectScreen';
import { MenuBackgroundCanvas } from './components/MenuBackgroundCanvas';
import { PlayableLevelView } from './components/PlayableLevelView';
import {
  AchievementsScreen,
  HowToPlayScreen,
  ProfileScreen,
  SettingsScreen,
} from './components/SupportScreens';
import { soundEngine } from './game/audio';
import {
  loadProfile,
  recordRunResult,
  resetProfile,
  saveProfile,
} from './game/storage';
import {
  DisasterId,
  GameMode,
  GameSettings,
  LevelSummary,
  PlayerProfile,
  ScreenId,
} from './game/types';

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [screen, setScreen] = useState<ScreenId>('menu');
  const [selectDefaultMode, setSelectDefaultMode] = useState<GameMode>('survival');
  const [activeDisaster, setActiveDisaster] = useState<DisasterId>('earthquake');
  const [activeMode, setActiveMode] = useState<GameMode>('survival');

  const [coachOpen, setCoachOpen] = useState(false);
  const [coachSummary, setCoachSummary] = useState<Omit<LevelSummary, 'newlyUnlockedAchievements'> | null>(null);
  const [coachDisaster, setCoachDisaster] = useState<DisasterId | 'general'>('general');

  useEffect(() => {
    soundEngine.setVolume(profile.settings.masterVolume);
    soundEngine.setMuted(profile.settings.muted);
  }, [profile.settings.masterVolume, profile.settings.muted]);

  const updateSettings = useCallback((nextSettings: GameSettings) => {
    setProfile((prev) => {
      const updated = { ...prev, settings: nextSettings };
      saveProfile(updated);
      return updated;
    });
  }, []);

  const handleLaunchLevel = useCallback((disaster: DisasterId, mode: GameMode) => {
    soundEngine.unlock();
    setActiveDisaster(disaster);
    setActiveMode(mode);
    setScreen('playing');
  }, []);

  const handleRunFinished = useCallback(
    (
      summary: Omit<LevelSummary, 'newlyUnlockedAchievements'>,
      extraFlags: {
        usedProperCover?: boolean;
        soundedFireAlarm?: boolean;
        crouchedInSmoke?: boolean;
      }
    ) => {
      let unlocked: string[] = [];
      setProfile((prev) => {
        const res = recordRunResult(prev, summary, extraFlags);
        unlocked = res.newlyUnlocked;
        return res.updatedProfile;
      });
      return unlocked;
    },
    []
  );

  const handleUpdateName = useCallback((name: string) => {
    setProfile((prev) => {
      const next = { ...prev, name };
      saveProfile(next);
      return next;
    });
  }, []);

  const handleResetProfile = useCallback(() => {
    setProfile(resetProfile());
  }, []);

  const handleSaveCalmActivities = useCallback((ids: string[]) => {
    setProfile((prev) => {
      const next = { ...prev, calmCompletedActivities: ids };
      saveProfile(next);
      return next;
    });
  }, []);

  const openMenuAudio = () => {
    soundEngine.unlock();
    if (!profile.settings.muted) {
      soundEngine.startMenuAmbient();
    }
  };

  if (screen === 'playing') {
    return (
      <>
        <PlayableLevelView
          key={`${activeDisaster}_${activeMode}`}
          disaster={activeDisaster}
          mode={activeMode}
          settings={profile.settings}
          onUpdateSettings={updateSettings}
          onRunFinished={handleRunFinished}
          onNextDisaster={(nextId) => {
            setActiveDisaster(nextId);
            setScreen('playing');
          }}
          onOpenCoachWithSummary={(summary) => {
            setCoachSummary(summary);
            setCoachDisaster(summary.disaster);
            setCoachOpen(true);
          }}
          onExitToMenu={() => setScreen('menu')}
        />
        <AICoachModal
          isOpen={coachOpen}
          onClose={() => setCoachOpen(false)}
          initialDisaster={coachDisaster}
          runSummary={coachSummary}
        />
      </>
    );
  }

  if (screen === 'calm') {
    return (
      <CalmModeView
        settings={profile.settings}
        savedCompletedIds={profile.calmCompletedActivities || []}
        onSaveCompletedIds={handleSaveCalmActivities}
        onUpdateSettings={updateSettings}
        onExitToMenu={() => setScreen('menu')}
      />
    );
  }

  return (
    <div className="relative min-h-screen w-full text-slate-100 overflow-x-hidden">
      <MenuBackgroundCanvas showDisasterTriptych={screen === 'menu'} />

      {screen === 'menu' && (
        <main className="relative z-10 min-h-screen flex flex-col justify-between max-w-7xl mx-auto px-5 sm:px-8 py-6 sm:py-10">
          {/* Top Bar */}
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-100 whitespace-nowrap shrink-0">
              <Compass className="h-6 w-6 text-orange-400" />
              <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-wider">
                SURVIVE 60
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="hidden md:inline text-sm sm:text-base font-medium text-slate-300 tabular-nums">
                {profile.name} · {profile.totalWins} Wins · Best {profile.bestScore}
              </span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  updateSettings({ ...profile.settings, muted: !profile.settings.muted });
                }}
                aria-label={profile.settings.muted ? 'Unmute audio' : 'Mute audio'}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0c1422]/85 backdrop-blur-md px-4 py-2.5 text-sm sm:text-base font-semibold text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {profile.settings.muted ? (
                  <>
                    <VolumeX className="h-5 w-5 text-slate-400" />
                    <span>Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-5 w-5 text-orange-400" />
                    <span>Sound On</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Hero Centerpiece */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="my-auto py-8 sm:py-12 max-w-4xl"
          >
            <div className="text-base sm:text-lg font-bold text-orange-400 tracking-wide mb-3">
              Earthquake · Flash Flood · Office Fire
            </div>

            <h1 className="font-display text-[52px] sm:text-[72px] lg:text-[86px] font-extrabold tracking-tight text-slate-50 leading-[0.94] drop-shadow-lg">
              SURVIVE <span className="text-orange-500 tabular-nums">60</span>
            </h1>

            <p className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-slate-100 mt-4 leading-snug">
              60 SECONDS. ONE DECISION. A CHANCE TO SURVIVE.
            </p>

            <p className="text-[17px] sm:text-[19px] text-slate-200 mt-4 max-w-2xl leading-relaxed">
              Step into real-time 3D first-person emergency worlds. Navigate crumbling apartments, rising floodwaters, and smoke-filled offices—make life-saving decisions through movement and action before time runs out.
            </p>

            {/* Primary CTA Cluster */}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  openMenuAudio();
                  setSelectDefaultMode('survival');
                  setScreen('select');
                }}
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 px-8 py-4 text-xl sm:text-2xl font-extrabold text-slate-950 shadow-[0_0_32px_rgba(249,115,22,0.45)] hover:shadow-[0_0_44px_rgba(249,115,22,0.65)] hover:scale-[1.03] active:scale-[0.99] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <Play className="h-6 w-6 fill-current" />
                <span>START SURVIVAL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openMenuAudio();
                  setSelectDefaultMode('training');
                  setScreen('select');
                }}
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-emerald-500/60 bg-[#0c1422]/85 backdrop-blur-md px-6 py-4 text-lg sm:text-xl font-bold text-slate-100 hover:bg-emerald-500/15 hover:scale-[1.02] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <BookOpen className="h-6 w-6 text-emerald-400" />
                <span>DISASTER TRAINING</span>
              </button>
            </div>

            {/* Dedicated CALM MODE Card */}
            <div className="mt-6 max-w-2xl">
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  setScreen('calm');
                }}
                className="group w-full text-left rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-[#f6f4ec] via-[#ecf6ef] to-[#e4f2fb] p-5 sm:p-6 shadow-[0_12px_36px_rgba(16,185,129,0.22)] hover:shadow-[0_16px_42px_rgba(16,185,129,0.34)] hover:-translate-y-0.5 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
                    <Leaf className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-800">
                      <span>Stress-Free 3D Exploration</span>
                      <span>·</span>
                      <span>No Countdown</span>
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight mt-0.5">
                      CALM MODE
                    </h2>
                    <p className="text-sm sm:text-base font-semibold text-slate-700 mt-0.5">
                      Explore. Learn. Breathe. At Your Own Pace.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-base font-extrabold text-white shadow-sm group-hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0">
                  <Play className="h-4 w-4 fill-current" />
                  <span>ENTER CALM MODE</span>
                </span>
              </button>
            </div>

            {/* Secondary Navigation Cards */}
            <div className="mt-10 pt-7 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <button
                type="button"
                onClick={() => setScreen('howto')}
                className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#0c1422]/85 backdrop-blur-md px-4 py-3.5 text-base sm:text-lg font-bold text-slate-100 hover:border-sky-500/60 hover:bg-slate-800/90 hover:-translate-y-0.5 transition-all"
              >
                <HelpCircle className="h-5 w-5 text-sky-400 shrink-0" />
                <span className="truncate">How to Play</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('profile')}
                className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#0c1422]/85 backdrop-blur-md px-4 py-3.5 text-base sm:text-lg font-bold text-slate-100 hover:border-orange-500/60 hover:bg-slate-800/90 hover:-translate-y-0.5 transition-all"
              >
                <User className="h-5 w-5 text-orange-400 shrink-0" />
                <span className="truncate">Player Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('achievements')}
                className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#0c1422]/85 backdrop-blur-md px-4 py-3.5 text-base sm:text-lg font-bold text-slate-100 hover:border-amber-500/60 hover:bg-slate-800/90 hover:-translate-y-0.5 transition-all"
              >
                <Award className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="truncate">Achievements</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoachSummary(null);
                  setCoachDisaster('general');
                  setCoachOpen(true);
                }}
                className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#0c1422]/85 backdrop-blur-md px-4 py-3.5 text-base sm:text-lg font-bold text-sky-200 hover:border-sky-400/60 hover:bg-slate-800/90 hover:-translate-y-0.5 transition-all"
              >
                <ShieldAlert className="h-5 w-5 text-sky-400 shrink-0" />
                <span className="truncate">Safety Coach</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('settings')}
                className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#0c1422]/85 backdrop-blur-md px-4 py-3.5 text-base sm:text-lg font-bold text-slate-100 hover:border-slate-500 hover:bg-slate-800/90 hover:-translate-y-0.5 transition-all"
              >
                <Sliders className="h-5 w-5 text-slate-300 shrink-0" />
                <span className="truncate">Settings</span>
              </button>
            </div>
          </motion.section>

          <footer className="text-sm sm:text-base text-slate-300 flex flex-wrap items-center justify-between gap-3 pt-4">
            <span>Controls: WASD Move · Shift Run · C Crouch · E Interact · Space Context Action</span>
            <span>Progress saved locally in your browser</span>
          </footer>
        </main>
      )}

      {screen === 'select' && (
        <DisasterSelectScreen
          profile={profile}
          defaultMode={selectDefaultMode}
          onSelectLevel={handleLaunchLevel}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'howto' && <HowToPlayScreen onBack={() => setScreen('menu')} />}

      {screen === 'profile' && (
        <ProfileScreen
          profile={profile}
          onUpdateName={handleUpdateName}
          onResetProfile={handleResetProfile}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'achievements' && (
        <AchievementsScreen profile={profile} onBack={() => setScreen('menu')} />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          settings={profile.settings}
          onChange={updateSettings}
          onBack={() => setScreen('menu')}
        />
      )}

      <AICoachModal
        isOpen={coachOpen}
        onClose={() => setCoachOpen(false)}
        initialDisaster={coachDisaster}
        runSummary={coachSummary}
      />
    </div>
  );
}
