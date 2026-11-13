import { soundEngine } from './audio';
import { createLevelBlueprint, LevelBlueprint } from './levels';
import {
  DisasterId,
  FallingObject,
  FloatingDebris,
  GameMode,
  HazardZone,
  InteractiveObject,
  LevelSummary,
  MissionObjective,
  NPC,
  Particle,
  Rect,
  ToastFeedback,
  WallRect,
} from './types';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  joyX: number;
  joyY: number;
  actionHeld: boolean; // Space / mobile secondary action
  sprintHeld?: boolean; // Shift / mobile run
  crouchHeld?: boolean; // C / Ctrl / mobile crouch
}

export interface GameEngineState {
  disaster: DisasterId;
  mode: GameMode;
  worldWidth: number;
  worldHeight: number;
  elapsed: number;
  timeRemaining: number;
  duration: number;

  player: {
    x: number;
    y: number;
    radius: number;
    vx: number;
    vy: number;
    facingX: number;
    facingY: number;
    walkPhase: number;
    lastStrideSign: number;
    runBlend: number;
    recoilIntensity: number;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    inCoverId: string | null;
    crouching: boolean;
    bracing: boolean;
    running: boolean;
    inWater: boolean;
    inSmoke: boolean;
    invulnTimer: number;
    damageFlash: number;
  };

  safeZone: { x: number; y: number; w: number; h: number; label: string };
  floorZones: LevelBlueprint['floorZones'];
  walls: WallRect[];
  interactives: InteractiveObject[];
  hazards: HazardZone[];
  fallingObjects: FallingObject[];
  floatingDebris: FloatingDebris[];
  particles: Particle[];
  npcs: NPC[];
  objectives: MissionObjective[];

  // Disaster specific state
  eqPhase: 'tremor' | 'shaking' | 'calm' | 'aftershock';
  eqShakeIntensity: number;
  lightFlicker: number;
  floodWaterLevel: number; // 0..1
  lightningAlpha: number;
  fireAlarmActive: boolean;
  fireAlarmTimer: number;

  // Tracking & scoring
  score: number;
  safetyAccuracy: number;
  damageTaken: number;
  hazardsAvoidedCount: number;
  kitCollected: boolean;
  usedProperCover: boolean;
  soundedFireAlarm: boolean;
  crouchedInSmoke: boolean;
  breakerShutOff: boolean;
  gasShutOff: boolean;
  nearestInteractive: InteractiveObject | null;
  activeHazardWarning: string | null;
  lessonsLearned: Set<string>;
  actionLog: string[];
  toasts: ToastFeedback[];
  nextToastId: number;

  // Camera
  camX: number;
  camY: number;
  shakeOffsetX: number;
  shakeOffsetY: number;

