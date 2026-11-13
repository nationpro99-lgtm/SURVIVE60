import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameEngineState } from '../game/engine';
import { GameSettings, WallRect } from '../game/types';
import { createJaggedCrackGeo, createRoundedBoxGeo, GeoTracker } from './geometryHelpers';
import { createMaterialLibrary, disposeMaterialLibrary, MaterialLibrary } from './materials';
import {
  buildBathroomSink,
  buildBed,
  buildBookshelf,
  buildCeilingFan,
  buildCityBuilding,
  buildCopier,
  buildCurtains,
  buildDoorAssembly,
  buildDrainGrate,
  buildFireHydrant,
  buildFridge,
  buildHouse,
  buildInteractiveProp,
  buildKitchenCounter,
  buildNightstandWithLamp,
  buildNpcAvatar,
  buildOfficeDesk,
  buildPottedPlant,
  buildSofa,
  buildStreetLamp,
  buildTableWithChairs,
  buildToilet,
  buildTree,
  buildTVStand,
  buildUtilityPole,
  buildVehicle,
  buildWallArt,
  buildWallClock,
  buildWaterCooler,
  buildWhiteboard,
  tagRaycastProxy,
} from './models';

export const WORLD_SCALE = 0.025; // 40 blueprint px = 1 meter

const _dummyObj = new THREE.Object3D();

export interface World3DController {
  scene: THREE.Scene;
  mats: MaterialLibrary;
  raycastTargets: THREE.Object3D[];
  update: (dt: number, elapsed: number, state: GameEngineState, hoveredId: string | null) => void;
  setQuality: (quality: GameSettings['graphicsQuality'], isSoftwareGl: boolean) => void;
  dispose: () => void;
}

interface DoorEntry {
  id: string;
  hingePivot: THREE.Group;
  isHotDoor: boolean;
  openProgress: number;
}

interface ToppleEntry {
  wallRef: WallRect;
  pivot: THREE.Group;
  axis: 'x' | 'z';
  dir: number;
  progress: number;
}

interface ShakePropEntry {
  obj: THREE.Object3D;
  baseX: number;
  baseZ: number;
  baseRotY: number;
  phase: number;
}

interface FireCluster {
  hazardId: string;
  group: THREE.Group;
  flames: THREE.Mesh[];
  light?: THREE.PointLight;
  baseW: number;
  baseH: number;
}

interface SmokePlume {
  group: THREE.Group;
  puffs: { mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }[];
}

interface FallingPhysicsEntry {
  mesh: THREE.Object3D;
  y: number;
  vy: number;
  bounced: boolean;
  settled: boolean;
  spinX: number;
  spinZ: number;
}

interface FloatingMeshEntry {
  id: string;
  group: THREE.Group;
}

interface NpcAvatarEntry {
  id: string;
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  lastX: number;
  lastZ: number;
}

