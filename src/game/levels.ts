import {
  DisasterId,
  FloatingDebris,
  HazardZone,
  InteractiveObject,
  MissionObjective,
  NPC,
  WallRect,
} from './types';

export interface LevelBlueprint {
  id: DisasterId;
  worldWidth: number;
  worldHeight: number;
  playerSpawn: { x: number; y: number };
  safeZone: { x: number; y: number; w: number; h: number; label: string };
  walls: WallRect[];
  interactives: InteractiveObject[];
  hazards: HazardZone[];
  floatingDebris: FloatingDebris[];
  npcs: NPC[];
  objectives: MissionObjective[];
  floorZones: { x: number; y: number; w: number; h: number; style: 'wood' | 'tile' | 'grass' | 'road' | 'carpet' | 'concrete' | 'highground' }[];
}

export function createLevelBlueprint(disaster: DisasterId): LevelBlueprint {
  if (disaster === 'earthquake') {
    return createEarthquakeLevel();
  }
  if (disaster === 'flood') {
    return createFloodLevel();
  }
  return createFireLevel();
}

function createEarthquakeLevel(): LevelBlueprint {
  const walls: WallRect[] = [
    // Outer Apartment Perimeter (120..1080 x 120..840)
    { x: 120, y: 120, w: 960, h: 24, kind: 'wall', blocksSight: true }, // North wall
    { x: 120, y: 816, w: 960, h: 24, kind: 'wall', blocksSight: true }, // South wall
    // West wall with 2 glass windows
    { x: 120, y: 144, w: 24, h: 96, kind: 'wall', blocksSight: true },
    { x: 120, y: 240, w: 24, h: 140, kind: 'window', label: 'Window' },
    { x: 120, y: 380, w: 24, h: 150, kind: 'wall', blocksSight: true },
    { x: 120, y: 530, w: 24, h: 130, kind: 'window', label: 'Window' },
    { x: 120, y: 660, w: 24, h: 156, kind: 'wall', blocksSight: true },
    // East wall with Front Exit Door opening at y: 560..660
    { x: 1056, y: 144, w: 24, h: 416, kind: 'wall', blocksSight: true },
    { x: 1056, y: 660, w: 24, h: 156, kind: 'wall', blocksSight: true },

    // Interior Room Dividers
    // Living Room / Kitchen divider (wide arch y: 320..480)
    { x: 560, y: 144, w: 20, h: 176, kind: 'wall', blocksSight: true },
    // Kitchen / Bathroom divider
    { x: 840, y: 144, w: 20, h: 190, kind: 'wall', blocksSight: true },
    { x: 840, y: 420, w: 70, h: 20, kind: 'wall', blocksSight: true },
    { x: 990, y: 420, w: 66, h: 20, kind: 'wall', blocksSight: true },
    // Living Room / Bedroom divider (doorway x: 430..560)
    { x: 144, y: 480, w: 286, h: 20, kind: 'wall', blocksSight: true },

    // Living Room Furniture
    { x: 185, y: 210, w: 54, h: 145, kind: 'furniture', color: '#475569', label: 'Sofa' },
    { x: 280, y: 245, w: 54, h: 90, kind: 'furniture', color: '#78350f', label: 'Coffee Table' },
    // Tall Bookshelf that topples south at t=9s
    {
      x: 380,
      y: 152,
      w: 130,
      h: 36,
      kind: 'furniture',
      color: '#92400e',
      label: 'Bookshelf',
      toppleAt: 9,
      toppledRect: { x: 380, y: 188, w: 130, h: 78 },
    },

    // Kitchen Counters & Appliances
    { x: 590, y: 150, w: 180, h: 42, kind: 'furniture', color: '#94a3b8', label: 'Kitchen Counter' },
    { x: 788, y: 150, w: 46, h: 52, kind: 'furniture', color: '#cbd5e1', label: 'Fridge' },

    // Bathroom Fixtures
    { x: 940, y: 152, w: 46, h: 42, kind: 'furniture', color: '#e2e8f0', label: 'Sink' },
    { x: 995, y: 240, w: 42, h: 48, kind: 'furniture', color: '#f1f5f9', label: 'Toilet' },

    // Bedroom Furniture
    { x: 168, y: 660, w: 130, h: 90, kind: 'furniture', color: '#334155', label: 'Bed' },
    // Wardrobe cupboard that topples east at t=12s
    {
      x: 150,
      y: 508,
      w: 44,
      h: 120,
      kind: 'furniture',
      color: '#7c2d12',
      label: 'Wardrobe',
      toppleAt: 12,
      toppledRect: { x: 194, y: 508, w: 80, h: 120 },
    },

    // Exterior Utility Pole (hazard obstacle outside)
    { x: 1210, y: 690, w: 30, h: 30, kind: 'pillar', color: '#64748b', label: 'Utility Pole' },
  ];

  const interactives: InteractiveObject[] = [
    {
      id: 'dining_table',
      kind: 'cover_table',
      name: 'Sturdy Oak Dining Table',
      x: 645,
      y: 295,
      w: 118,
      h: 74,
      radius: 75,
      prompt: 'Take Cover Under Table',
      secondaryPrompt: 'Leave Cover',
      used: false,
      trainingTip: 'Drop, Cover, and Hold On under a heavy table away from windows.',
    },
    {
      id: 'study_desk',
      kind: 'cover_table',
      name: 'Sturdy Wooden Study Desk',
      x: 325,
      y: 520,
      w: 108,
      h: 58,
      radius: 72,
      prompt: 'Take Cover Under Desk',
      secondaryPrompt: 'Leave Cover',
      used: false,
      trainingTip: 'A solid desk shields your head and neck from falling plaster and ceiling debris.',
    },
    {
      id: 'eq_kit',
      kind: 'emergency_kit',
      name: 'Emergency Go-Bag',
      x: 325,
      y: 735,
      w: 38,
      h: 34,
      radius: 64,
      prompt: 'Collect Emergency Kit',
      used: false,
      trainingTip: 'Grab your emergency kit once shaking stops—it holds water, flashlight, and first-aid.',
    },
    {
      id: 'gas_valve',
      kind: 'gas_valve',
      name: 'Kitchen Gas Shutoff Valve',
      x: 615,
      y: 198,
      w: 34,
      h: 26,
      radius: 64,
      prompt: 'Shut Off Gas Valve',
      used: false,
      trainingTip: 'Shutting off the gas stove valve prevents post-earthquake fires.',
    },
    {
      id: 'eq_exit_door',
      kind: 'exit_door',
      name: 'Apartment Exit Door',
      x: 1054,
      y: 560,
      w: 28,
      h: 100,
      radius: 74,
      prompt: 'Clear Debris & Open Exit',
      used: false,
      blocked: true,
      trainingTip: 'Wait until shaking stops! Running outside during shaking risks falling glass and wall debris.',
    },
  ];

  const hazards: HazardZone[] = [
    {
      id: 'west_window_1',
      kind: 'glass',
      x: 144,
      y: 235,
      w: 58,
      h: 150,
      active: false,
      damagePerSec: 18,
      intensity: 0.9,
      label: 'Shattering Window Glass',
    },
    {
      id: 'west_window_2',
      kind: 'glass',
      x: 144,
      y: 525,
      w: 58,
      h: 140,
      active: false,
      damagePerSec: 18,
      intensity: 0.9,
      label: 'Shattering Window Glass',
    },
    {
      id: 'hall_glass',
      kind: 'glass',
      x: 640,
      y: 720,
      w: 140,
      h: 80,
      active: false,
      damagePerSec: 12,
      slowFactor: 0.72,
      intensity: 0.7,
      label: 'Broken Glass Shards',
    },
    {
      id: 'exterior_pole_hazard',
      kind: 'electric_water',
      x: 1175,
      y: 655,
      w: 100,
      h: 100,
      active: true,
      damagePerSec: 20,
      intensity: 0.85,
      label: 'Fallen Power Line',
    },
  ];

  return {
    id: 'earthquake',
    worldWidth: 1520,
    worldHeight: 980,
    playerSpawn: { x: 350, y: 365 },
    safeZone: {
      x: 1245,
      y: 210,
      w: 195,
      h: 220,
      label: 'Safe Assembly Courtyard',
    },
    floorZones: [
      { x: 1080, y: 60, w: 420, h: 860, style: 'road' },
      { x: 1245, y: 210, w: 195, h: 220, style: 'grass' },
      { x: 144, y: 144, w: 416, h: 336, style: 'wood' },
      { x: 144, y: 500, w: 416, h: 316, style: 'wood' },
      { x: 580, y: 144, w: 260, h: 296, style: 'tile' },
      { x: 860, y: 144, w: 196, h: 276, style: 'tile' },
      { x: 560, y: 440, w: 496, h: 376, style: 'wood' },
    ],
    walls,
    interactives,
    hazards,
    floatingDebris: [],
    npcs: [],
    objectives: [
      { id: 'eq_cover', text: 'Drop, Cover & Hold On under a sturdy table', completed: false },
      { id: 'eq_wait', text: 'Stay under cover until main shaking stops', completed: false },
      { id: 'eq_kit', text: 'Collect Emergency Kit & check Gas Valve', completed: false, optional: true },
      { id: 'eq_evacuate', text: 'Clear exit door and reach Assembly Courtyard', completed: false },
    ],
  };
}