  finished: boolean;
  summary: Omit<LevelSummary, 'newlyUnlockedAchievements'> | null;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectOverlap(cx: number, cy: number, r: number, rect: Rect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

export function createGameEngineState(disaster: DisasterId, mode: GameMode): GameEngineState {
  const bp = createLevelBlueprint(disaster);

  return {
    disaster,
    mode,
    worldWidth: bp.worldWidth,
    worldHeight: bp.worldHeight,
    elapsed: 0,
    timeRemaining: 60,
    duration: 60,

    player: {
      x: bp.playerSpawn.x,
      y: bp.playerSpawn.y,
      radius: 14,
      vx: 0,
      vy: 0,
      facingX: 0,
      facingY: 1,
      walkPhase: 0,
      lastStrideSign: 1,
      runBlend: 0,
      recoilIntensity: 0,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      inCoverId: null,
      crouching: false,
      bracing: false,
      running: false,
      inWater: false,
      inSmoke: false,
      invulnTimer: 0,
      damageFlash: 0,
    },

    safeZone: bp.safeZone,
    floorZones: bp.floorZones,
    walls: bp.walls,
    interactives: bp.interactives,
    hazards: bp.hazards,
    fallingObjects: [],
    floatingDebris: bp.floatingDebris,
    particles: [],
    npcs: bp.npcs,
    objectives: bp.objectives,

    eqPhase: 'tremor',
    eqShakeIntensity: 0.25,
    lightFlicker: 1,
    floodWaterLevel: 0.12,
    lightningAlpha: 0,
    fireAlarmActive: false,
    fireAlarmTimer: 0,

    score: 1000,
    safetyAccuracy: 100,
    damageTaken: 0,
    hazardsAvoidedCount: 0,
    kitCollected: false,
    usedProperCover: false,
    soundedFireAlarm: false,
    crouchedInSmoke: false,
    breakerShutOff: false,
    gasShutOff: false,
    nearestInteractive: null,
    activeHazardWarning: null,
    lessonsLearned: new Set<string>(),
    actionLog: [],
    toasts: [],
    nextToastId: 1,

    camX: bp.playerSpawn.x,
    camY: bp.playerSpawn.y,
    shakeOffsetX: 0,
    shakeOffsetY: 0,

    finished: false,
    summary: null,
  };
}

function pushToast(state: GameEngineState, text: string, tone: ToastFeedback['tone']) {
  // Avoid repeating identical recent toast
  if (state.toasts.some((t) => t.text === text && t.timer > 1.5)) return;
  state.toasts.push({
    id: state.nextToastId++,
    text,
    tone,
    timer: 3.4,
  });
  if (state.toasts.length > 3) {
    state.toasts.shift();
  }
}

function completeObjective(state: GameEngineState, id: string) {
  const obj = state.objectives.find((o) => o.id === id);
  if (obj && !obj.completed) {
    obj.completed = true;
    state.score += 200;
  }
}

function getSolidObstacles(state: GameEngineState): Rect[] {
  const solids: Rect[] = [];
  for (const w of state.walls) {
    solids.push(w.toppled && w.toppledRect ? w.toppledRect : w);
  }
  // Closed doors act as solid obstacles until opened
  for (const obj of state.interactives) {
    if ((obj.kind === 'exit_door' || obj.kind === 'stairs_exit' || obj.kind === 'check_door') && !obj.used) {
      solids.push({ x: obj.x, y: obj.y, w: obj.w, h: obj.h });
    }
    if (obj.kind === 'parked_car') {
      solids.push({ x: obj.x, y: obj.y, w: obj.w, h: obj.h });
    }
  }
  return solids;
}

function moveWithCollision(state: GameEngineState, dx: number, dy: number) {
  const p = state.player;
  const solids = getSolidObstacles(state);

  p.x += dx;
  p.y += dy;

  // Two-pass closest-point circle-vs-AABB resolution for smooth corner sliding
  for (let pass = 0; pass < 2; pass++) {
    p.x = Math.max(p.radius + 16, Math.min(state.worldWidth - p.radius - 16, p.x));
    p.y = Math.max(p.radius + 16, Math.min(state.worldHeight - p.radius - 16, p.y));

    for (const s of solids) {
      const closestX = Math.max(s.x, Math.min(p.x, s.x + s.w));
      const closestY = Math.max(s.y, Math.min(p.y, s.y + s.h));
      const distX = p.x - closestX;
      const distY = p.y - closestY;
      const distSq = distX * distX + distY * distY;

      if (distSq < p.radius * p.radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = p.radius - dist;
          p.x += (distX / dist) * push;
          p.y += (distY / dist) * push;
        } else {
          // Player center inside rect: push along shallowest axis
          const leftPen = p.x - s.x;
          const rightPen = s.x + s.w - p.x;
          const topPen = p.y - s.y;
          const botPen = s.y + s.h - p.y;
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) p.x = s.x - p.radius;
          else if (minPen === rightPen) p.x = s.x + s.w + p.radius;
          else if (minPen === topPen) p.y = s.y - p.radius;
          else p.y = s.y + s.h + p.radius;
        }
      }
    }
  }
}

