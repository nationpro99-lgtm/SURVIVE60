import { soundEngine } from './audio';
import { InteractiveObject, Rect, WallRect } from './types';

export interface CalmActivityDef {
  id: string;
  title: string;
  category: 'Earthquake' | 'Emergency Kit' | 'Electricity' | 'Fire Safety' | 'Exits' | 'Flood Route';
  shortHint: string;
  tip: string;
  items?: { name: string; purpose: string }[];
  teleportPos: { x: number; y: number; yaw: number };
}

export const CALM_ACTIVITIES: CalmActivityDef[] = [
  {
    id: 'calm_cover_table',
    title: 'Safe Spot During an Earthquake',
    category: 'Earthquake',
    shortHint: 'Practice Drop, Cover & Hold On under the oak dining table',
    tip: 'During an earthquake, move away from windows and tall shelves. Drop onto your hands and knees, take cover beneath a sturdy table, protect your head and neck, and hold on until shaking ends.',
    teleportPos: { x: 255, y: 635, yaw: -Math.PI * 0.25 },
  },
  {
    id: 'calm_kit_open',
    title: 'Open the Emergency Kit',
    category: 'Emergency Kit',
    shortHint: 'Open the red go-bag on the kitchen counter to review essentials',
    tip: 'Keep a grab-and-go Emergency Kit near your kitchen or entryway so your household can evacuate calmly in seconds without searching.',
    items: [
      { name: 'Drinking Water (3-Day Supply)', purpose: '1 gallon per person per day for hydration' },
      { name: 'LED Flashlight & Spare Batteries', purpose: 'Safe lighting without open flames during outages' },
      { name: 'Compact First-Aid Pouch', purpose: 'Bandages, antiseptic wipes, and personal medications' },
      { name: 'Emergency Whistle', purpose: 'Signals responders with far less effort than shouting' },
      { name: 'Foil Thermal Blanket & Copies of IDs', purpose: 'Preserves warmth and speeds shelter check-in' },
    ],
    teleportPos: { x: 430, y: 315, yaw: 0 },
  },
  {
    id: 'calm_supplies_table',
    title: 'Inspect Emergency Supplies',
    category: 'Emergency Kit',
    shortHint: 'Pick up and inspect water, flashlight, and battery radio gear',
    tip: 'Store clean water in sealed containers and test flashlights and battery-powered weather radios every six months so nothing fails when power goes out.',
    items: [
      { name: 'Sealed Water Bottles', purpose: 'Check expiration dates twice a year' },
      { name: 'Hand-Crank / Battery Radio', purpose: 'Receives official evacuation advisories if cell service drops' },
      { name: 'Heavy-Duty Work Gloves', purpose: 'Protects hands from broken glass or sharp debris outdoors' },
    ],
    teleportPos: { x: 520, y: 690, yaw: -Math.PI * 0.5 },
  },
  {
    id: 'calm_breaker',
    title: 'Switch Off Electricity Safely',
    category: 'Electricity',
    shortHint: 'Inspect the main electrical breaker panel in the utility hallway',
    tip: 'Only touch the main breaker with dry hands while standing on a dry floor. Shutting off home power before rising floodwater reaches outlets prevents electrical shock and short circuits.',
    teleportPos: { x: 260, y: 260, yaw: Math.PI * 0.5 },
  },
  {
    id: 'calm_extinguisher',
    title: 'Fire Extinguisher & P.A.S.S.',
    category: 'Fire Safety',
    shortHint: 'Check the ABC fire extinguisher mounted near the living hall',
    tip: 'Remember P.A.S.S.: Pull the safety pin, Aim low at the base of a small fire, Squeeze the lever slowly, and Sweep side to side—always keeping a clear exit behind you.',
    teleportPos: { x: 540, y: 405, yaw: -Math.PI * 0.5 },
  },
  {
    id: 'calm_front_exit',
    title: 'Primary Emergency Exit',
    category: 'Exits',
    shortHint: 'Open the illuminated front porch EXIT door leading to the garden',
    tip: 'Keep hallways and doorways uncluttered at all times. Illuminated EXIT routes ensure everyone in a home or building can orient themselves even in low light.',
    teleportPos: { x: 575, y: 525, yaw: -Math.PI * 0.5 },
  },
  {
    id: 'calm_garden_exit',
    title: 'Secondary Exit & Two Ways Out',
    category: 'Exits',
    shortHint: 'Identify and open the north-east garden exit door',
    tip: 'Always know at least two ways out of every room or home. If one doorway is blocked by debris or heat, a second exit leads you safely outside.',
    teleportPos: { x: 485, y: 235, yaw: Math.PI },
  },
  {
    id: 'calm_ridge_shelter',
    title: 'Flood Evacuation Route to High Ground',
    category: 'Flood Route',
    shortHint: 'Follow the garden trail across the footbridge up to the Gazebo',
    tip: 'When flooding threatens, leave low-lying creeks and valleys early. Cross sturdy elevated bridges instead of wading through water, and gather at marked high ground.',
    teleportPos: { x: 1325, y: 530, yaw: -Math.PI * 0.5 },
  },
];

