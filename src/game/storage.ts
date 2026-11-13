import { AchievementDef, DisasterId, LevelSummary, PlayerProfile } from './types';

const STORAGE_KEY = 'survive60_player_profile_v1';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_survivor',
    title: 'First Survivor',
    description: 'Successfully evacuate any disaster scenario in Survival Mode.',
    category: 'General',
  },
  {
    id: 'earthquake_expert',
    title: 'Earthquake Expert',
    description: 'Survive Earthquake Survival using Drop, Cover, and Hold On during shaking.',
    category: 'Earthquake',
  },
  {
    id: 'flood_escape',
    title: 'Flood Escape',
    description: 'Reach the Cedar Creek Emergency Shelter without taking electrical or deep flood injury.',
    category: 'Flood',
  },
  {
    id: 'fire_safety_hero',
    title: 'Fire Safety Hero',
    description: 'Sound the fire alarm, stay low under smoke, and evacuate via the emergency stairwell.',
    category: 'Fire',
  },
  {
    id: 'perfect_evacuation',
    title: 'Perfect Evacuation',
    description: 'Complete any Survival Mode level with zero damage taken and 90%+ safety accuracy.',
    category: 'Mastery',
  },
  {
    id: 'preparedness_master',
    title: 'Emergency Preparedness Master',
    description: 'Collect the Emergency Kit across Earthquake, Flood, and Fire missions.',
    category: 'Preparedness',
  },
  {
    id: 'training_graduate',
    title: 'Certified Responder',
    description: 'Complete all three disaster scenarios in Training Mode.',
    category: 'Training',
  },
  {
    id: 'speed_responder',
    title: 'Swift Evacuator',
    description: 'Evacuate a Survival Mode level with at least 15 seconds remaining on the clock.',
    category: 'Speed',
  },
];