export function triggerInteraction(
  state: GameEngineState,
  targetId?: string | null
): InteractiveObject['kind'] | null {
  if (state.finished) return null;
  const p = state.player;
  let target: InteractiveObject | null = state.nearestInteractive;

  if (targetId) {
    const lookedAt = state.interactives.find((o) => o.id === targetId);
    if (lookedAt && (!lookedAt.used || lookedAt.kind === 'cover_table')) {
      const cx = lookedAt.x + lookedAt.w / 2;
      const cy = lookedAt.y + lookedAt.h / 2;
      const dist = Math.hypot(p.x - cx, p.y - cy);
      if (dist <= lookedAt.radius + 52) {
        target = lookedAt;
      }
    }
  }

  if (!target) return null;

  switch (target.kind) {
    case 'cover_table': {
      if (p.inCoverId === target.id) {
        // Leave cover
        p.inCoverId = null;
        p.y = target.y + target.h + p.radius + 8;
        pushToast(state, 'Exited cover. Watch for fallen debris.', 'info');
        soundEngine.playInteract(true);
      } else {
        // Enter cover under table
        p.inCoverId = target.id;
        p.x = target.x + target.w / 2;
        p.y = target.y + target.h / 2;
        state.usedProperCover = true;
        completeObjective(state, 'eq_cover');
        state.lessonsLearned.add('Drop, Cover, and Hold On under a sturdy table shields you from falling debris.');
        state.actionLog.push(`Took cover under ${target.name} at ${state.elapsed.toFixed(1)}s`);
        if (!target.used) {
          target.used = true;
          state.score += 250;
        }
        pushToast(state, 'DROP, COVER & HOLD ON! Stay here until shaking stops.', 'good');
        soundEngine.playInteract(true);
      }
      break;
    }

    case 'emergency_kit': {
      if (!target.used) {
        target.used = true;
        state.kitCollected = true;
        state.score += 180;
        p.hp = Math.min(p.maxHp, p.hp + 12);
        state.actionLog.push(`Collected ${target.name} at ${state.elapsed.toFixed(1)}s`);
        state.lessonsLearned.add('An accessible emergency go-bag provides water, light, masks, and first-aid.');
        if (state.disaster === 'earthquake' && state.gasShutOff) completeObjective(state, 'eq_kit');
        if (state.disaster === 'flood' && state.breakerShutOff) completeObjective(state, 'fl_prep');
        pushToast(state, `Collected ${target.name} (+12 HP, +180 pts)`, 'good');
        soundEngine.playInteract(true);
      }
      break;
    }

    case 'gas_valve': {
      if (!target.used) {
        target.used = true;
        state.gasShutOff = true;
        state.score += 200;
        state.actionLog.push(`Shut off kitchen gas valve at ${state.elapsed.toFixed(1)}s`);
        state.lessonsLearned.add('Shutting off the gas valve after shaking stops prevents secondary fires.');
        if (state.kitCollected) completeObjective(state, 'eq_kit');
        pushToast(state, 'Gas valve shut off safely! Fire risk prevented.', 'good');
        soundEngine.playInteract(true);
      }
      break;
    }

    case 'exit_door': {
      if (state.disaster === 'earthquake' && (state.eqPhase === 'tremor' || state.eqPhase === 'shaking')) {
        // Safety rule: Never run outside during active shaking!
        state.safetyAccuracy = Math.max(0, state.safetyAccuracy - 15);
        state.score = Math.max(0, state.score - 120);
        p.hp = Math.max(state.mode === 'training' ? 20 : 0, p.hp - 14);
        state.damageTaken += 14;
        p.damageFlash = 0.5;
        p.recoilIntensity = Math.min(1, p.recoilIntensity + 0.75);
        state.actionLog.push('Attempted to exit outdoors during active shaking');
        state.lessonsLearned.add('Never run outside during an earthquake—doorways and exterior walls drop heavy debris.');
        pushToast(state, 'DANGER! Do NOT exit during shaking—Drop & Cover under a table!', 'danger');
        soundEngine.playDamage();
        return target.kind;
      }

      if (!target.used) {
        target.used = true;
        target.blocked = false;
        state.score += 150;
        state.actionLog.push(`Opened ${target.name} at ${state.elapsed.toFixed(1)}s`);
        pushToast(state, `${target.name} cleared and opened!`, 'good');
        soundEngine.playDoorOpen();
      }
      break;
    }

    case 'radio':
    case 'phone': {
      if (!target.used) {
        target.used = true;
        state.score += 150;
        completeObjective(state, 'fl_alert');
        state.actionLog.push(`Checked ${target.name} for evacuation route`);
        state.lessonsLearned.add('Official weather radio and phone alerts guide you to open high-ground routes.');
        pushToast(state, 'ALERT: Creek surging! Use North Footbridge to reach Ridge Shelter!', 'info');
        soundEngine.playInteract(true);
      }
      break;
    }

    case 'breaker_panel': {
      if (!target.used) {
        target.used = true;
        state.breakerShutOff = true;
        state.score += 180;
        if (state.kitCollected) completeObjective(state, 'fl_prep');
        state.actionLog.push(`Shut off main electrical breaker at ${state.elapsed.toFixed(1)}s`);
        state.lessonsLearned.add('Cutting main power before floodwater enters prevents home electrocution.');
        pushToast(state, 'Main electrical breaker switched OFF safely.', 'good');
        soundEngine.playInteract(true);
      }
      break;
    }

    case 'parked_car': {
      state.safetyAccuracy = Math.max(0, state.safetyAccuracy - 10);
      state.score = Math.max(0, state.score - 80);
      state.actionLog.push('Attempted to inspect/use vehicle in flood zone');
      state.lessonsLearned.add('Turn Around, Don\'t Drown: 12 inches of moving water can float a car.');
      pushToast(state, 'UNSAFE! Never drive through floodwater—evacuate on foot to high ground!', 'warn');
      soundEngine.playInteract(false);
      break;
    }

    case 'fire_alarm': {
      if (!target.used) {
        target.used = true;
        state.fireAlarmActive = true;
        state.soundedFireAlarm = true;
        state.score += 220;
        completeObjective(state, 'fi_alarm');
        state.actionLog.push(`Pulled fire alarm at ${state.elapsed.toFixed(1)}s`);
        state.lessonsLearned.add('Sounding the fire alarm early gives everyone crucial seconds to evacuate.');
        for (const npc of state.npcs) {
          npc.speech = 'Alarm sounded—heading to North Stairs!';
          npc.speechTimer = 4;
        }
        pushToast(state, 'Fire alarm activated! Coworkers alerted—evacuate via North Stairs!', 'good');
        soundEngine.playFireAlarmPulse();
      }
      break;
    }

    case 'elevator': {
      state.safetyAccuracy = Math.max(0, state.safetyAccuracy - 18);
      state.score = Math.max(0, state.score - 150);
      state.actionLog.push('Attempted to use elevator during fire');
      state.lessonsLearned.add('Never use elevators in a fire—power failure or smoke in shafts is fatal.');
      pushToast(state, 'DANGER! Elevators are DISABLED during fire! Use the Fire Stairwell!', 'danger');
      soundEngine.playDamage();
      break;
    }

    case 'check_door': {
      if (!target.used) {
        target.used = true; // marks inspected (remains physically blocked!)
        state.score += 140;
        completeObjective(state, 'fi_avoid_elev');
        state.actionLog.push('Checked East Exit door temperature safely');
        state.lessonsLearned.add('Feeling closed doors for heat before opening keeps deadly flashover flames out.');
        pushToast(state, 'DOOR IS SCORCHING HOT! Do not open—reroute to North-East Stairs!', 'warn');
        soundEngine.playInteract(true);
      }
      break;
    }

    case 'fire_extinguisher': {
      if (!target.used) {
        const binFire = state.hazards.find((h) => h.id === 'small_bin_fire');
        if (binFire && binFire.active) {
          target.used = true;
          binFire.active = false;
          state.score += 180;
          state.actionLog.push('Extinguished small corridor bin fire with clear exit behind');
          state.lessonsLearned.add('Only fight small contained fires if your escape route behind you stays clear.');
          pushToast(state, 'Small bin fire extinguished! Proceed low to North-East Stairs!', 'good');
          soundEngine.playInteract(true);
        }
      }
      break;
    }

    case 'stairs_exit': {
      if (!target.used) {
        target.used = true;
        state.score += 200;
        completeObjective(state, 'fi_avoid_elev');
        state.actionLog.push('Opened North-East Fire Stairwell door');
        pushToast(state, 'Stairwell open! Head to the Outdoor Assembly Point!', 'good');
        soundEngine.playDoorOpen();
      }
      break;
    }
  }
  return target.kind;
}