export interface CalmInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  joyX: number;
  joyY: number;
  sprintHeld: boolean;
  crouchHeld: boolean;
}

export interface CalmLessonCard {
  id: string;
  title: string;
  category: CalmActivityDef['category'];
  tip: string;
  items?: { name: string; purpose: string }[];
}

export interface CalmEngineState {
  worldWidth: number;
  worldHeight: number;
  elapsed: number;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    crouching: boolean;
    running: boolean;
    runBlend: number;
    walkPhase: number;
    inCoverId: string | null;
    facingX: number;
    facingY: number;
  };
  walls: WallRect[];
  interactives: InteractiveObject[];
  completedIds: string[];
  doorOpenMap: Record<string, boolean>;
  breakerSwitchedOff: boolean;
  kitOpened: boolean;
  nearestInteractive: InteractiveObject | null;
  activeLesson: CalmLessonCard | null;
  lessonTimer: number;
  locationLabel: string;
}

export function getCalmGroundHeightWorld(worldX: number, worldZ: number): number {
  // Blueprint x = worldX / 0.025, blueprint y = worldZ / 0.025
  const bpX = worldX / 0.025;
  const bpY = worldZ / 0.025;

  // Arched footbridge spanning brook (bpX 950..1130, bpY 465..595)
  if (bpX >= 945 && bpX <= 1135 && bpY >= 460 && bpY <= 600) {
    const t = (bpX - 945) / (1135 - 945);
    return 0.14 + Math.sin(t * Math.PI) * 0.52;
  }

  // Smooth elevated ramp & High-Ground Gazebo plateau (east side bpX >= 1220)
  if (bpX >= 1220 && bpX <= 1320) {
    const t = (bpX - 1220) / 100;
    const smooth = t * t * (3 - 2 * t);
    return smooth * 0.68;
  }
  if (bpX > 1320) {
    return 0.68;
  }

  // Slight gentle rise north-west meadow hill behind house/gazebo
  return 0;
}

function resolveZoneLabel(x: number, y: number): string {
  if (x <= 620 && y >= 180 && y <= 880) {
    if (y < 365 && x > 320) return 'Safe House · Kitchen & Prep';
    if (y < 365 && x <= 320) return 'Safe House · Utility Hall';
    if (y > 570 && x < 410) return 'Safe House · Dining Room';
    return 'Safe House · Living Area';
  }
  if (x >= 945 && x <= 1135 && y >= 455 && y <= 605) {
    return 'Sunlit Brook · Timber Footbridge';
  }
  if (x >= 1260 && y >= 330 && y <= 730) {
    return 'High-Ground Overlook · Gazebo';
  }
  return 'Sunlit Garden & Evacuation Trail';
}