function createFloodLevel(): LevelBlueprint {
  const walls: WallRect[] = [
    // Starting House (Southwest: x 90..430, y 630..930)
    // Top wall with North Back Door at x: 240..330
    { x: 90, y: 630, w: 150, h: 22, kind: 'wall', blocksSight: true },
    { x: 330, y: 630, w: 100, h: 22, kind: 'wall', blocksSight: true },
    // Bottom wall
    { x: 90, y: 908, w: 340, h: 22, kind: 'wall', blocksSight: true },
    // Left wall
    { x: 90, y: 652, w: 22, h: 256, kind: 'wall', blocksSight: true },
    // Right wall with East Front Door at y: 740..830
    { x: 408, y: 652, w: 22, h: 88, kind: 'wall', blocksSight: true },
    { x: 408, y: 830, w: 22, h: 78, kind: 'wall', blocksSight: true },

    // House interior table
    { x: 155, y: 705, w: 74, h: 48, kind: 'furniture', color: '#78350f', label: 'Table' },
    { x: 150, y: 830, w: 68, h: 52, kind: 'furniture', color: '#334155', label: 'Storage' },

    // Neighbor Houses (scenery & collision obstacles)
    { x: 100, y: 120, w: 170, h: 130, kind: 'house', color: '#64748b', label: 'House 12' },
    { x: 100, y: 330, w: 170, h: 130, kind: 'house', color: '#475569', label: 'House 14' },
    { x: 730, y: 130, w: 180, h: 120, kind: 'house', color: '#64748b', label: 'House 20' },
    { x: 740, y: 810, w: 190, h: 130, kind: 'house', color: '#475569', label: 'House 24' },
    { x: 1060, y: 790, w: 190, h: 140, kind: 'house', color: '#64748b', label: 'House 28' },

    // Electric Poles
    { x: 670, y: 720, w: 28, h: 28, kind: 'pillar', color: '#475569', label: 'Electric Pole' },
    { x: 920, y: 520, w: 28, h: 28, kind: 'pillar', color: '#475569', label: 'Electric Pole' },

    // Creek Riverbank Guardrails (guide player toward wooden footbridge at y: 210..310 or east culvert)
    { x: 470, y: 80, w: 28, h: 125, kind: 'tree', color: '#14532d' },
    { x: 470, y: 325, w: 28, h: 250, kind: 'tree', color: '#14532d' },

    // Shelter walls (open entrance on west/south)
    { x: 1220, y: 110, w: 220, h: 20, kind: 'wall', blocksSight: true },
    { x: 1420, y: 130, w: 20, h: 170, kind: 'wall', blocksSight: true },
  ];

  const interactives: InteractiveObject[] = [
    {
      id: 'flood_radio',
      kind: 'radio',
      name: 'NOAA Weather Radio',
      x: 172,
      y: 710,
      w: 36,
      h: 28,
      radius: 68,
      prompt: 'Check Flood Alert Broadcast',
      used: false,
      trainingTip: 'Weather alerts tell you which roads are flooding and where the high-ground shelter is.',
    },
    {
      id: 'flood_phone',
      kind: 'phone',
      name: 'Emergency Phone Alert',
      x: 285,
      y: 785,
      w: 28,
      h: 28,
      radius: 62,
      prompt: 'Read Evacuation Alert',
      used: false,
      trainingTip: 'Official alerts direct evacuees to the North Footbridge and Ridge Shelter.',
    },
    {
      id: 'flood_kit',
      kind: 'emergency_kit',
      name: 'Waterproof Go-Bag',
      x: 168,
      y: 840,
      w: 38,
      h: 34,
      radius: 68,
      prompt: 'Collect Waterproof Kit',
      used: false,
      trainingTip: 'Grab clean water, flashlight, and meds before evacuating.',
    },
    {
      id: 'breaker_panel',
      kind: 'breaker_panel',
      name: 'Main Electrical Breaker',
      x: 372,
      y: 660,
      w: 28,
      h: 32,
      radius: 64,
      prompt: 'Shut Off Main Power',
      used: false,
      trainingTip: 'Turning off home power before floodwater enters prevents electrical shock.',
    },
    {
      id: 'house_north_door',
      kind: 'exit_door',
      name: 'North Side Door (High Path)',
      x: 240,
      y: 626,
      w: 90,
      h: 28,
      radius: 70,
      prompt: 'Open Side Door',
      used: false,
      trainingTip: 'Using the north side door connects directly to the elevated sidewalk away from creek surge.',
    },
    {
      id: 'house_east_door',
      kind: 'exit_door',
      name: 'Front Street Door',
      x: 404,
      y: 740,
      w: 28,
      h: 90,
      radius: 70,
      prompt: 'Open Front Door',
      used: false,
      trainingTip: 'Watch out: the front street dips directly into the rising creek floodzone!',
    },
    {
      id: 'parked_car_1',
      kind: 'parked_car',
      name: 'Parked Sedan',
      x: 560,
      y: 770,
      w: 92,
      h: 48,
      radius: 74,
      prompt: 'Inspect Vehicle',
      used: false,
      trainingTip: 'Turn Around, Don\'t Drown! Never try to drive through flooded roads.',
    },
  ];

  const hazards: HazardZone[] = [
    // Low-lying Central Creek Flood Basin (rises with waterLevel!)
    {
      id: 'creek_basin_south',
      kind: 'floodwater',
      x: 445,
      y: 440,
      w: 760,
      h: 520,
      active: true,
      damagePerSec: 6,
      slowFactor: 0.48,
      intensity: 0.2,
      label: 'Rising Creek Floodwater',
    },
    {
      id: 'creek_channel_north',
      kind: 'floodwater',
      x: 495,
      y: 80,
      w: 170,
      h: 370,
      active: true,
      damagePerSec: 8,
      slowFactor: 0.45,
      intensity: 0.5,
      label: 'Swollen Creek Channel (Avoid—Use Bridge)',
    },
    // Downed Power Line Pools
    {
      id: 'elec_pool_1',
      kind: 'electric_water',
      x: 615,
      y: 665,
      w: 135,
      h: 135,
      active: true,
      damagePerSec: 28,
      slowFactor: 0.48,
      intensity: 1,
      label: 'Energized Floodwater (Downed Pole)',
    },
    {
      id: 'elec_pool_2',
      kind: 'electric_water',
      x: 865,
      y: 465,
      w: 135,
      h: 135,
      active: true,
      damagePerSec: 28,
      slowFactor: 0.48,
      intensity: 1,
      label: 'Energized Floodwater (Downed Pole)',
    },
  ];

  const floatingDebris: FloatingDebris[] = [
    { id: 'deb_1', x: 640, y: 540, w: 54, h: 20, vx: -42, vy: 12, kind: 'plank' },
    { id: 'deb_2', x: 850, y: 690, w: 34, h: 34, vx: -36, vy: -8, kind: 'bin' },
    { id: 'deb_3', x: 560, y: 360, w: 48, h: 18, vx: 0, vy: 52, kind: 'branch' },
  ];

  const npcs: NPC[] = [
    {
      id: 'neighbor_1',
      x: 340,
      y: 420,
      vx: 0,
      vy: 0,
      targetX: 1280,
      targetY: 220,
      color: '#eab308',
      hairColor: '#1e293b',
      panicked: false,
      evacuated: false,
      speech: 'Take the north footbridge to the hill!',
      speechTimer: 6,
    },
  ];

  return {
    id: 'flood',
    worldWidth: 1560,
    worldHeight: 1020,
    playerSpawn: { x: 250, y: 785 },
    safeZone: {
      x: 1220,
      y: 130,
      w: 200,
      h: 170,
      label: 'High-Ground Emergency Shelter',
    },
    floorZones: [
      { x: 0, y: 0, w: 1560, h: 1020, style: 'grass' },
      // Elevated West Sidewalk (safe dry corridor)
      { x: 285, y: 210, w: 165, h: 420, style: 'concrete' },
      // North Ridge Road leading to Shelter
      { x: 285, y: 210, w: 940, h: 110, style: 'highground' },
      // High-Ground Shelter Terrace
      { x: 1020, y: 90, w: 460, h: 310, style: 'highground' },
      // Low-lying asphalt street (floods)
      { x: 430, y: 460, w: 800, h: 440, style: 'road' },
      // House interior floor
      { x: 112, y: 652, w: 296, h: 256, style: 'wood' },
    ],
    walls,
    interactives,
    hazards,
    floatingDebris,
    npcs,
    objectives: [
      { id: 'fl_alert', text: 'Check Weather Radio or Phone for evacuation route', completed: false },
      { id: 'fl_prep', text: 'Collect Waterproof Kit & shut off Main Breaker', completed: false, optional: true },
      { id: 'fl_avoid', text: 'Avoid floodwater & downed electrical lines', completed: false },
      { id: 'fl_shelter', text: 'Cross North Footbridge to High-Ground Shelter', completed: false },
    ],
  };
}