function finalizeRun(state: GameEngineState, victory: boolean, failureReason?: string): void {
  if (state.finished) return;
  state.finished = true;

  const totalObjectives = state.objectives.length;
  const objectivesCompleted = state.objectives.filter((o) => o.completed).length;

  if (victory) {
    if (state.mode === 'survival') {
      state.score += Math.round(state.timeRemaining * 15);
    }
    state.score += 300;
    soundEngine.playVictory();
  } else {
    soundEngine.playGameOver();
  }

  // Ensure default disaster lessons are present
  if (state.lessonsLearned.size === 0) {
    if (state.disaster === 'earthquake') {
      state.lessonsLearned.add('Drop, Cover, and Hold On under sturdy furniture until shaking stops.');
    } else if (state.disaster === 'flood') {
      state.lessonsLearned.add('Avoid floodwaters and downed power lines; evacuate to higher ground.');
    } else {
      state.lessonsLearned.add('Stay low under smoke, check doors for heat, and use stairs—never elevators.');
    }
  }

  state.summary = {
    disaster: state.disaster,
    mode: state.mode,
    victory,
    score: Math.max(0, Math.round(state.score)),
    timeSurvived: state.elapsed,
    timeRemaining: Math.max(0, state.timeRemaining),
    safetyAccuracy: Math.max(0, Math.min(100, Math.round(state.safetyAccuracy))),
    hazardsAvoided: state.hazardsAvoidedCount + (state.damageTaken === 0 ? 3 : 1),
    objectivesCompleted,
    totalObjectives,
    damageTaken: Math.round(state.damageTaken),
    failureReason,
    lessonsLearned: Array.from(state.lessonsLearned),
    actionLog: state.actionLog,
    kitCollected: state.kitCollected,
  };
}

