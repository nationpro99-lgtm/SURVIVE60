export type DisasterId = 'earthquake' | 'flood' | 'fire';

export type GameMode = 'survival' | 'training';

export type ScreenId =
  | 'menu'
  | 'select'
  | 'playing'
  | 'calm'
  | 'howto'
  | 'profile'
  | 'achievements'
  | 'settings'
  | 'coach';

export type PlayPhase = 'active' | 'paused' | 'victory' | 'gameover';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WallRect extends Rect {
  kind: 'wall' | 'window' | 'furniture' | 'car' | 'pillar' | 'tree' | 'house';
  color?: string;
  label?: string;
  blocksSight?: boolean;
  toppleAt?: number; // earthquake time when furniture topples
  toppled?: boolean;
  toppledRect?: Rect;
}

export type InteractiveKind =
  | 'cover_table'
  | 'emergency_kit'
  | 'gas_valve'
  | 'exit_door'
  | 'safe_zone'
  | 'radio'
  | 'phone'
  | 'breaker_panel'
  | 'parked_car'
  | 'fire_alarm'
  | 'fire_extinguisher'
  | 'elevator'
  | 'stairs_exit'
  | 'check_door';

export interface InteractiveObject {
  id: string;
  kind: InteractiveKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number; // interaction reach
  prompt: string;
  secondaryPrompt?: string;
  used: boolean;
  locked?: boolean;
  hot?: boolean;
  blocked?: boolean;
  linkedWallIndex?: number;
  trainingTip: string;
}

export interface HazardZone {
  id: string;
  kind: 'glass' | 'falling_debris' | 'floodwater' | 'electric_water' | 'fire' | 'smoke' | 'debris';
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  damagePerSec: number;
  slowFactor?: number;
  intensity: number; // 0..1
  spreadRate?: number;
  label: string;
}

export interface FallingObject {
  id: string;
  x: number;
  y: number;
  targetY: number;
  vy: number;
  size: number;
  kind: 'books' | 'lamp' | 'plaster' | 'pot';
  landed: boolean;
  hitChecked: boolean;
}

export interface FloatingDebris {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  kind: 'plank' | 'bin' | 'branch';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'rain' | 'smoke' | 'spark' | 'dust' | 'ember' | 'ripple' | 'splash';
}

export interface NPC {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  color: string;
  hairColor: string;
  panicked: boolean;
  evacuated: boolean;
  speech?: string;
  speechTimer: number;
}

export interface MissionObjective {
  id: string;
  text: string;
  completed: boolean;
  optional?: boolean;
}

export interface ToastFeedback {
  id: number;
  text: string;
  tone: 'good' | 'warn' | 'danger' | 'info';
  timer: number;
}

export interface LevelSummary {
  disaster: DisasterId;
  mode: GameMode;
  victory: boolean;
  score: number;
  timeSurvived: number;
  timeRemaining: number;
  safetyAccuracy: number;
  hazardsAvoided: number;
  objectivesCompleted: number;
  totalObjectives: number;
  damageTaken: number;
  failureReason?: string;
  lessonsLearned: string[];
  actionLog: string[];
  kitCollected: boolean;
  newlyUnlockedAchievements: string[];
}

export interface DisasterStats {
  plays: number;
  wins: number;
  bestScore: number;
  bestTimeRemaining: number;
}

export interface GameSettings {
  masterVolume: number;
  muted: boolean;
  showTrainingHints: boolean;
  forceTouchControls: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  reducedCameraMotion: boolean;
  calmMusicVolume?: number;
  calmNatureVolume?: number;
  calmScreenEffectsReduced?: boolean;
}

export interface PlayerProfile {
  name: string;
  totalGamesPlayed: number;
  totalWins: number;
  bestScore: number;
  totalTimeSurvived: number;
  kitsCollected: Record<DisasterId, boolean>;
  trainingCompleted: Record<DisasterId, boolean>;
  disasterStats: Record<DisasterId, DisasterStats>;
  unlockedAchievements: string[];
  calmCompletedActivities?: string[];
  settings: GameSettings;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: string;
}