export function buildWorld3D(
  renderer: THREE.WebGLRenderer,
  initialState: GameEngineState,
  initialQuality: GameSettings['graphicsQuality'],
  isSoftwareGl: boolean
): World3DController {
  let quality = initialQuality;
  const scene = new THREE.Scene();
  const mats = createMaterialLibrary(renderer, isSoftwareGl, quality);
  const geos = new GeoTracker();
  const extraMats: THREE.Material[] = [];
  const raycastTargets: THREE.Object3D[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => geos.track(g);
  const trackMat = <T extends THREE.Material>(m: T): T => {
    extraMats.push(m);
    return m;
  };

  // --- ENVIRONMENT IBL & ATMOSPHERE ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = initialState.disaster === 'flood' ? 0.65 : 0.78;
  roomEnv.dispose();
  pmrem.dispose();

  const worldW = initialState.worldWidth * WORLD_SCALE;
  const worldD = initialState.worldHeight * WORLD_SCALE;

  const skyColor =
    initialState.disaster === 'earthquake'
      ? 0x1a202c
      : initialState.disaster === 'flood'
        ? 0x0b1729
        : 0x16100f;
  scene.background = new THREE.Color(skyColor);
  const baseFogDensity =
    initialState.disaster === 'earthquake'
      ? 0.015
      : initialState.disaster === 'flood'
        ? 0.021
        : 0.024;
  const fog = new THREE.FogExp2(skyColor, baseFogDensity);
  scene.fog = fog;

  // --- LIGHTING RIG ---
  const hemi = new THREE.HemisphereLight(
    initialState.disaster === 'flood' ? 0x93c5fd : 0xe2e8f0,
    initialState.disaster === 'fire' ? 0x2b150e : 0x1e293b,
    initialState.disaster === 'flood' ? 0.78 : 0.68
  );
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(
    initialState.disaster === 'earthquake'
      ? 0xffedd5
      : initialState.disaster === 'flood'
        ? 0xbae6fd
        : 0xffd7ba,
    initialState.disaster === 'flood' ? 0.88 : 1.12
  );
  sunLight.position.set(worldW * 0.65, 22, worldD * 0.72);
  sunLight.target.position.set(worldW * 0.5, 0, worldD * 0.5);
  scene.add(sunLight, sunLight.target);

  const shadowMapSize = quality === 'high' ? 2048 : 1024;
  sunLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 55;
  sunLight.shadow.camera.left = -26;
  sunLight.shadow.camera.right = 26;
  sunLight.shadow.camera.top = 22;
  sunLight.shadow.camera.bottom = -22;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  sunLight.castShadow = !isSoftwareGl && quality !== 'low';

  // --- OUTER SURROUNDING GROUND & DETAILED CITY SKYLINE ---
  const outerGround = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(175, 175)),
    initialState.disaster === 'fire' ? mats.roadFloor : mats.grassFloor
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.set(worldW / 2, -0.05, worldD / 2);
  outerGround.receiveShadow = true;
  scene.add(outerGround);

  const skylinePositions: [number, number, number, number, number][] = [
    [-13, -11, 10, 14, 12],
    [10, -14, 12, 18, 9],
    [28, -13, 11, 16, 10],
    [49, -10, 10, 15, 11],
    [53, 12, 11, 13, 12],
    [53, 28, 10, 17, 10],
    [-12, 14, 9, 12, 11],
    [-13, 30, 10, 14, 10],
    [14, 37, 14, 11, 9],
    [35, 37, 12, 15, 10],
  ];
  skylinePositions.forEach(([bx, bz, bw, bh, bd], idx) => {
    const bldg = buildCityBuilding(bw, bh, bd, mats, idx, geos);
    bldg.position.set(bx, -0.05, bz);
    scene.add(bldg);
  });

  // --- FLOOR ZONES ---
  const floorMatMap = {
    wood: mats.woodFloor,
    tile: mats.tileFloor,
    carpet: mats.carpetFloor,
    road: initialState.disaster === 'flood' ? mats.wetRoadFloor : mats.roadFloor,
    concrete: mats.concreteFloor,
    grass: mats.grassFloor,
    highground: mats.highgroundFloor,
  };

  initialState.floorZones.forEach((fz, idx) => {
    const w = fz.w * WORLD_SCALE;
    const d = fz.h * WORLD_SCALE;
    const cx = (fz.x + fz.w / 2) * WORLD_SCALE;
    const cz = (fz.y + fz.h / 2) * WORLD_SCALE;
    const isHigh = fz.style === 'highground' && initialState.disaster === 'flood';
    const thick = isHigh ? 0.28 : 0.04;
    const yPos = isHigh ? 0.14 : 0.002 * idx - 0.015;
    const slab = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, thick, d)),
      floorMatMap[fz.style] || mats.concreteFloor
    );
    slab.position.set(cx, yPos, cz);
    slab.receiveShadow = true;
    scene.add(slab);
  });

  // --- FLOOD NEIGHBORHOOD ARCHITECTURE (BRIDGE, CURBS, STREETLAMPS, HYDRANTS, DRAINS) ---
  const streetLampLights: THREE.PointLight[] = [];
  if (initialState.disaster === 'flood') {
    const bridgeGroup = new THREE.Group();
    const bx = 580 * WORLD_SCALE;
    const bz = 260 * WORLD_SCALE;
    const bridgeW = 5.4;
    const bridgeD = 2.75;
    // Individual rounded bridge planks instead of one flat block
    const plankCount = 16;
    const plankW = bridgeW / plankCount - 0.03;
    const plankGeo = trackGeo(createRoundedBoxGeo(plankW, 0.12, bridgeD, 0.02, 0.008));
    for (let i = 0; i < plankCount; i++) {
      const px = bx - bridgeW / 2 + (i + 0.5) * (bridgeW / plankCount);
      const archY = Math.sin(((i + 0.5) / plankCount) * Math.PI) * 0.1;
      const plank = new THREE.Mesh(plankGeo, mats.oakWood);
      plank.position.set(px, 0.34 + archY, bz);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }

    for (const rz of [-bridgeD / 2 + 0.1, bridgeD / 2 - 0.1]) {
      const rail = new THREE.Mesh(
        trackGeo(createRoundedBoxGeo(bridgeW, 0.08, 0.08, 0.02, 0.008)),
        mats.darkWood
      );
      rail.position.set(bx, 1.18, bz + rz);
      bridgeGroup.add(rail);
      for (const rx of [-2.3, -0.8, 0.8, 2.3]) {
        const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.88, 8)), mats.darkWood);
        post.position.set(bx + rx, 0.78, bz + rz);
        bridgeGroup.add(post);
      }
    }
    scene.add(bridgeGroup);

    // Concrete curb along West Sidewalk
    const curb = new THREE.Mesh(
      trackGeo(createRoundedBoxGeo(0.22, 0.18, 10.6, 0.03, 0.01)),
      mats.concreteFloor
    );
    curb.position.set(11.15, 0.09, 10.5);
    curb.receiveShadow = true;
    scene.add(curb);

    // Curved swan-neck streetlamps, fire hydrant & storm drains
    const lampSpots: [number, number, number, boolean][] = [
      [8.2, 13.8, 0, true],
      [18.5, 11.4, Math.PI, true],
      [27.5, 18.8, -Math.PI / 2, false],
      [27.2, 6.4, Math.PI / 2, false],
    ];
    for (const [lx, lz, rotY, addLight] of lampSpots) {
      const { group, light } = buildStreetLamp(mats, addLight, geos);
      group.position.set(lx, 0, lz);
      group.rotation.y = rotY;
      scene.add(group);
      if (light) streetLampLights.push(light);
    }

    const hydrant = buildFireHydrant(mats, geos);
    hydrant.position.set(10.8, 0.04, 14.5);
    scene.add(hydrant);

    const drainSpots: [number, number][] = [
      [11.8, 16.4],
      [20.2, 13.2],
      [25.6, 17.5],
    ];
    for (const [dx, dz] of drainSpots) {
      const drain = buildDrainGrate(mats, geos);
      drain.position.set(dx, 0.005, dz);
      scene.add(drain);
    }
  }

  // --- INDOOR CEILING, CEILING FANS, PIPES & SWAYING CEILING LAMPS ---
  const ceilingLights: { pivot: THREE.Group; light: THREE.PointLight; bulb: THREE.Mesh; baseIntensity: number }[] = [];
  let livingRoomFan: THREE.Group | null = null;
  if (initialState.disaster === 'earthquake' || initialState.disaster === 'fire') {
    const ceilX = initialState.disaster === 'earthquake' ? 600 * WORLD_SCALE : 610 * WORLD_SCALE;
    const ceilZ = initialState.disaster === 'earthquake' ? 480 * WORLD_SCALE : 520 * WORLD_SCALE;
    const ceilW = initialState.disaster === 'earthquake' ? 960 * WORLD_SCALE : 1020 * WORLD_SCALE;
    const ceilD = initialState.disaster === 'earthquake' ? 720 * WORLD_SCALE : 760 * WORLD_SCALE;

    const ceiling = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ceilW, 0.14, ceilD)), mats.ceiling);
    ceiling.position.set(ceilX, 3.17, ceilZ);
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    const lampCoords: [number, number][] =
      initialState.disaster === 'earthquake'
        ? [
            [330, 310],
            [720, 290],
            [320, 640],
            [820, 620],
          ]
        : [
            [280, 340],
            [280, 740],
            [680, 300],
            [840, 640],
          ];

    for (const [lx, lz] of lampCoords) {
      const pivot = new THREE.Group();
      pivot.position.set(lx * WORLD_SCALE, 3.1, lz * WORLD_SCALE);
      const canopy = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 0.06, 10)), mats.darkMetal);
      canopy.position.y = -0.02;
      const rod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8)), mats.darkMetal);
      rod.position.y = -0.225;
      const shadePts = [
        new THREE.Vector2(0.05, 0.14),
        new THREE.Vector2(0.18, 0.08),
        new THREE.Vector2(0.28, -0.02),
        new THREE.Vector2(0.26, -0.03),
        new THREE.Vector2(0.16, 0.06),
        new THREE.Vector2(0.04, 0.12),
      ];
      const shade = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(shadePts, 16)), mats.brushedMetal);
      shade.position.y = -0.45;
      const bulbMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfef3c7,
          emissive: 0xfde68a,
          emissiveIntensity: 1.5,
        })
      );
      const bulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.09, 10, 10)), bulbMat);
      bulb.position.y = -0.5;
      const ptLight = new THREE.PointLight(
        initialState.disaster === 'fire' ? 0xffd8a8 : 0xfef3c7,
        initialState.disaster === 'fire' ? 4.5 : 6.8,
        15
      );
      ptLight.position.y = -0.65;
      pivot.add(canopy, rod, shade, bulb, ptLight);
      scene.add(pivot);
      ceilingLights.push({ pivot, light: ptLight, bulb, baseIntensity: ptLight.intensity });
    }

    if (initialState.disaster === 'earthquake') {
      livingRoomFan = buildCeilingFan(mats, geos);
      livingRoomFan.position.set(9.2, 3.1, 7.6);
      scene.add(livingRoomFan);
    } else if (initialState.disaster === 'fire') {
      // Exposed overhead fire-sprinkler piping along North corridor & office bay
      const pipeMain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 18.5, 8)), mats.redPaint);
      pipeMain.rotation.z = Math.PI / 2;
      pipeMain.position.set(17.5, 2.98, 5.8);
      const pipeBranch = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 13.5, 8)), mats.redPaint);
      pipeBranch.rotation.x = Math.PI / 2;
      pipeBranch.position.set(18.5, 2.98, 12.6);
      scene.add(pipeMain, pipeBranch);
      for (const sx of [13.5, 18.5, 23.5]) {
        const head = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.05, 0.08, 8)), mats.brass);
        head.position.set(sx, 2.91, 5.8);
        scene.add(head);
      }
    }
  }

  // --- WALLS, SKIRTING BOARDS, CROWN MOLDING, WINDOWS, CURTAINS, HOUSES, CARS, FURNITURE ---
  const WALL_H = 3.1;
  const toppleEntries: ToppleEntry[] = [];
  const shakingProps: ShakePropEntry[] = [];
  const swayingTrees: { group: THREE.Group; phase: number }[] = [];
  const wallArtEntries: { group: THREE.Group; baseTilt: number; targetTilt: number }[] = [];
  const officeScorchMeshes: { mesh: THREE.Mesh; x: number; z: number; scorched: boolean }[] = [];
  const electricSparkPoles: THREE.Vector3[] = [];
  let houseStyleCounter = 0;

  for (const w of initialState.walls) {
    const mw = w.w * WORLD_SCALE;
    const md = w.h * WORLD_SCALE;
    const cx = (w.x + w.w / 2) * WORLD_SCALE;
    const cz = (w.y + w.h / 2) * WORLD_SCALE;

    if (w.kind === 'wall') {
      const isOuter =
        w.x <= 125 || w.y <= 145 || w.x + w.w >= 1050 || w.y + w.h >= 835;
      const mesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(mw, WALL_H, md)),
        isOuter ? mats.exteriorWall : mats.interiorWall
      );
      mesh.position.set(cx, WALL_H / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Real 3D architectural skirting board (baseboard) & crown trim
      if (initialState.disaster !== 'flood' || w.y > 500) {
        const skirt = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(mw + 0.04, 0.14, md + 0.04)),
          mats.skirtingWood
        );
        skirt.position.set(cx, 0.07, cz);
        skirt.receiveShadow = true;
        scene.add(skirt);

        const crown = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(mw + 0.05, 0.09, md + 0.05)),
          mats.skirtingWood
        );
        crown.position.set(cx, WALL_H - 0.045, cz);
        scene.add(crown);
      }

      // Wet watermark band near bottom of outdoor flooded brick walls
      if (initialState.disaster === 'flood' && w.y < 400) {
        const wetBand = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(mw + 0.03, 0.55, md + 0.03)),
          mats.wetBrickWall
        );
        wetBand.position.set(cx, 0.275, cz);
        scene.add(wetBand);
      }
    } else if (w.kind === 'window') {
      const sill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(mw, 0.9, md)), mats.exteriorWall);
      sill.position.set(cx, 0.45, cz);
      const sillLedge = new THREE.Mesh(
        trackGeo(createRoundedBoxGeo(mw + 0.12, 0.06, md + 0.12, 0.015, 0.008)),
        mats.skirtingWood
      );
      sillLedge.position.set(cx, 0.92, cz);
      const header = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(mw, 0.7, md)), mats.exteriorWall);
      header.position.set(cx, 2.75, cz);

      // Window frame jambs + center mullions + glass pane
      const glass = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(Math.max(0.08, mw * 0.28), 1.5, Math.max(0.08, md))),
        mats.windowGlass
      );
      glass.position.set(cx, 1.65, cz);
      const mullionV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(mw * 0.45, 1.5, 0.06)), mats.skirtingWood);
      mullionV.position.set(cx, 1.65, cz);
      const mullionH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(mw * 0.45, 0.06, md)), mats.skirtingWood);
      mullionH.position.set(cx, 1.65, cz);

      sill.castShadow = true;
      header.castShadow = true;
      scene.add(sill, sillLedge, header, glass, mullionV, mullionH);

      // Pleated curtains flanking the inside of apartment windows
      const curtains = buildCurtains(Math.max(mw, md), mats, geos);
      curtains.position.set(cx + 0.34, 1.5, cz);
      curtains.rotation.y = Math.PI / 2;
      scene.add(curtains);
    } else if (w.kind === 'house') {
      const house = buildHouse(mw, md, 3.2, mats, houseStyleCounter++, geos);
      house.position.set(cx, 0, cz);
      scene.add(house);
    } else if (w.kind === 'car') {
      const isTruck = (w.label || '').toLowerCase().includes('truck');
      const colorHex = w.color ? parseInt(w.color.replace('#', ''), 16) : 0x38bdf8;
      const car = buildVehicle(mw, md, colorHex, isTruck, mats, geos);
      car.position.set(cx, 0, cz);
      scene.add(car);
    } else if (w.kind === 'tree') {
      const count = Math.max(1, Math.round(Math.max(mw, md) / 1.9));
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : (i + 0.5) / count;
        const tx = w.w >= w.h ? (w.x + w.w * t) * WORLD_SCALE : cx;
        const tz = w.h > w.w ? (w.y + w.h * t) * WORLD_SCALE : cz;
        const tree = buildTree(4.3 + (i % 2) * 0.75, mats, i * 1.7 + tx, geos);
        tree.position.set(tx, 0, tz);
        scene.add(tree);
        swayingTrees.push({ group: tree, phase: i * 1.1 + tx * 0.3 });
      }
    } else if (w.kind === 'pillar') {
      const pole = buildUtilityPole(mats, geos);
      pole.position.set(cx, 0, cz);
      scene.add(pole);
      electricSparkPoles.push(new THREE.Vector3(cx, 0.35, cz));
    } else if (w.kind === 'furniture') {
      const label = (w.label || '').toLowerCase();
      let builtObj: THREE.Object3D | null = null;
      if (label.includes('sofa')) {
        builtObj = buildSofa(mw, md, mats, geos);
        builtObj.position.set(cx, 0, cz);
      } else if (label.includes('bed')) {
        builtObj = buildBed(mw, md, mats, geos);
        builtObj.position.set(cx, 0, cz);
      } else if (label.includes('kitchen counter')) {
        builtObj = buildKitchenCounter(mw, md, mats, geos);
        builtObj.position.set(cx, 0, cz);
      } else if (label.includes('fridge')) {
        builtObj = buildFridge(mw, md, mats, geos);
        builtObj.position.set(cx, 0, cz);
      } else if (label.includes('sink')) {
        builtObj = buildBathroomSink(mats, geos);
        builtObj.position.set(cx, 0, cz);
      } else if (label.includes('toilet')) {
        builtObj = buildToilet(mats, geos);
        builtObj.position.set(cx, 0, cz);
        builtObj.rotation.y = -Math.PI / 2;
      } else if (label.includes('copier')) {
        builtObj = buildCopier(mw, md, mats, geos);
        builtObj.position.set(cx, 0, cz);
      } else if (label.includes('bookshelf') || label.includes('wardrobe')) {
        const isWardrobe = label.includes('wardrobe');
        const h = isWardrobe ? 2.15 : 2.1;
        const shelf = buildBookshelf(mw, md, h, mats, geos);
        const pivot = new THREE.Group();
        if (isWardrobe) {
          pivot.position.set(cx + mw / 2, 0, cz);
          shelf.position.set(-mw / 2, 0, 0);
          toppleEntries.push({ wallRef: w, pivot, axis: 'z', dir: -1, progress: 0 });
        } else {
          pivot.position.set(cx, 0, cz + md / 2);
          shelf.position.set(0, 0, -md / 2);
          toppleEntries.push({ wallRef: w, pivot, axis: 'x', dir: 1, progress: 0 });
        }
        pivot.add(shelf);
        scene.add(pivot);
        shakingProps.push({
          obj: pivot,
          baseX: pivot.position.x,
          baseZ: pivot.position.z,
          baseRotY: 0,
          phase: cx + cz,
        });
      } else if (label.includes('desk') || label.includes('conf')) {
        builtObj = buildOfficeDesk(mw, md, mats, geos);
        builtObj.position.set(cx, 0, cz);
        if (initialState.disaster === 'fire') {
          const topMesh = builtObj.children[0] as THREE.Mesh;
          if (topMesh) officeScorchMeshes.push({ mesh: topMesh, x: cx, z: cz, scorched: false });
        }
      } else if (label.includes('table')) {
        builtObj = buildTableWithChairs(mw, md, 0.56, mats, false, geos);
        builtObj.position.set(cx, 0, cz);
      } else {
        builtObj = new THREE.Mesh(
          trackGeo(createRoundedBoxGeo(mw, 0.9, md, 0.04, 0.015)),
          mats.darkWood
        );
        builtObj.position.set(cx, 0.45, cz);
        builtObj.castShadow = true;
        builtObj.receiveShadow = true;
      }

      if (builtObj) {
        scene.add(builtObj);
        if (initialState.disaster === 'earthquake') {
          shakingProps.push({
            obj: builtObj,
            baseX: builtObj.position.x,
            baseZ: builtObj.position.z,
            baseRotY: builtObj.rotation.y,
            phase: cx * 0.7 + cz * 0.5,
          });
        }
      }
    }
  }

  // --- LIVED-IN INTERIOR DETAILS (RUGS, TV STAND, NIGHTSTAND/LAMP, CLOCK, WALL ART, SWITCHES, PLANTS) ---
  if (initialState.disaster === 'earthquake') {
    // Area rugs in Living Room & Bedroom
    const livingRug = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 0.014, 4.1)), mats.rugFabric);
    livingRug.position.set(6.8, 0.008, 7.2);
    livingRug.receiveShadow = true;
    const bedroomRug = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 0.014, 2.8)), mats.rugFabric);
    bedroomRug.position.set(6.6, 0.008, 17.6);
    bedroomRug.receiveShadow = true;
    scene.add(livingRug, bedroomRug);

    // Living Room TV console + flatscreen facing Sofa
    const tvStand = buildTVStand(mats, geos);
    tvStand.position.set(13.5, 0, 6.9);
    tvStand.rotation.y = Math.PI;
    scene.add(tvStand);
    shakingProps.push({ obj: tvStand, baseX: 13.5, baseZ: 6.9, baseRotY: Math.PI, phase: 2.1 });

    // Bedroom nightstand with ceramic table lamp beside bed
    const nightstand = buildNightstandWithLamp(mats, geos);
    nightstand.position.set(4.5, 0, 15.6);
    scene.add(nightstand);
    shakingProps.push({ obj: nightstand, baseX: 4.5, baseZ: 15.6, baseRotY: 0, phase: 4.4 });

    // Wall clock & light switch plate
    const clock = buildWallClock(mats, geos);
    clock.position.set(17.5, 2.1, 3.65);
    scene.add(clock);

    const switchPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.13, 0.02)), mats.porcelain);
    switchPlate.position.set(25.9, 1.32, 13.5);
    switchPlate.rotation.y = -Math.PI / 2;
    scene.add(switchPlate);

    const artSpots: [number, number, number, number][] = [
      [11.2, 3.85, 1.35, 0],
      [7.4, 12.6, 1.15, Math.PI],
      [25.8, 10.5, 1.25, -Math.PI / 2],
    ];
    for (const [ax, az, aw, ry] of artSpots) {
      const art = buildWallArt(aw, 0.85, mats, geos);
      art.position.set(ax, 2.05, az);
      art.rotation.y = ry;
      scene.add(art);
      wallArtEntries.push({
        group: art,
        baseTilt: 0,
        targetTilt: (Math.random() > 0.5 ? 1 : -1) * (0.22 + Math.random() * 0.18),
      });
    }
    const plants: [number, number][] = [
      [4.2, 4.4],
      [12.8, 11.4],
      [24.6, 18.8],
    ];
    for (const [px, pz] of plants) {
      const plant = buildPottedPlant(mats, geos);
      plant.position.set(px, 0, pz);
      scene.add(plant);
      shakingProps.push({ obj: plant, baseX: px, baseZ: pz, baseRotY: 0, phase: px + pz });
    }
  } else if (initialState.disaster === 'fire') {
    const cooler = buildWaterCooler(mats, geos);
    cooler.position.set(11.6, 0, 16.5);
    scene.add(cooler);

    // Conference Room Evacuation Plan Whiteboard
    const whiteboard = buildWhiteboard(2.2, 1.15, mats, geos);
    whiteboard.position.set(7.2, 1.65, 4.16);
    scene.add(whiteboard);

    for (const [px, pz] of [
      [12.4, 6.2],
      [12.4, 14.2],
      [25.5, 15.2],
    ]) {
      const plant = buildPottedPlant(mats, geos);
      plant.position.set(px, 0, pz);
      scene.add(plant);
    }
  }

  // --- SAFE ZONE BEACON PAD ---
  const sz = initialState.safeZone;
  const szW = sz.w * WORLD_SCALE;
  const szD = sz.h * WORLD_SCALE;
  const szX = (sz.x + sz.w / 2) * WORLD_SCALE;
  const szZ = (sz.y + sz.h / 2) * WORLD_SCALE;
  const szBaseY = initialState.disaster === 'flood' ? 0.29 : 0.02;

  const safePadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x059669,
      emissive: 0x10b981,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.45,
      roughness: 0.4,
    })
  );
  const safePad = new THREE.Mesh(
    trackGeo(createRoundedBoxGeo(szW, 0.04, szD, 0.12, 0.01)),
    safePadMat
  );
  safePad.position.set(szX, szBaseY, szZ);
  scene.add(safePad);

  for (const [ox, oz] of [
    [-szW / 2 + 0.18, -szD / 2 + 0.18],
    [szW / 2 - 0.18, -szD / 2 + 0.18],
    [-szW / 2 + 0.18, szD / 2 - 0.18],
    [szW / 2 - 0.18, szD / 2 - 0.18],
  ]) {
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.09, 1.4, 10)), mats.darkMetal);
    post.position.set(szX + ox, szBaseY + 0.7, szZ + oz);
    const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.12, 12, 10)), mats.emeraldGlow);
    cap.position.set(szX + ox, szBaseY + 1.45, szZ + oz);
    scene.add(post, cap);
  }
  const safeLight = new THREE.PointLight(0x10b981, 4.8, 13);
  safeLight.position.set(szX, szBaseY + 2.4, szZ);
  scene.add(safeLight);

  // --- INTERACTIVE OBJECTS & RAYCAST PROXIES ---
  const doorEntries: DoorEntry[] = [];
  const interactiveMap = new Map<string, { group: THREE.Group; highlightMeshes: THREE.Mesh[]; kind: string }>();

  for (const obj of initialState.interactives) {
    const mw = obj.w * WORLD_SCALE;
    const md = obj.h * WORLD_SCALE;
    const cx = (obj.x + obj.w / 2) * WORLD_SCALE;
    const cz = (obj.y + obj.h / 2) * WORLD_SCALE;

    if (obj.kind === 'cover_table') {
      const tbl = buildTableWithChairs(mw, md, 0.88, mats, true, geos);
      tbl.position.set(cx, 0, cz);
      const topMesh = tbl.children[0] as THREE.Mesh;
      const proxy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(mw + 0.35, 1.15, md + 0.35)),
        trackMat(new THREE.MeshBasicMaterial({ visible: false }))
      );
      proxy.position.set(cx, 0.58, cz);
      tagRaycastProxy(proxy, obj.id, [topMesh]);
      scene.add(tbl, proxy);
      raycastTargets.push(proxy);
      interactiveMap.set(obj.id, { group: tbl, highlightMeshes: [topMesh], kind: obj.kind });
      if (initialState.disaster === 'earthquake') {
        shakingProps.push({ obj: tbl, baseX: cx, baseZ: cz, baseRotY: 0, phase: cx + cz });
      }
    } else if (obj.kind === 'exit_door' || obj.kind === 'stairs_exit' || obj.kind === 'check_door') {
      const isExitSign =
        obj.kind === 'stairs_exit' || obj.id === 'eq_exit_door' || obj.id === 'house_north_door';
      const isHotDoor = Boolean(obj.hot);
      const { group, hingePivot, proxy, highlightMeshes } = buildDoorAssembly(
        obj,
        mw,
        md,
        isExitSign,
        isHotDoor,
        mats,
        geos
      );
      group.position.set(cx, 0, cz);
      scene.add(group);
      raycastTargets.push(proxy);
      doorEntries.push({ id: obj.id, hingePivot, isHotDoor, openProgress: 0 });
      interactiveMap.set(obj.id, { group, highlightMeshes, kind: obj.kind });
    } else if (obj.kind === 'parked_car') {
      const car = buildVehicle(mw, md, 0x94a3b8, false, mats, geos);
      car.position.set(cx, 0, cz);
      const chassis = car.children[0] as THREE.Mesh;
      const proxy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(mw + 0.3, 1.6, md + 0.3)),
        trackMat(new THREE.MeshBasicMaterial({ visible: false }))
      );
      proxy.position.set(cx, 0.8, cz);
      tagRaycastProxy(proxy, obj.id, [chassis]);
      scene.add(car, proxy);
      raycastTargets.push(proxy);
      interactiveMap.set(obj.id, { group: car, highlightMeshes: [chassis], kind: obj.kind });
    } else {
      const { group, highlightMeshes } = buildInteractiveProp(obj, mats, geos);
      group.position.set(cx, 0, cz);
      scene.add(group);
      group.traverse((c) => {
        if (c.userData.interactiveId) {
          raycastTargets.push(c);
        }
      });
      interactiveMap.set(obj.id, { group, highlightMeshes, kind: obj.kind });
    }
  }

  // --- DISASTER-SPECIFIC DYNAMIC SYSTEMS ---
  // 1. Earthquake Jagged Cracks, Glass Shards, Modeled Falling Debris, Dust Particles
  const glassClusters = new Map<string, THREE.Group>();
  const fallingMeshes = new Map<string, FallingPhysicsEntry>();
  const crackGroup = new THREE.Group();
  let eqDustPoints: THREE.Points | null = null;
  let eqDustVel: Float32Array | null = null;

  if (initialState.disaster === 'earthquake') {
    scene.add(crackGroup);
    const crackMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const crackSpots: [number, number, number, number][] = [
      [8.5, 6.2, 2.2, 0.3],
      [14.2, 11.4, 2.5, -0.5],
      [21.0, 9.5, 1.9, 0.8],
      [7.2, 15.8, 2.3, -0.2],
      [18.6, 15.4, 2.6, 0.4],
    ];
    for (const [x, z, len, rot] of crackSpots) {
      const strip = new THREE.Mesh(trackGeo(createJaggedCrackGeo(len, 0.085)), crackMat);
      strip.rotation.y = rot;
      strip.position.set(x, 0.015, z);
      crackGroup.add(strip);
    }
    crackGroup.visible = false;

    for (const h of initialState.hazards) {
      if (h.kind === 'glass') {
        const gg = new THREE.Group();
        const shardMat = trackMat(
          new THREE.MeshPhysicalMaterial({
            color: 0xe0f2fe,
            roughness: 0.06,
            metalness: 0.15,
            transparent: true,
            opacity: 0.82,
          })
        );
        for (let i = 0; i < 18; i++) {
          const shard = new THREE.Mesh(trackGeo(new THREE.TetrahedronGeometry(0.11, 0)), shardMat);
          shard.scale.set(1.2, 0.25, 0.85);
          shard.position.set(
            (h.x + Math.random() * h.w) * WORLD_SCALE,
            0.025,
            (h.y + Math.random() * h.h) * WORLD_SCALE
          );
          shard.rotation.y = Math.random() * Math.PI * 2;
          gg.add(shard);
        }
        gg.visible = false;
        scene.add(gg);
        glassClusters.set(h.id, gg);
      }
    }

    const dustCount = quality === 'low' ? 90 : quality === 'medium' ? 180 : 320;
    const dustPos = new Float32Array(dustCount * 3);
    eqDustVel = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = 3.8 + Math.random() * 22.5;
      dustPos[i * 3 + 1] = 0.2 + Math.random() * 2.85;
      dustPos[i * 3 + 2] = 3.8 + Math.random() * 16.5;
      eqDustVel[i] = 0.35 + Math.random() * 0.65;
    }
    const dustGeo = trackGeo(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = trackMat(
      new THREE.PointsMaterial({
        color: 0xd6d3d1,
        size: 0.075,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    eqDustPoints = new THREE.Points(dustGeo, dustMat);
    eqDustPoints.frustumCulled = false;
    scene.add(eqDustPoints);
  }

  // 2. Flood Water Plane, Rain Streaks, Water Splashes, Varied Floating Debris, Electric Arcs
  let floodWaterMesh: THREE.Mesh | null = null;
  let floodWaterBasePositions: Float32Array | null = null;
  let rainLines: THREE.LineSegments | null = null;
  let splashInstanced: THREE.InstancedMesh | null = null;
  const splashData: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }[] = [];
  const floatingEntries: FloatingMeshEntry[] = [];
  const sparkLights: THREE.PointLight[] = [];

  if (initialState.disaster === 'flood') {
    const waterGeo = trackGeo(new THREE.PlaneGeometry(36, 26, 32, 24));
    waterGeo.rotateX(-Math.PI / 2);
    floodWaterBasePositions = new Float32Array(waterGeo.attributes.position.array);
    floodWaterMesh = new THREE.Mesh(waterGeo, mats.waterSurface);
    floodWaterMesh.position.set(19, 0.08, 15);
    floodWaterMesh.receiveShadow = true;
    scene.add(floodWaterMesh);

    const rainCount = quality === 'low' ? 160 : quality === 'medium' ? 320 : 500;
    const rainPositions = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 28;
      const ry = Math.random() * 10;
      const rz = (Math.random() - 0.5) * 28;
      rainPositions[i * 6] = rx;
      rainPositions[i * 6 + 1] = ry;
      rainPositions[i * 6 + 2] = rz;
      rainPositions[i * 6 + 3] = rx - 0.15;
      rainPositions[i * 6 + 4] = ry - 0.78;
      rainPositions[i * 6 + 5] = rz + 0.06;
    }
    const rainGeo = trackGeo(new THREE.BufferGeometry());
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = trackMat(
      new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.48 })
    );
    rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    scene.add(rainLines);

    const splashCount = quality === 'low' ? 24 : 48;
    const splashGeo = trackGeo(new THREE.SphereGeometry(0.055, 5, 5));
    const splashMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.75 })
    );
    splashInstanced = new THREE.InstancedMesh(splashGeo, splashMat, splashCount);
    splashInstanced.frustumCulled = false;
    for (let i = 0; i < splashCount; i++) {
      splashData.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
      _dummyObj.position.set(0, -10, 0);
      _dummyObj.scale.setScalar(0.01);
      _dummyObj.updateMatrix();
      splashInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    scene.add(splashInstanced);

    // Varied natural floating debris (curved tree log, rounded plastic cooler/bin, wooden pallet planks)
    for (const deb of initialState.floatingDebris) {
      const dg = new THREE.Group();
      const dw = deb.w * WORLD_SCALE;
      const dd = deb.h * WORLD_SCALE;
      if (deb.kind === 'branch') {
        const logCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-dw / 2, 0, 0),
          new THREE.Vector3(0, 0.04, 0.08),
          new THREE.Vector3(dw / 2, 0, -0.04),
        ]);
        const log = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(logCurve, 8, 0.11, 7, false)), mats.bark);
        dg.add(log);
      } else if (deb.kind === 'bin') {
        const bin = new THREE.Mesh(trackGeo(createRoundedBoxGeo(dw, 0.36, dd, 0.06, 0.02)), mats.skyGlow);
        const lid = new THREE.Mesh(
          trackGeo(createRoundedBoxGeo(dw + 0.04, 0.06, dd + 0.04, 0.05, 0.015)),
          mats.porcelain
        );
        lid.position.y = 0.2;
        dg.add(bin, lid);
      } else {
        for (const pz of [-dd * 0.28, 0, dd * 0.28]) {
          const plank = new THREE.Mesh(
            trackGeo(createRoundedBoxGeo(dw, 0.06, dd * 0.22, 0.015, 0.006)),
            mats.oakWood
          );
          plank.position.z = pz;
          dg.add(plank);
        }
      }
      dg.position.set((deb.x + deb.w / 2) * WORLD_SCALE, 0.18, (deb.y + deb.h / 2) * WORLD_SCALE);
      scene.add(dg);
      floatingEntries.push({ id: deb.id, group: dg });
    }

    for (const pos of electricSparkPoles) {
      const spLight = new THREE.PointLight(0x38bdf8, 5, 9);
      spLight.position.copy(pos);
      scene.add(spLight);
      sparkLights.push(spLight);
    }
  }

  // 3. Textured Crossed Flame Tongues, Feathered Smoke Plumes, Embers, Alarm Beacon
  const fireClusters: FireCluster[] = [];
  const smokePlumes: SmokePlume[] = [];
  let alarmBeaconLight: THREE.PointLight | null = null;
  let emberPoints: THREE.Points | null = null;
  let emberSpeeds: Float32Array | null = null;

  if (initialState.disaster === 'fire') {
    const flamePlaneGeo = trackGeo(new THREE.PlaneGeometry(0.95, 1.85));
    const emberBedMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1c1512,
        emissive: 0xea580c,
        emissiveIntensity: 1.2,
        roughness: 0.9,
      })
    );
    const smokePlaneGeo = trackGeo(new THREE.PlaneGeometry(2.8, 2.8));

    let fireLightCount = 0;
    for (const h of initialState.hazards) {
      if (h.kind === 'fire') {
        const fg = new THREE.Group();
        const fw = h.w * WORLD_SCALE;
        const fd = h.h * WORLD_SCALE;
        const fx = (h.x + h.w / 2) * WORLD_SCALE;
        const fz = (h.y + h.h / 2) * WORLD_SCALE;
        fg.position.set(fx, 0, fz);

        // Glowing charred ember mound at base
        const bed = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(fw * 0.34, fw * 0.42, 0.14, 10)), emberBedMat);
        bed.position.y = 0.06;
        fg.add(bed);

        const flames: THREE.Mesh[] = [];
        const numTongues = h.id === 'small_bin_fire' ? 5 : 10;
        for (let i = 0; i < numTongues; i++) {
          const px = ((i % 4) / 3 - 0.5) * fw * 0.62;
          const pz = (Math.floor(i / 4) / 2 - 0.4) * fd * 0.62;
          const sheetA = new THREE.Mesh(flamePlaneGeo, mats.flameSheetMat);
          sheetA.position.set(px, 0.92, pz);
          sheetA.rotation.y = (i * 0.68) % Math.PI;
          const sheetB = new THREE.Mesh(flamePlaneGeo, mats.flameSheetMat);
          sheetB.position.set(px, 0.92, pz);
          sheetB.rotation.y = sheetA.rotation.y + Math.PI / 2;
          fg.add(sheetA, sheetB);
          flames.push(sheetA, sheetB);
        }

        let fireLight: THREE.PointLight | undefined;
        if (fireLightCount < 2) {
          fireLight = new THREE.PointLight(0xf97316, 8.5, 17);
          fireLight.position.set(0, 1.5, 0);
          fg.add(fireLight);
          fireLightCount++;
        }

        scene.add(fg);
        fireClusters.push({
          hazardId: h.id,
          group: fg,
          flames,
          light: fireLight,
          baseW: h.w,
          baseH: h.h,
        });
      } else if (h.kind === 'smoke') {
        const sg = new THREE.Group();
        const sw = h.w * WORLD_SCALE;
        const sd = h.h * WORLD_SCALE;
        const sx = (h.x + h.w / 2) * WORLD_SCALE;
        const sz = (h.y + h.h / 2) * WORLD_SCALE;
        const puffs: SmokePlume['puffs'] = [];
        const puffCount = quality === 'low' ? 14 : quality === 'medium' ? 22 : 30;

        for (let i = 0; i < puffCount; i++) {
          const px = sx + (Math.random() - 0.5) * sw * 0.9;
          const pz = sz + (Math.random() - 0.5) * sd * 0.9;
          const py = 1.78 + Math.random() * 0.9;
          const mesh = new THREE.Mesh(smokePlaneGeo, mats.smokePuffMat);
          mesh.position.set(px, py, pz);
          mesh.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.45;
          mesh.rotation.z = Math.random() * Math.PI * 2;
          mesh.scale.setScalar(0.85 + Math.random() * 0.75);
          sg.add(mesh);
          puffs.push({ mesh, baseX: px, baseY: py, baseZ: pz, phase: Math.random() * Math.PI * 2 });
        }
        scene.add(sg);
        smokePlumes.push({ group: sg, puffs });
      }
    }

    const emberCount = quality === 'low' ? 80 : quality === 'medium' ? 160 : 260;
    const emberPos = new Float32Array(emberCount * 3);
    emberSpeeds = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3] = 14 + Math.random() * 13;
      emberPos[i * 3 + 1] = Math.random() * 2.9;
      emberPos[i * 3 + 2] = 5 + Math.random() * 15;
      emberSpeeds[i] = 0.7 + Math.random() * 1.1;
    }
    const emberGeo = trackGeo(new THREE.BufferGeometry());
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = trackMat(
      new THREE.PointsMaterial({
        color: 0xfb923c,
        size: 0.085,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      })
    );
    emberPoints = new THREE.Points(emberGeo, emberMat);
    emberPoints.frustumCulled = false;
    scene.add(emberPoints);

    const alarmObj = initialState.interactives.find((o) => o.kind === 'fire_alarm');
    if (alarmObj) {
      alarmBeaconLight = new THREE.PointLight(0xef4444, 0, 15);
      alarmBeaconLight.position.set(
        (alarmObj.x + alarmObj.w / 2) * WORLD_SCALE,
        2.35,
        (alarmObj.y + alarmObj.h / 2) * WORLD_SCALE
      );
      scene.add(alarmBeaconLight);
    }
  }

  // --- NPC 3D AVATARS (SMOOTH HUMAN SILHOUETTES) ---
  const npcEntries: NpcAvatarEntry[] = [];
  for (const npc of initialState.npcs) {
    const shirtHex = parseInt(npc.color.replace('#', ''), 16);
    const hairHex = parseInt((npc.hairColor || '#1e293b').replace('#', ''), 16);
    const { group: ng, legL, legR } = buildNpcAvatar(shirtHex, hairHex, mats, geos);
    const nx = npc.x * WORLD_SCALE;
    const nz = npc.y * WORLD_SCALE;
    ng.position.set(nx, 0, nz);
    scene.add(ng);
    npcEntries.push({ id: npc.id, group: ng, legL, legR, lastX: nx, lastZ: nz });
  }

  let prevHoveredId: string | null = null;
  const savedEmissives = new Map<THREE.Mesh, { hex: number; intensity: number }>();

  const setQuality = (nextQuality: GameSettings['graphicsQuality'], softwareGl: boolean) => {
    quality = nextQuality;
    sunLight.castShadow = !softwareGl && nextQuality !== 'low';
    const nextSize = nextQuality === 'high' ? 2048 : 1024;
    if (sunLight.shadow.mapSize.x !== nextSize) {
      sunLight.shadow.mapSize.set(nextSize, nextSize);
      if (sunLight.shadow.map) {
        sunLight.shadow.map.dispose();
        sunLight.shadow.map = null;
      }
    }
  };

  let splashSpawnIdx = 0;

  const update = (dt: number, elapsed: number, state: GameEngineState, hoveredId: string | null) => {
    // 1. Highlight hovered / nearest interactive
    const targetId = hoveredId || state.nearestInteractive?.id || null;
    if (targetId !== prevHoveredId) {
      if (prevHoveredId) {
        const prevEntry = interactiveMap.get(prevHoveredId);
        prevEntry?.highlightMeshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          const saved = savedEmissives.get(m);
          if (saved && mat && 'emissive' in mat) {
            mat.emissive.setHex(saved.hex);
            mat.emissiveIntensity = saved.intensity;
          }
        });
      }
      if (targetId) {
        const entry = interactiveMap.get(targetId);
        entry?.highlightMeshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat && 'emissive' in mat) {
            if (!savedEmissives.has(m)) {
              savedEmissives.set(m, {
                hex: mat.emissive.getHex(),
                intensity: mat.emissiveIntensity ?? 1,
              });
            }
            mat.emissive.setHex(0xfbbf24);
            mat.emissiveIntensity = 0.85;
          }
        });
      }
      prevHoveredId = targetId;
    }

    // 2. Doors swinging smoothly OR rattling during earthquake
    for (const d of doorEntries) {
      const obj = state.interactives.find((i) => i.id === d.id);
      if (obj && obj.used && !d.isHotDoor) {
        if (d.openProgress < 1) {
          d.openProgress = Math.min(1, d.openProgress + dt * 3.4);
          const eased = 1 - Math.pow(1 - d.openProgress, 3);
          d.hingePivot.rotation.y = eased * Math.PI * 0.48;
        }
      } else if (state.disaster === 'earthquake' && state.eqShakeIntensity > 0.1) {
        d.hingePivot.rotation.y = Math.sin(elapsed * 28) * 0.035 * state.eqShakeIntensity;
      } else {
        d.hingePivot.rotation.y = 0;
      }
    }

    for (const obj of state.interactives) {
      const entry = interactiveMap.get(obj.id);
      if (!entry) continue;
      if (obj.kind === 'emergency_kit' && obj.used) {
        entry.group.visible = false;
      } else if ((obj.kind === 'gas_valve' || obj.kind === 'breaker_panel') && obj.used) {
        const lever = entry.highlightMeshes[1];
        if (lever) lever.rotation.z = Math.PI * 0.5;
      }
    }

    // 3. Ceiling lamp sway & flicker + gentle ceiling fan spin
    for (let i = 0; i < ceilingLights.length; i++) {
      const cl = ceilingLights[i];
      if (state.disaster === 'earthquake') {
        const amp = state.eqShakeIntensity * 0.19;
        cl.pivot.rotation.z = Math.sin(elapsed * 5.2 + i) * amp;
        cl.pivot.rotation.x = Math.cos(elapsed * 4.4 + i) * amp * 0.72;
        cl.light.intensity = cl.baseIntensity * state.lightFlicker;
        (cl.bulb.material as THREE.MeshStandardMaterial).emissiveIntensity =
          1.5 * state.lightFlicker;
      } else if (state.disaster === 'fire') {
        const flicker = 0.88 + Math.sin(elapsed * 19 + i * 2) * 0.12;
        cl.light.intensity = cl.baseIntensity * flicker;
      }
    }
    if (livingRoomFan) {
      livingRoomFan.rotation.y += dt * (state.eqShakeIntensity > 0.2 ? 3.5 : 1.4);
    }

    // 4. Earthquake Living Room/Apartment Dynamics
    if (state.disaster === 'earthquake') {
      crackGroup.visible = state.elapsed >= 4.5;
      const shakeAmp = state.eqShakeIntensity;

      for (const sp of shakingProps) {
        if (shakeAmp > 0.05) {
          sp.obj.position.x = sp.baseX + Math.sin(elapsed * 34 + sp.phase) * 0.024 * shakeAmp;
          sp.obj.position.z = sp.baseZ + Math.cos(elapsed * 29 + sp.phase) * 0.022 * shakeAmp;
          sp.obj.rotation.y = sp.baseRotY + Math.sin(elapsed * 24 + sp.phase) * 0.018 * shakeAmp;
        } else {
          sp.obj.position.x = sp.baseX;
          sp.obj.position.z = sp.baseZ;
          sp.obj.rotation.y = sp.baseRotY;
        }
      }

      for (const wa of wallArtEntries) {
        if (state.eqPhase === 'shaking' || state.eqPhase === 'aftershock') {
          wa.group.rotation.z += (wa.targetTilt - wa.group.rotation.z) * Math.min(1, dt * 3);
          wa.group.rotation.z += Math.sin(elapsed * 25) * 0.02 * shakeAmp;
        }
      }

      for (const te of toppleEntries) {
        if (te.wallRef.toppled && te.progress < 1) {
          te.progress = Math.min(1, te.progress + dt * 2.8);
          const eased = te.progress * te.progress;
          if (te.axis === 'x') {
            te.pivot.rotation.x = eased * (Math.PI / 2) * te.dir;
          } else {
            te.pivot.rotation.z = eased * (Math.PI / 2) * te.dir;
          }
        }
      }

      for (const h of state.hazards) {
        if (h.kind === 'glass') {
          const gg = glassClusters.get(h.id);
          if (gg) gg.visible = h.active;
        }
      }

      for (const fo of state.fallingObjects) {
        let entry = fallingMeshes.get(fo.id);
        if (!entry) {
          let obj3d: THREE.Object3D;
          if (fo.kind === 'books') {
            const grp = new THREE.Group();
            const b1 = new THREE.Mesh(trackGeo(createRoundedBoxGeo(0.28, 0.055, 0.21, 0.01, 0.004)), mats.redPaint);
            const b2 = new THREE.Mesh(trackGeo(createRoundedBoxGeo(0.26, 0.05, 0.19, 0.01, 0.004)), mats.fabricNavy);
            b2.position.y = 0.055;
            b2.rotation.y = 0.25;
            grp.add(b1, b2);
            obj3d = grp;
          } else if (fo.kind === 'lamp') {
            obj3d = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 0.22, 12)), mats.brushedMetal);
          } else {
            obj3d = new THREE.Mesh(trackGeo(createRoundedBoxGeo(0.32, 0.07, 0.28, 0.01, 0.005)), mats.interiorWall);
          }
          obj3d.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) c.castShadow = true;
          });
          obj3d.position.set(fo.x * WORLD_SCALE, 2.9, fo.targetY * WORLD_SCALE);
          scene.add(obj3d);
          entry = {
            mesh: obj3d,
            y: 2.9,
            vy: -1.5,
            bounced: false,
            settled: false,
            spinX: (Math.random() - 0.5) * 8,
            spinZ: (Math.random() - 0.5) * 8,
          };
          fallingMeshes.set(fo.id, entry);
        }

        if (!entry.settled) {
          entry.vy -= 14.5 * dt;
          entry.y += entry.vy * dt;
          if (entry.y <= 0.1) {
            entry.y = 0.1;
            if (!entry.bounced && Math.abs(entry.vy) > 2.2) {
              entry.bounced = true;
              entry.vy = -entry.vy * 0.34;
            } else {
              entry.vy = 0;
              entry.settled = true;
            }
          }
          entry.mesh.position.y = entry.y;
          entry.mesh.rotation.x += entry.spinX * dt;
          entry.mesh.rotation.z += entry.spinZ * dt;
        }
      }

      if (eqDustPoints && eqDustVel) {
        const dPos = eqDustPoints.geometry.attributes.position as THREE.BufferAttribute;
        const fallMult = 0.35 + shakeAmp * 2.1;
        for (let i = 0; i < dPos.count; i++) {
          let y = dPos.getY(i) - eqDustVel[i] * fallMult * dt;
          if (y < 0.08) y = 2.95;
          dPos.setY(i, y);
        }
        dPos.needsUpdate = true;
      }
    }

    // 5. Flood Waves, Rain, Tree Wind Sway, Wading Splashes, Floating Debris & Lightning
    if (state.disaster === 'flood') {
      const windGust = 0.055 + Math.sin(elapsed * 1.4) * 0.025;
      for (const st of swayingTrees) {
        st.group.rotation.z = Math.sin(elapsed * 2.6 + st.phase) * windGust;
        st.group.rotation.x = Math.cos(elapsed * 2.1 + st.phase) * windGust * 0.6;
      }

      if (floodWaterMesh && floodWaterBasePositions) {
        const targetWaterY = 0.03 + state.floodWaterLevel * 0.56;
        floodWaterMesh.position.y += (targetWaterY - floodWaterMesh.position.y) * Math.min(1, dt * 4);
        const bump = mats.waterSurface.bumpMap;
        if (bump) {
          bump.offset.x = (elapsed * 0.07) % 1;
          bump.offset.y = (elapsed * 0.045) % 1;
        }

        const posAttr = floodWaterMesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          const bx = floodWaterBasePositions[i * 3];
          const bz = floodWaterBasePositions[i * 3 + 2];
          const wave =
            Math.sin(bx * 0.9 + elapsed * 2.5) * Math.cos(bz * 0.8 + elapsed * 2.1) * 0.038 +
            Math.sin(bx * 1.8 - elapsed * 3.2) * 0.014;
          posAttr.setY(i, wave);
        }
        posAttr.needsUpdate = true;

        for (const fe of floatingEntries) {
          const deb = state.floatingDebris.find((d) => d.id === fe.id);
          if (deb) {
            fe.group.position.set(
              (deb.x + deb.w / 2) * WORLD_SCALE,
              floodWaterMesh.position.y + 0.04,
              (deb.y + deb.h / 2) * WORLD_SCALE
            );
            fe.group.rotation.z = Math.sin(elapsed * 3.1 + fe.group.position.x) * 0.13;
            fe.group.rotation.x = Math.cos(elapsed * 2.5 + fe.group.position.z) * 0.1;
          }
        }
      }

      if (rainLines) {
        rainLines.position.set(state.player.x * WORLD_SCALE, 0, state.player.y * WORLD_SCALE);
        const rPos = rainLines.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rPos.count / 2; i++) {
          let y0 = rPos.getY(i * 2) - dt * 16;
          if (y0 < 0.15) y0 += 10;
          rPos.setY(i * 2, y0);
          rPos.setY(i * 2 + 1, y0 - 0.78);
        }
        rPos.needsUpdate = true;
      }

      if (splashInstanced && floodWaterMesh) {
        const speed = Math.hypot(state.player.vx, state.player.vy);
        if (state.player.inWater && speed > 22 && Math.random() < dt * 28) {
          const sd = splashData[splashSpawnIdx % splashData.length];
          splashSpawnIdx++;
          sd.x = state.player.x * WORLD_SCALE + (Math.random() - 0.5) * 0.45;
          sd.y = floodWaterMesh.position.y + 0.05;
          sd.z = state.player.y * WORLD_SCALE + (Math.random() - 0.5) * 0.45;
          sd.vx = (Math.random() - 0.5) * 1.4;
          sd.vy = 1.6 + Math.random() * 1.2;
          sd.vz = (Math.random() - 0.5) * 1.4;
          sd.life = 0.45;
        }

        for (let i = 0; i < splashData.length; i++) {
          const sd = splashData[i];
          if (sd.life > 0) {
            sd.life = Math.max(0, sd.life - dt);
            sd.vy -= 9.5 * dt;
            sd.x += sd.vx * dt;
            sd.y += sd.vy * dt;
            sd.z += sd.vz * dt;
            _dummyObj.position.set(sd.x, sd.y, sd.z);
            _dummyObj.scale.setScalar(sd.life * 2.2);
          } else {
            _dummyObj.position.set(0, -10, 0);
            _dummyObj.scale.setScalar(0.01);
          }
          _dummyObj.updateMatrix();
          splashInstanced.setMatrixAt(i, _dummyObj.matrix);
        }
        splashInstanced.instanceMatrix.needsUpdate = true;
      }

      sunLight.intensity = 0.88 + state.lightningAlpha * 3.1;
      for (let i = 0; i < sparkLights.length; i++) {
        sparkLights[i].intensity = 2 + Math.abs(Math.sin(elapsed * 24 + i * 3)) * 8.5;
      }
    }

    // 6. Fire Flames, Rising Embers, Smoke Ceiling & Dynamic Visibility Fog
    if (state.disaster === 'fire') {
      for (const fc of fireClusters) {
        const h = state.hazards.find((hz) => hz.id === fc.hazardId);
        if (!h || !h.active) {
          fc.group.visible = false;
          continue;
        }
        fc.group.visible = true;
        fc.group.position.set((h.x + h.w / 2) * WORLD_SCALE, 0, (h.y + h.h / 2) * WORLD_SCALE);
        const sx = h.w / fc.baseW;
        const sz = h.h / fc.baseH;
        fc.group.scale.set(sx, 1, sz);

        for (let i = 0; i < fc.flames.length; i++) {
          const fl = fc.flames[i];
          const flicker = 0.78 + Math.sin(elapsed * 15 + i * 1.9) * 0.3;
          fl.scale.set(1 + Math.sin(elapsed * 11 + i) * 0.12, flicker, 1);
        }
        if (fc.light) {
          fc.light.intensity = 7.5 + Math.sin(elapsed * 17) * 2.8;
        }
      }

      for (const os of officeScorchMeshes) {
        if (!os.scorched) {
          const nearFire = state.hazards.some(
            (hz) =>
              hz.active &&
              hz.kind === 'fire' &&
              Math.hypot((hz.x + hz.w / 2) * WORLD_SCALE - os.x, (hz.y + hz.h / 2) * WORLD_SCALE - os.z) < 3.4
          );
          if (nearFire) {
            os.scorched = true;
            os.mesh.material = mats.charredWood;
          }
        }
      }

      for (const sp of smokePlumes) {
        for (const puff of sp.puffs) {
          puff.mesh.position.y = puff.baseY + Math.sin(elapsed * 1.2 + puff.phase) * 0.14;
          puff.mesh.position.x = puff.baseX + Math.cos(elapsed * 0.7 + puff.phase) * 0.2;
          puff.mesh.rotation.z += dt * 0.18;
        }
      }

      if (emberPoints && emberSpeeds) {
        const ePos = emberPoints.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < ePos.count; i++) {
          let y = ePos.getY(i) + emberSpeeds[i] * dt;
          const x = ePos.getX(i) + Math.sin(elapsed * 3 + i) * 0.25 * dt;
          if (y > 3.0) y = 0.1;
          ePos.setY(i, y);
          ePos.setX(i, x);
        }
        ePos.needsUpdate = true;
      }

      const smokeBonus = state.player.inSmoke ? (state.player.crouching ? -0.008 : 0.022) : 0;
      const targetFog = Math.max(0.015, baseFogDensity + Math.min(0.012, state.elapsed * 0.00025) + smokeBonus);
      fog.density += (targetFog - fog.density) * Math.min(1, dt * 4);

      if (alarmBeaconLight) {
        alarmBeaconLight.intensity = state.fireAlarmActive
          ? Math.sin(elapsed * 10) > 0
            ? 10.5
            : 0.4
          : 0;
      }
    }

    // 7. NPC 3D movement & leg stride
    for (const ne of npcEntries) {
      const npc = state.npcs.find((n) => n.id === ne.id);
      if (!npc) continue;
      const nx = npc.x * WORLD_SCALE;
      const nz = npc.y * WORLD_SCALE;
      const dx = nx - ne.lastX;
      const dz = nz - ne.lastZ;
      const moved = Math.hypot(dx, dz);
      ne.group.position.set(nx, 0, nz);
      if (moved > 0.002) {
        ne.group.rotation.y = Math.atan2(dx, dz);
        const stride = Math.sin(elapsed * 10) * 0.45;
        ne.legL.rotation.x = stride;
        ne.legR.rotation.x = -stride;
      } else {
        ne.legL.rotation.x = 0;
        ne.legR.rotation.x = 0;
      }
      ne.lastX = nx;
      ne.lastZ = nz;
    }

    safePadMat.emissiveIntensity = 0.35 + Math.sin(elapsed * 3) * 0.2;
  };

  const dispose = () => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    disposeMaterialLibrary(mats);
    geos.disposeAll();
    extraMats.forEach((m) => m.dispose());
    envRT.dispose();
    if (sunLight.shadow.map) sunLight.shadow.map.dispose();
  };

  return {
    scene,
    mats,
    raycastTargets,
    update,
    setQuality,
    dispose,
  };
}