function moveWithCollision(
  player: { x: number; y: number; radius: number },
  dx: number,
  dy: number,
  walls: WallRect[],
  worldW: number,
  worldH: number
) {
  player.x += dx;
  player.y += dy;
  player.x = Math.max(player.radius + 14, Math.min(worldW - player.radius - 14, player.x));
  player.y = Math.max(player.radius + 14, Math.min(worldH - player.radius - 14, player.y));

  for (let pass = 0; pass < 2; pass++) {
    for (const w of walls) {
      const closestX = Math.max(w.x, Math.min(player.x, w.x + w.w));
      const closestY = Math.max(w.y, Math.min(player.y, w.y + w.h));
      const distX = player.x - closestX;
      const distY = player.y - closestY;
      const distSq = distX * distX + distY * distY;
      if (distSq < player.radius * player.radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = player.radius - dist;
          player.x += (distX / dist) * overlap;
          player.y += (distY / dist) * overlap;
        } else {
          const leftPen = player.x - w.x;
          const rightPen = w.x + w.w - player.x;
          const topPen = player.y - w.y;
          const botPen = w.y + w.h - player.y;
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) player.x = w.x - player.radius;
          else if (minPen === rightPen) player.x = w.x + w.w + player.radius;
          else if (minPen === topPen) player.y = w.y - player.radius;
          else player.y = w.y + w.h + player.radius;
        }
      }
    }
  }
}