export function detectRecommendedGraphicsQuality(): 'low' | 'medium' | 'high' {
  if (typeof window === 'undefined') return 'medium';
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu)) {
        return 'low';
      }
    }
  } catch {
    // ignore WebGL probe failure
  }

  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const isSmallMobile = window.innerWidth < 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (cores <= 2 || mem <= 2) return 'low';
  if (isSmallMobile || cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

export function createDefaultProfile(): PlayerProfile {
  return {
    name: 'Survivor',
    totalGamesPlayed: 0,
    totalWins: 0,
    bestScore: 0,
    totalTimeSurvived: 0,
    kitsCollected: {
      earthquake: false,
      flood: false,
      fire: false,
    },
    trainingCompleted: {
      earthquake: false,
      flood: false,
      fire: false,
    },
    disasterStats: {
      earthquake: { plays: 0, wins: 0, bestScore: 0, bestTimeRemaining: 0 },
      flood: { plays: 0, wins: 0, bestScore: 0, bestTimeRemaining: 0 },
      fire: { plays: 0, wins: 0, bestScore: 0, bestTimeRemaining: 0 },
    },
    unlockedAchievements: [],
    calmCompletedActivities: [],
    settings: {
      masterVolume: 0.65,
      muted: false,
      showTrainingHints: true,
      forceTouchControls: false,
      graphicsQuality: detectRecommendedGraphicsQuality(),
      reducedCameraMotion: false,
      calmMusicVolume: 0.55,
      calmNatureVolume: 0.65,
      calmScreenEffectsReduced: false,
    },
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const defaults = createDefaultProfile();
    return {
      ...defaults,
      ...parsed,
      kitsCollected: { ...defaults.kitsCollected, ...(parsed.kitsCollected || {}) },
      trainingCompleted: { ...defaults.trainingCompleted, ...(parsed.trainingCompleted || {}) },
      disasterStats: {
        earthquake: { ...defaults.disasterStats.earthquake, ...(parsed.disasterStats?.earthquake || {}) },
        flood: { ...defaults.disasterStats.flood, ...(parsed.disasterStats?.flood || {}) },
        fire: { ...defaults.disasterStats.fire, ...(parsed.disasterStats?.fire || {}) },
      },
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : [],
      calmCompletedActivities: Array.isArray(parsed.calmCompletedActivities) ? parsed.calmCompletedActivities : [],
    };
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function resetProfile(): PlayerProfile {
  const fresh = createDefaultProfile();
  saveProfile(fresh);
  return fresh;
}

export function recordRunResult(
  current: PlayerProfile,
  summary: Omit<LevelSummary, 'newlyUnlockedAchievements'>,
  extraFlags: {
    usedProperCover?: boolean;
    soundedFireAlarm?: boolean;
    crouchedInSmoke?: boolean;
  }
): { updatedProfile: PlayerProfile; newlyUnlocked: string[] } {
  const next: PlayerProfile = {
    ...current,
    kitsCollected: { ...current.kitsCollected },
    trainingCompleted: { ...current.trainingCompleted },
    disasterStats: {
      earthquake: { ...current.disasterStats.earthquake },
      flood: { ...current.disasterStats.flood },
      fire: { ...current.disasterStats.fire },
    },
    unlockedAchievements: [...current.unlockedAchievements],
  };

  next.totalGamesPlayed += 1;
  next.totalTimeSurvived += summary.timeSurvived;

  const dStats = next.disasterStats[summary.disaster];
  dStats.plays += 1;

  if (summary.kitCollected && summary.victory) {
    next.kitsCollected[summary.disaster] = true;
  }

  if (summary.victory) {
    if (summary.mode === 'survival') {
      next.totalWins += 1;
      dStats.wins += 1;
      if (summary.score > next.bestScore) next.bestScore = summary.score;
      if (summary.score > dStats.bestScore) dStats.bestScore = summary.score;
      if (summary.timeRemaining > dStats.bestTimeRemaining) {
        dStats.bestTimeRemaining = summary.timeRemaining;
      }
    } else {
      next.trainingCompleted[summary.disaster] = true;
    }
  }

  const newlyUnlocked: string[] = [];
  const unlock = (id: string) => {
    if (!next.unlockedAchievements.includes(id)) {
      next.unlockedAchievements.push(id);
      newlyUnlocked.push(id);
    }
  };

  if (summary.victory && summary.mode === 'survival') {
    unlock('first_survivor');
    if (summary.disaster === 'earthquake' && extraFlags.usedProperCover) {
      unlock('earthquake_expert');
    }
    if (summary.disaster === 'flood' && summary.damageTaken === 0) {
      unlock('flood_escape');
    }
    if (summary.disaster === 'fire' && extraFlags.soundedFireAlarm && extraFlags.crouchedInSmoke) {
      unlock('fire_safety_hero');
    }
    if (summary.damageTaken === 0 && summary.safetyAccuracy >= 90) {
      unlock('perfect_evacuation');
    }
    if (summary.timeRemaining >= 15) {
      unlock('speed_responder');
    }
  }

  if (
    next.kitsCollected.earthquake &&
    next.kitsCollected.flood &&
    next.kitsCollected.fire
  ) {
    unlock('preparedness_master');
  }

  if (
    next.trainingCompleted.earthquake &&
    next.trainingCompleted.flood &&
    next.trainingCompleted.fire
  ) {
    unlock('training_graduate');
  }

  saveProfile(next);
  return { updatedProfile: next, newlyUnlocked };
}

export const DISASTER_META: Record<
  DisasterId,
  {
    id: DisasterId;
    title: string;
    subtitle: string;
    difficulty: string;
    description: string;
    accentColor: string;
    accentHex: string;
    location: string;
  }
> = {
  earthquake: {
    id: 'earthquake',
    title: 'Earthquake',
    subtitle: 'Seismic Tremor · Apartment 4B',
    difficulty: 'Moderate',
    description:
      'Sudden magnitude 6.8 tremor strikes indoors. Drop, Cover, and Hold On away from glass and heavy cupboards, shut off gas, and evacuate after shaking subsides.',
    accentColor: 'text-amber-400',
    accentHex: '#F59E0B',
    location: 'Apartment 4B',
  },
  flood: {
    id: 'flood',
    title: 'Flash Flood',
    subtitle: 'Rising Surge · Cedar Creek',
    difficulty: 'Challenging',
    description:
      'Torrential storm overwhelms drainage across Cedar Creek. Check radio alerts, isolate home power, avoid energized floodwaters, and climb to the high-ground shelter.',
    accentColor: 'text-sky-400',
    accentHex: '#0EA5E9',
    location: 'Cedar Creek',
  },
  fire: {
    id: 'fire',
    title: 'Office Fire',
    subtitle: 'Rapid Blaze · Meridian Tower 4F',
    difficulty: 'Intense',
    description:
      'Electrical blaze spreads through Meridian Tower. Pull the fire alarm, stay low beneath toxic smoke, check doors for heat, skip elevators, and escape via stairwell.',
    accentColor: 'text-red-400',
    accentHex: '#EF4444',
    location: 'Meridian Tower 4F',
  },
};