export function stepGameEngine(state: GameEngineState, input: InputState, rawDt: number): void {
  if (state.finished) return;
  const dt = Math.min(0.05, Math.max(0.001, rawDt));

  state.elapsed += dt;
  if (state.mode === 'survival') {
    state.timeRemaining = Math.max(0, state.duration - state.elapsed);
    if (state.timeRemaining <= 0) {
      finalizeRun(
        state,
        false,
        'The 60-second emergency window expired before you reached the designated safe assembly zone.'
      );
      return;
    }
  }

  // Decay toasts
  for (let i = state.toasts.length - 1; i >= 0; i--) {
    state.toasts[i].timer -= dt;
    if (state.toasts[i].timer <= 0) {
      state.toasts.splice(i, 1);
    }
  }

  const p = state.player;
  if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  if (p.damageFlash > 0) p.damageFlash = Math.max(0, p.damageFlash - dt * 2.4);
  if (p.recoilIntensity > 0) p.recoilIntensity = Math.max(0, p.recoilIntensity - dt * 3.2);

  // Context action (Space) & dedicated Crouch (C / Ctrl)
  p.crouching = ((state.disaster === 'fire' && input.actionHeld) || Boolean(input.crouchHeld)) && !p.inCoverId;
  p.bracing = state.disaster === 'earthquake' && input.actionHeld;

  if (p.crouching && p.inSmoke) {
    state.crouchedInSmoke = true;
    completeObjective(state, 'fi_crouch');
  }

  // Movement Vector
  let mx = input.joyX;
  let my = input.joyY;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;

  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }

  if (p.inCoverId) {
    p.vx = 0;
    p.vy = 0;
    p.running = false;
    p.runBlend = Math.max(0, p.runBlend - dt * 6);
    if (p.bracing && (state.eqPhase === 'shaking' || state.eqPhase === 'aftershock')) {
      state.score += dt * 12;
    }
  } else {
    let baseSpeed = 182;
    if (p.crouching) baseSpeed = 104;

    // Sprint with Shift OR Space in Flood/calm Earthquake (blocked while crouching)
    const sprintRequested =
      Boolean(input.sprintHeld) ||
      ((state.disaster === 'flood' || (state.disaster === 'earthquake' && state.eqPhase === 'calm')) &&
        input.actionHeld);

    const wantsSprint = !p.crouching && sprintRequested && mag > 0.12 && p.stamina > 6;
    p.running = wantsSprint;
    p.runBlend += ((wantsSprint ? 1 : 0) - p.runBlend) * Math.min(1, dt * 8);

    if (wantsSprint) {
      baseSpeed *= 1.44;
      p.stamina = Math.max(0, p.stamina - 24 * dt);
    } else {
      p.stamina = Math.min(p.maxStamina, p.stamina + 18 * dt);
    }

    if (p.inWater) {
      baseSpeed *= 0.48;
    } else if (p.inSmoke && !p.crouching) {
      baseSpeed *= 0.82;
    }

    const targetVx = mx * baseSpeed;
    const targetVy = my * baseSpeed;
    const hasInput = mag > 0.08;
    const accelRate = hasInput ? (p.inWater ? 8.5 : 13.5) : p.inWater ? 10 : 16;
    const blend = 1 - Math.exp(-accelRate * dt);
    p.vx += (targetVx - p.vx) * blend;
    p.vy += (targetVy - p.vy) * blend;

    const currentSpeed = Math.hypot(p.vx, p.vy);
    if (hasInput) {
      p.facingX = mx;
      p.facingY = my;
    }

    if (currentSpeed > 10) {
      p.walkPhase += dt * (currentSpeed / 25);
      const strideSign = Math.sin(p.walkPhase * 2) >= 0 ? 1 : -1;
      if (strideSign !== p.lastStrideSign) {
        p.lastStrideSign = strideSign;
        soundEngine.playFootstep(p.inWater ? 'water' : 'floor', p.runBlend > 0.45);
      }
      moveWithCollision(state, p.vx * dt, p.vy * dt);
    } else {
      p.vx = 0;
      p.vy = 0;
    }
  }

  // --- DISASTER-SPECIFIC SIMULATION ---
  if (state.disaster === 'earthquake') {
    stepEarthquake(state, dt);
  } else if (state.disaster === 'flood') {
    stepFlood(state, dt);
  } else {
    stepFire(state, dt);
  }

  // --- HAZARD COLLISION & DAMAGE ---
  p.inWater = false;
  p.inSmoke = false;
  state.activeHazardWarning = null;

  for (const h of state.hazards) {
    if (!h.active) continue;
    // Dynamic flood activation threshold
    if (state.disaster === 'flood' && h.id === 'creek_basin_south' && state.floodWaterLevel < 0.35) {
      continue;
    }
    if (circleRectOverlap(p.x, p.y, p.radius - 2, h)) {
      if (h.kind === 'floodwater' || h.kind === 'electric_water') {
        p.inWater = true;
      }
      if (h.kind === 'smoke') {
        p.inSmoke = true;
      }

      state.activeHazardWarning = h.label;

      // Damage logic
      let dmgRate = h.damagePerSec;
      if (h.kind === 'smoke' && p.crouching) {
        dmgRate *= 0.12; // Staying low dramatically cuts smoke damage!
      }
      if (p.inCoverId && (h.kind === 'glass' || h.kind === 'falling_debris')) {
        dmgRate = 0; // Protected under table!
      }
      if (h.kind === 'electric_water' && state.breakerShutOff && h.x < 500) {
        dmgRate *= 0.4;
      }

      if (dmgRate > 0) {
        const dmg = dmgRate * dt * (state.mode === 'training' ? 0.45 : 1);
        p.hp = Math.max(state.mode === 'training' ? 15 : 0, p.hp - dmg);
        state.damageTaken += dmg;
        state.safetyAccuracy = Math.max(0, state.safetyAccuracy - dt * 5);
        state.score = Math.max(0, state.score - dt * 18);
        p.damageFlash = Math.min(1, p.damageFlash + dt * 3);

        if (p.invulnTimer <= 0) {
          soundEngine.playDamage();
          p.invulnTimer = 0.6;
          p.recoilIntensity = Math.min(1, p.recoilIntensity + 0.55);
        }

        if (p.hp <= 0 && state.mode === 'survival') {
          finalizeRun(state, false, `Sustained fatal injury from ${h.label.toLowerCase()}.`);
          return;
        }
      }
    }
  }

  // --- NEAREST INTERACTIVE DETECTION ---
  let bestObj: InteractiveObject | null = null;
  let bestDist = Infinity;
  for (const obj of state.interactives) {
    // Allow cover_table interaction even if already used so player can leave cover
    if (obj.used && obj.kind !== 'cover_table') continue;
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist <= obj.radius && dist < bestDist) {
      bestDist = dist;
      bestObj = obj;
    }
  }
  state.nearestInteractive = bestObj;

  // --- NPC MOVEMENT ---
  for (const npc of state.npcs) {
    if (npc.speechTimer > 0) npc.speechTimer = Math.max(0, npc.speechTimer - dt);
    if (npc.evacuated) continue;
    if (state.disaster === 'fire' && !state.fireAlarmActive) continue;

    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      npc.evacuated = true;
    } else {
      const speed = 110;
      npc.x += (dx / dist) * speed * dt;
      npc.y += (dy / dist) * speed * dt;
    }
  }

  // --- SAFE ZONE VICTORY CHECK ---
  const sz = state.safeZone;
  if (
    p.x > sz.x &&
    p.x < sz.x + sz.w &&
    p.y > sz.y &&
    p.y < sz.y + sz.h
  ) {
    if (state.disaster === 'earthquake') completeObjective(state, 'eq_evacuate');
    if (state.disaster === 'flood') {
      completeObjective(state, 'fl_avoid');
      completeObjective(state, 'fl_shelter');
    }
    if (state.disaster === 'fire') completeObjective(state, 'fi_escape');
    finalizeRun(state, true);
    return;
  }

  // --- UPDATE PARTICLES ---
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life += dt;
    if (pt.life >= pt.maxLife) {
      state.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.alpha = 1 - pt.life / pt.maxLife;
  }

  // --- CAMERA SMOOTH FOLLOW + SCREEN SHAKE ---
  state.camX += (p.x - state.camX) * Math.min(1, dt * 8);
  state.camY += (p.y - state.camY) * Math.min(1, dt * 8);

  const shakeAmp =
    state.disaster === 'earthquake'
      ? state.eqShakeIntensity * 11
      : state.lightningAlpha * 6;
  state.shakeOffsetX = (Math.random() * 2 - 1) * shakeAmp;
  state.shakeOffsetY = (Math.random() * 2 - 1) * shakeAmp;
}