export function createCalmEngineState(initialCompletedIds: string[] = []): CalmEngineState {
  const walls: WallRect[] = [
    // Safe House outer walls (x: 120..620, y: 180..880)
    // Top wall (with garden exit gap at x: 455..525)
    { x: 120, y: 180, w: 335, h: 20, kind: 'wall' },
    { x: 525, y: 180, w: 95, h: 20, kind: 'wall' },
    // Bottom wall (with large sunlit windows)
    { x: 120, y: 860, w: 120, h: 20, kind: 'wall' },
    { x: 240, y: 864, w: 140, h: 12, kind: 'window', label: 'Sunlit Window' },
    { x: 380, y: 860, w: 240, h: 20, kind: 'wall' },
    // West wall
    { x: 120, y: 200, w: 20, h: 220, kind: 'wall' },
    { x: 124, y: 420, w: 12, h: 180, kind: 'window', label: 'Garden Window' },
    { x: 120, y: 600, w: 20, h: 260, kind: 'wall' },
    // East wall (front porch exit gap at y: 485..565)
    { x: 600, y: 200, w: 20, h: 120, kind: 'wall' },
    { x: 604, y: 320, w: 12, h: 110, kind: 'window', label: 'Porch Window' },
    { x: 600, y: 430, w: 20, h: 55, kind: 'wall' },
    { x: 600, y: 565, w: 20, h: 85, kind: 'wall' },
    { x: 604, y: 650, w: 12, h: 120, kind: 'window', label: 'Patio Window' },
    { x: 600, y: 770, w: 20, h: 90, kind: 'wall' },

    // Interior divider between Utility Hall & Living Room (with wide open doorway)
    { x: 315, y: 200, w: 16, h: 145, kind: 'wall' },
    // Interior half-wall / kitchen counter island
    { x: 390, y: 345, w: 110, h: 32, kind: 'furniture', label: 'Kitchen Counter' },
    { x: 540, y: 210, w: 52, h: 36, kind: 'furniture', label: 'Fridge' },

    // Furniture inside Safe House
    { x: 255, y: 685, w: 110, h: 72, kind: 'furniture', label: 'Sturdy Oak Table' },
    { x: 155, y: 470, w: 54, h: 125, kind: 'furniture', label: 'Living Sofa' },
    { x: 260, y: 495, w: 46, h: 78, kind: 'furniture', label: 'Coffee Table' },
    { x: 148, y: 775, w: 85, h: 34, kind: 'furniture', label: 'Bookshelf' },
    { x: 500, y: 745, w: 80, h: 48, kind: 'furniture', label: 'Supplies Table' },

    // Outdoor Brook guard rails north/south of footbridge so player crosses the bridge comfortably
    { x: 965, y: 40, w: 150, h: 410, kind: 'wall', label: 'Brook Bank North' },
    { x: 965, y: 615, w: 150, h: 405, kind: 'wall', label: 'Brook Bank South' },

    // Natural perimeter trees (non-intrusive garden grove framing the courtyard & trail)
    { x: 760, y: 180, w: 38, h: 38, kind: 'tree' },
    { x: 855, y: 780, w: 38, h: 38, kind: 'tree' },
    { x: 740, y: 840, w: 38, h: 38, kind: 'tree' },
    { x: 1210, y: 210, w: 38, h: 38, kind: 'tree' },
    { x: 1245, y: 810, w: 38, h: 38, kind: 'tree' },
    { x: 1530, y: 240, w: 40, h: 40, kind: 'tree' },
    { x: 1545, y: 770, w: 40, h: 40, kind: 'tree' },
  ];

  const interactives: InteractiveObject[] = [
    {
      id: 'calm_cover_table',
      kind: 'cover_table',
      name: 'Sturdy Oak Dining Table',
      x: 255,
      y: 685,
      w: 110,
      h: 72,
      radius: 95,
      prompt: 'Press E · Practice Drop, Cover & Hold On',
      secondaryPrompt: 'Press E · Stand Up Gently',
      used: initialCompletedIds.includes('calm_cover_table'),
      trainingTip: CALM_ACTIVITIES[0].tip,
    },
    {
      id: 'calm_kit_open',
      kind: 'emergency_kit',
      name: 'Emergency Go-Bag Kit',
      x: 425,
      y: 342,
      w: 44,
      h: 36,
      radius: 85,
      prompt: 'Press E · Open & Inspect Emergency Kit',
      used: initialCompletedIds.includes('calm_kit_open'),
      trainingTip: CALM_ACTIVITIES[1].tip,
    },
    {
      id: 'calm_supplies_table',
      kind: 'radio',
      name: 'Emergency Supplies & Radio',
      x: 518,
      y: 748,
      w: 50,
      h: 40,
      radius: 85,
      prompt: 'Press E · Inspect Water, Flashlight & Radio',
      used: initialCompletedIds.includes('calm_supplies_table'),
      trainingTip: CALM_ACTIVITIES[2].tip,
    },
    {
      id: 'calm_breaker',
      kind: 'breaker_panel',
      name: 'Main Electrical Breaker',
      x: 150,
      y: 236,
      w: 38,
      h: 38,
      radius: 85,
      prompt: 'Press E · Practice Switching Off Electricity',
      used: initialCompletedIds.includes('calm_breaker'),
      trainingTip: CALM_ACTIVITIES[3].tip,
    },
    {
      id: 'calm_extinguisher',
      kind: 'fire_extinguisher',
      name: 'ABC Fire Extinguisher',
      x: 556,
      y: 390,
      w: 34,
      h: 34,
      radius: 85,
      prompt: 'Press E · Inspect Fire Extinguisher (P.A.S.S.)',
      used: initialCompletedIds.includes('calm_extinguisher'),
      trainingTip: CALM_ACTIVITIES[4].tip,
    },
    {
      id: 'calm_front_exit',
      kind: 'exit_door',
      name: 'Primary Front Porch EXIT',
      x: 598,
      y: 485,
      w: 24,
      h: 80,
      radius: 95,
      prompt: 'Press E · Open / Inspect Front EXIT Door',
      used: initialCompletedIds.includes('calm_front_exit'),
      trainingTip: CALM_ACTIVITIES[5].tip,
    },
    {
      id: 'calm_garden_exit',
      kind: 'stairs_exit',
      name: 'Secondary Garden EXIT',
      x: 455,
      y: 178,
      w: 70,
      h: 24,
      radius: 95,
      prompt: 'Press E · Open / Inspect Secondary EXIT',
      used: initialCompletedIds.includes('calm_garden_exit'),
      trainingTip: CALM_ACTIVITIES[6].tip,
    },
    {
      id: 'calm_ridge_shelter',
      kind: 'safe_zone',
      name: 'High-Ground Evacuation Gazebo',
      x: 1380,
      y: 480,
      w: 96,
      h: 96,
      radius: 130,
      prompt: 'Press E · Inspect Flood Evacuation Overlook',
      used: initialCompletedIds.includes('calm_ridge_shelter'),
      trainingTip: CALM_ACTIVITIES[7].tip,
    },
  ];

  return {
    worldWidth: 1680,
    worldHeight: 1060,
    elapsed: 0,
    player: {
      x: 345,
      y: 545,
      vx: 0,
      vy: 0,
      radius: 15,
      crouching: false,
      running: false,
      runBlend: 0,
      walkPhase: 0,
      inCoverId: null,
      facingX: 1,
      facingY: 0,
    },
    walls,
    interactives,
    completedIds: [...initialCompletedIds],
    doorOpenMap: {},
    breakerSwitchedOff: initialCompletedIds.includes('calm_breaker'),
    kitOpened: initialCompletedIds.includes('calm_kit_open'),
    nearestInteractive: null,
    activeLesson: null,
    lessonTimer: 0,
    locationLabel: 'Safe House · Living Area',
  };
}