function createFireLevel(): LevelBlueprint {
  const walls: WallRect[] = [
    // Office Building Perimeter (100..1120 x 140..900)
    { x: 100, y: 140, w: 1020, h: 24, kind: 'wall', blocksSight: true }, // North
    { x: 100, y: 876, w: 1020, h: 24, kind: 'wall', blocksSight: true }, // South
    { x: 100, y: 164, w: 24, h: 712, kind: 'wall', blocksSight: true }, // West
    // East Perimeter with North-East Stairwell Exit (y: 205..300) and South-East Hot Door (y: 720..815)
    { x: 1096, y: 164, w: 24, h: 41, kind: 'wall', blocksSight: true },
    { x: 1096, y: 300, w: 24, h: 420, kind: 'wall', blocksSight: true },
    { x: 1096, y: 815, w: 24, h: 61, kind: 'wall', blocksSight: true },

    // Conference Room (North-West: 124..460, 164..520)
    // Right wall of Conference Room with 2 doors (y: 200..290 and y: 400..490)
    { x: 440, y: 164, w: 20, h: 40, kind: 'wall', blocksSight: true },
    { x: 440, y: 295, w: 20, h: 105, kind: 'wall', blocksSight: true },
    { x: 440, y: 495, w: 20, h: 25, kind: 'wall', blocksSight: true },
    // Bottom wall of Conference Room (doorway at x: 180..275)
    { x: 124, y: 500, w: 56, h: 20, kind: 'wall', blocksSight: true },
    { x: 275, y: 500, w: 185, h: 20, kind: 'wall', blocksSight: true },

    // South-West Break/Supply Room (124..440, 620..876)
    { x: 124, y: 620, w: 316, h: 20, kind: 'wall', blocksSight: true },
    // East wall of SW Room (doorway at y: 705..805)
    { x: 420, y: 640, w: 20, h: 65, kind: 'wall', blocksSight: true },
    { x: 420, y: 805, w: 20, h: 71, kind: 'wall', blocksSight: true },

    // North Corridor Partition (separates Cubicle Floor from North Exit Corridor)
    { x: 540, y: 325, w: 380, h: 20, kind: 'wall', blocksSight: true },

    // Conference Tables
    { x: 225, y: 220, w: 105, h: 52, kind: 'furniture', color: '#92400e', label: 'Conf Table' },
    { x: 225, y: 350, w: 105, h: 52, kind: 'furniture', color: '#92400e', label: 'Conf Table' },

    // Break Room furniture
    { x: 150, y: 655, w: 72, h: 40, kind: 'furniture', color: '#64748b', label: 'Copier' },
    { x: 145, y: 810, w: 96, h: 42, kind: 'furniture', color: '#78350f', label: 'Desk' },

    // Open Office Cubicle Desks (2x3 grid)
    { x: 575, y: 420, w: 80, h: 48, kind: 'furniture', color: '#92400e', label: 'Desk' },
    { x: 765, y: 420, w: 80, h: 48, kind: 'furniture', color: '#92400e', label: 'Desk' },
    { x: 575, y: 560, w: 80, h: 48, kind: 'furniture', color: '#92400e', label: 'Desk' },
    { x: 765, y: 560, w: 80, h: 48, kind: 'furniture', color: '#92400e', label: 'Desk' },

    // Exterior Parking Lot Vehicles (visual homage to office screenshot)
    { x: 1185, y: 420, w: 115, h: 56, kind: 'car', color: '#0284c7', label: 'Delivery Truck' },
    { x: 1185, y: 510, w: 105, h: 48, kind: 'car', color: '#e2e8f0', label: 'White Car' },
    { x: 1185, y: 590, w: 105, h: 48, kind: 'car', color: '#16a34a', label: 'Green Car' },
  ];

  const interactives: InteractiveObject[] = [
    {
      id: 'fire_kit',
      kind: 'emergency_kit',
      name: 'Smoke Hood & First-Aid Kit',
      x: 330,
      y: 660,
      w: 38,
      h: 34,
      radius: 65,
      prompt: 'Collect Emergency Smoke Kit',
      used: false,
      trainingTip: 'Emergency smoke kits protect your airway during low-crawl evacuation.',
    },
    {
      id: 'fire_alarm',
      kind: 'fire_alarm',
      name: 'Fire Alarm Pull Station',
      x: 472,
      y: 710,
      w: 28,
      h: 34,
      radius: 72,
      prompt: 'Pull Fire Alarm',
      used: false,
      trainingTip: 'Activate the fire alarm immediately so coworkers on the floor evacuate.',
    },
    {
      id: 'office_elevator',
      kind: 'elevator',
      name: 'Main Building Elevator',
      x: 745,
      y: 836,
      w: 110,
      h: 38,
      radius: 76,
      prompt: 'Inspect Elevator',
      used: false,
      trainingTip: 'NEVER use elevators during a fire! Power loss or shaft smoke can trap you.',
    },
    {
      id: 'east_hot_door',
      kind: 'check_door',
      name: 'East Exit Door (Check Heat)',
      x: 1094,
      y: 720,
      w: 28,
      h: 95,
      radius: 74,
      prompt: 'Feel Door for Heat',
      used: false,
      hot: true,
      blocked: true,
      trainingTip: 'Always check closed doors for heat with the back of your hand. Hot door = fire behind it!',
    },
    {
      id: 'fire_extinguisher',
      kind: 'fire_extinguisher',
      name: 'ABC Fire Extinguisher',
      x: 500,
      y: 255,
      w: 26,
      h: 34,
      radius: 68,
      prompt: 'Use Extinguisher on Small Bin Fire',
      used: false,
      trainingTip: 'Only use an extinguisher on a small, contained fire when you have a clear escape path behind you.',
    },
    {
      id: 'ne_stairs_exit',
      kind: 'stairs_exit',
      name: 'Emergency Fire Stairwell',
      x: 1094,
      y: 205,
      w: 28,
      h: 95,
      radius: 78,
      prompt: 'Exit via Fire Stairs',
      used: false,
      trainingTip: 'Fire-rated stairwells lead safely outside to the parking lot assembly point.',
    },
  ];

  const hazards: HazardZone[] = [
    // Major Central Office Blaze (grows over time!)
    {
      id: 'blaze_main_1',
      kind: 'fire',
      x: 700,
      y: 445,
      w: 175,
      h: 195,
      active: true,
      damagePerSec: 34,
      intensity: 1,
      spreadRate: 4.5,
      label: 'Spreading Office Blaze',
    },
    {
      id: 'blaze_east_door',
      kind: 'fire',
      x: 975,
      y: 675,
      w: 115,
      h: 145,
      active: true,
      damagePerSec: 32,
      intensity: 0.95,
      spreadRate: 2.5,
      label: 'Blocked East Fire',
    },
    // Small trash-bin fire in North Corridor (can be cleared with Extinguisher OR sidestepped carefully)
    {
      id: 'small_bin_fire',
      kind: 'fire',
      x: 645,
      y: 215,
      w: 62,
      h: 58,
      active: true,
      damagePerSec: 22,
      intensity: 0.75,
      label: 'Small Corridor Bin Fire',
    },
    // Smoke Plume Zones (Staying Low with Space reduces damage by 80%!)
    {
      id: 'smoke_north_hall',
      kind: 'smoke',
      x: 550,
      y: 168,
      w: 525,
      h: 155,
      active: true,
      damagePerSec: 12,
      slowFactor: 0.85,
      intensity: 0.7,
      label: 'Dense Smoke (Hold Space to Stay Low!)',
    },
    {
      id: 'smoke_central',
      kind: 'smoke',
      x: 470,
      y: 355,
      w: 560,
      h: 340,
      active: true,
      damagePerSec: 15,
      slowFactor: 0.8,
      intensity: 0.85,
      label: 'Toxic Smoke Cloud',
    },
  ];

  const npcs: NPC[] = [
    {
      id: 'coworker_1',
      x: 505,
      y: 615,
      vx: 0,
      vy: 0,
      targetX: 1320,
      targetY: 255,
      color: '#38bdf8',
      hairColor: '#f59e0b',
      panicked: true,
      evacuated: false,
      speech: 'East exit is blocked! Use North Stairs!',
      speechTimer: 5,
    },
    {
      id: 'coworker_2',
      x: 340,
      y: 280,
      vx: 0,
      vy: 0,
      targetX: 1340,
      targetY: 280,
      color: '#a78bfa',
      hairColor: '#0f172a',
      panicked: false,
      evacuated: false,
      speech: 'Stay low under the smoke!',
      speechTimer: 6,
    },
  ];

  return {
    id: 'fire',
    worldWidth: 1540,
    worldHeight: 1000,
    playerSpawn: { x: 230, y: 745 },
    safeZone: {
      x: 1255,
      y: 175,
      w: 205,
      h: 195,
      label: 'Outdoor Assembly Point',
    },
    floorZones: [
      { x: 1120, y: 80, w: 400, h: 860, style: 'road' },
      { x: 1255, y: 175, w: 205, h: 195, style: 'grass' },
      { x: 124, y: 164, w: 316, h: 336, style: 'wood' },
      { x: 124, y: 640, w: 296, h: 236, style: 'carpet' },
      { x: 440, y: 164, w: 656, h: 712, style: 'tile' },
    ],
    walls,
    interactives,
    hazards,
    floatingDebris: [],
    npcs,
    objectives: [
      { id: 'fi_alarm', text: 'Pull the Fire Alarm to alert the floor', completed: false },
      { id: 'fi_crouch', text: 'Stay low (Hold Space) when moving through smoke', completed: false },
      { id: 'fi_avoid_elev', text: 'Avoid elevators and find an unblocked fire stairwell', completed: false },
      { id: 'fi_escape', text: 'Exit via North-East Fire Stairs to Assembly Point', completed: false },
    ],
  };
}