function stepEarthquake(state: GameEngineState, dt: number) {
  const t = state.elapsed;
  const prevPhase = state.eqPhase;

  if (t < 3) {
    state.eqPhase = 'tremor';
    state.eqShakeIntensity = 0.25;
  } else if (t < 22) {
    state.eqPhase = 'shaking';
    state.eqShakeIntensity = 0.85 + Math.sin(t * 7) * 0.15;
    state.lightFlicker = Math.sin(t * 27) > -0.35 ? 1 : 0.45;
  } else if (t >= 38 && t < 42) {
    state.eqPhase = 'aftershock';
    state.eqShakeIntensity = 0.55;
    state.lightFlicker = Math.sin(t * 21) > -0.2 ? 1 : 0.6;
  } else {
    state.eqPhase = 'calm';
    state.eqShakeIntensity = 0;
    state.lightFlicker = 1;
  }

  if (prevPhase !== state.eqPhase) {
    if (state.eqPhase === 'shaking') {
      soundEngine.playRumble();
      pushToast(state, 'EARTHQUAKE! Drop, Cover & Hold On under a sturdy table!', 'danger');
      for (const h of state.hazards) {
        if (h.kind === 'glass') h.active = true;
      }
    } else if (state.eqPhase === 'calm' && prevPhase === 'shaking') {
      completeObjective(state, 'eq_wait');
      if (state.player.inCoverId) {
        state.score += 200;
      }
      pushToast(state, 'Main shaking stopped! Grab Kit, check Gas Valve & evacuate!', 'good');
    } else if (state.eqPhase === 'aftershock') {
      soundEngine.playRumble();
      pushToast(state, 'AFTERSHOCK! Hold Space to brace and stay clear of walls!', 'warn');
    }
  }

  // Topple heavy furniture on schedule
  for (const w of state.walls) {
    if (w.toppleAt && !w.toppled && t >= w.toppleAt) {
      w.toppled = true;
      soundEngine.playRumble();
      soundEngine.playImpactThud();
      state.player.recoilIntensity = Math.min(1, state.player.recoilIntensity + 0.65);
      pushToast(state, `${w.label || 'Shelf'} toppled! Stay away from heavy furniture!`, 'warn');
      if (w.toppledRect && circleRectOverlap(state.player.x, state.player.y, state.player.radius, w.toppledRect)) {
        if (!state.player.inCoverId) {
          const dmg = state.mode === 'training' ? 10 : 22;
          state.player.hp = Math.max(state.mode === 'training' ? 15 : 0, state.player.hp - dmg);
          state.damageTaken += dmg;
          state.player.damageFlash = 0.7;
          soundEngine.playDamage();
        }
      }
    }
  }

  // Spawn falling plaster/books during shaking
  if ((state.eqPhase === 'shaking' || state.eqPhase === 'aftershock') && Math.random() < dt * 2.5) {
    const kinds: FallingObject['kind'][] = ['books', 'plaster', 'lamp', 'pot'];
    const fx = 170 + Math.random() * 840;
    const fy = 170 + Math.random() * 610;
    state.fallingObjects.push({
      id: `fall_${Math.random()}`,
      x: fx,
      y: fy - 90,
      targetY: fy,
      vy: 260,
      size: 12 + Math.random() * 8,
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      landed: false,
      hitChecked: false,
    });
  }

  for (let i = state.fallingObjects.length - 1; i >= 0; i--) {
    const fo = state.fallingObjects[i];
    if (!fo.landed) {
      fo.y += fo.vy * dt;
      if (fo.y >= fo.targetY) {
        fo.y = fo.targetY;
        fo.landed = true;
        const distToPlayer = Math.hypot(state.player.x - fo.x, state.player.y - fo.y);
        if (distToPlayer < 180) {
          state.player.recoilIntensity = Math.min(1, state.player.recoilIntensity + (1 - distToPlayer / 180) * 0.45);
          soundEngine.playImpactThud();
        }
        // Dust puff
        for (let k = 0; k < 5; k++) {
          state.particles.push({
            x: fo.x,
            y: fo.y,
            vx: (Math.random() - 0.5) * 70,
            vy: (Math.random() - 0.5) * 70,
            size: 5 + Math.random() * 6,
            alpha: 0.7,
            life: 0,
            maxLife: 0.65,
            color: '#cbd5e1',
            kind: 'dust',
          });
        }
        // Check hit on player if NOT in cover
        if (!fo.hitChecked && distToPlayer < fo.size + state.player.radius + 8) {
          fo.hitChecked = true;
          if (state.player.inCoverId) {
            state.hazardsAvoidedCount += 1;
          } else {
            const dmg = state.mode === 'training' ? 8 : 16;
            state.player.hp = Math.max(state.mode === 'training' ? 15 : 0, state.player.hp - dmg);
            state.damageTaken += dmg;
            state.safetyAccuracy = Math.max(0, state.safetyAccuracy - 8);
            state.player.damageFlash = 0.6;
            state.player.recoilIntensity = Math.min(1, state.player.recoilIntensity + 0.7);
            soundEngine.playDamage();
            pushToast(state, 'Hit by falling debris! Get under a sturdy table!', 'danger');
          }
        }
      }
    }
  }
}