export function stepCalmEngine(
  state: CalmEngineState,
  input: CalmInputState,
  dt: number
): void {
  const clampedDt = Math.min(0.05, Math.max(0.001, dt));
  state.elapsed += clampedDt;

  if (state.lessonTimer > 0) {
    state.lessonTimer = Math.max(0, state.lessonTimer - clampedDt);
  }

  const p = state.player;
  p.crouching = input.crouchHeld;

  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX;
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.joyY;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }

  // Moving releases Drop-and-Cover stance calmly
  if (p.inCoverId && mag > 0.25) {
    p.inCoverId = null;
  }

  const wantsSprint = input.sprintHeld && mag > 0.15 && !p.crouching && !p.inCoverId;
  p.running = wantsSprint;
  const targetBlend = wantsSprint ? 1 : 0;
  p.runBlend += (targetBlend - p.runBlend) * Math.min(1, clampedDt * 8);

  const baseSpeed = p.crouching ? 105 : 155 + p.runBlend * 75;
  const targetVx = p.inCoverId ? 0 : mx * baseSpeed;
  const targetVy = p.inCoverId ? 0 : my * baseSpeed;

  const accel = mag > 0.08 ? 14 : 11;
  p.vx += (targetVx - p.vx) * Math.min(1, clampedDt * accel);
  p.vy += (targetVy - p.vy) * Math.min(1, clampedDt * accel);

  const prevStepSin = Math.sin(p.walkPhase);
  const speedMag = Math.hypot(p.vx, p.vy);
  if (speedMag > 14 && !p.inCoverId) {
    p.walkPhase += clampedDt * (6.8 + (speedMag / 220) * 5.2);
    const currStepSin = Math.sin(p.walkPhase);
    if ((prevStepSin < 0 && currStepSin >= 0) || (prevStepSin > 0 && currStepSin <= 0)) {
      soundEngine.playFootstep('floor', p.runBlend > 0.55);
    }
  } else {
    p.walkPhase *= 0.9;
  }

  moveWithCollision(p, p.vx * clampedDt, p.vy * clampedDt, state.walls, state.worldWidth, state.worldHeight);
  state.locationLabel = resolveZoneLabel(p.x, p.y);

  // Nearest interactive detection
  let bestObj: InteractiveObject | null = null;
  let bestDist = Infinity;
  for (const obj of state.interactives) {
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d <= obj.radius && d < bestDist) {
      bestDist = d;
      bestObj = obj;
    }
  }
  state.nearestInteractive = bestObj;
}

export function triggerCalmInteraction(
  state: CalmEngineState,
  targetId?: string | null
): {
  kind: InteractiveObject['kind'] | null;
  newlyCompletedId: string | null;
} {
  const target =
    (targetId ? state.interactives.find((o) => o.id === targetId) : null) ||
    state.nearestInteractive;
  if (!target) return { kind: null, newlyCompletedId: null };

  const p = state.player;
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  if (Math.hypot(p.x - cx, p.y - cy) > target.radius + 55) {
    return { kind: null, newlyCompletedId: null };
  }

  if (target.id === 'calm_cover_table') {
    p.inCoverId = p.inCoverId ? null : target.id;
  } else if (target.id === 'calm_front_exit' || target.id === 'calm_garden_exit') {
    state.doorOpenMap[target.id] = !state.doorOpenMap[target.id];
    soundEngine.playDoorOpen();
  } else if (target.id === 'calm_breaker') {
    state.breakerSwitchedOff = true;
  } else if (target.id === 'calm_kit_open') {
    state.kitOpened = true;
  }

  soundEngine.playCalmChime();
  target.used = true;

  let newlyCompletedId: string | null = null;
  if (!state.completedIds.includes(target.id)) {
    state.completedIds.push(target.id);
    newlyCompletedId = target.id;
  }

  const def = CALM_ACTIVITIES.find((a) => a.id === target.id);
  if (def) {
    state.activeLesson = {
      id: def.id,
      title: def.title,
      category: def.category,
      tip: def.tip,
      items: def.items,
    };
    state.lessonTimer = 14;
  }

  return { kind: target.kind, newlyCompletedId };
}