function stepFlood(state: GameEngineState, dt: number) {
  const rate = state.mode === 'training' ? 0.011 : 0.022;
  state.floodWaterLevel = Math.min(1, state.floodWaterLevel + rate * dt);

  const creekBasin = state.hazards.find((h) => h.id === 'creek_basin_south');
  if (creekBasin) {
    creekBasin.intensity = state.floodWaterLevel;
    // Expand flood zone northward slightly as water rises
    creekBasin.y = 470 - state.floodWaterLevel * 75;
    creekBasin.h = 490 + state.floodWaterLevel * 75;
  }

  // Lightning & thunder periodically
  if (state.lightningAlpha > 0) {
    state.lightningAlpha = Math.max(0, state.lightningAlpha - dt * 2.5);
  }
  if (Math.random() < dt * 0.14) {
    state.lightningAlpha = 0.85;
    soundEngine.playThunder();
  }

  // Ambient rain particles around camera
  const camX = state.camX;
  const camY = state.camY;
  for (let i = 0; i < 4; i++) {
    state.particles.push({
      x: camX + (Math.random() - 0.5) * 1100,
      y: camY + (Math.random() - 0.5) * 760,
      vx: -90,
      vy: 420,
      size: 2,
      alpha: 0.55,
      life: 0,
      maxLife: 0.45,
      color: '#bae6fd',
      kind: 'rain',
    });
  }

  // Electric sparks near downed poles
  if (Math.random() < dt * 7) {
    for (const h of state.hazards) {
      if (h.kind === 'electric_water') {
        state.particles.push({
          x: h.x + h.w / 2 + (Math.random() - 0.5) * 50,
          y: h.y + h.h / 2 + (Math.random() - 0.5) * 50,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          size: 3,
          alpha: 1,
          life: 0,
          maxLife: 0.35,
          color: '#38bdf8',
          kind: 'spark',
        });
      }
    }
  }

  // Move floating debris inside flood basin
  for (const deb of state.floatingDebris) {
    deb.x += deb.vx * dt;
    deb.y += deb.vy * dt;
    if (deb.x < 460 || deb.x > 1140) deb.vx *= -1;
    if (deb.y < 140 || deb.y > 900) deb.vy *= -1;
    if (circleRectOverlap(state.player.x, state.player.y, state.player.radius, deb)) {
      moveWithCollision(state, deb.vx * dt * 1.4, deb.vy * dt * 1.4);
    }
  }
}

function stepFire(state: GameEngineState, dt: number) {
  if (state.fireAlarmActive) {
    state.fireAlarmTimer += dt;
    if (state.fireAlarmTimer >= 2.2) {
      state.fireAlarmTimer = 0;
      soundEngine.playFireAlarmPulse();
    }
  }

  // Spread main fires slowly
  const spreadMult = state.mode === 'training' ? 0.35 : 1;
  for (const h of state.hazards) {
    if (h.active && h.kind === 'fire' && h.spreadRate) {
      const grow = h.spreadRate * spreadMult * dt;
      h.x -= grow * 0.5;
      h.y -= grow * 0.5;
      h.w = Math.min(280, h.w + grow);
      h.h = Math.min(290, h.h + grow);
    }
  }

  // Emit embers & smoke plumes from active fires
  if (Math.random() < dt * 14) {
    for (const h of state.hazards) {
      if (h.active && h.kind === 'fire') {
        state.particles.push({
          x: h.x + Math.random() * h.w,
          y: h.y + Math.random() * h.h,
          vx: (Math.random() - 0.5) * 28,
          vy: -35 - Math.random() * 45,
          size: 3 + Math.random() * 4,
          alpha: 0.9,
          life: 0,
          maxLife: 0.9,
          color: Math.random() > 0.4 ? '#fb923c' : '#facc15',
          kind: 'ember',
        });
      }
    }
  }

  if (Math.random() < dt * 8) {
    for (const h of state.hazards) {
      if (h.active && h.kind === 'smoke') {
        state.particles.push({
          x: h.x + Math.random() * h.w,
          y: h.y + Math.random() * h.h,
          vx: (Math.random() - 0.5) * 18,
          vy: -14 - Math.random() * 14,
          size: 16 + Math.random() * 18,
          alpha: 0.35,
          life: 0,
          maxLife: 1.5,
          color: '#334155',
          kind: 'smoke',
        });
      }
    }
  }
}
