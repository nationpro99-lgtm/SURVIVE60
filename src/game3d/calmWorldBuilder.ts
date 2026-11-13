import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CalmEngineState, getCalmGroundHeightWorld } from '../game/calmLevel';
import { GameSettings } from '../game/types';
import { createFoliageBlobGeo, createRoundedBoxGeo, GeoTracker } from './geometryHelpers';
import { createMaterialLibrary, disposeMaterialLibrary, MaterialLibrary } from './materials';
import {
  buildBookshelf,
  buildCeilingFan,
  buildCurtains,
  buildDoorAssembly,
  buildFridge,
  buildHouse,
  buildInteractiveProp,
  buildKitchenCounter,
  buildPottedPlant,
  buildSofa,
  buildTableWithChairs,
  buildTree,
  buildWallArt,
  buildWallClock,
  tagRaycastProxy,
} from './models';
import { WORLD_SCALE } from './worldBuilder';

const _dummy = new THREE.Object3D();
const _tempColor = new THREE.Color();

export interface CalmWorld3DController {
  scene: THREE.Scene;
  mats: MaterialLibrary;
  raycastTargets: THREE.Object3D[];
  update: (dt: number, elapsed: number, state: CalmEngineState, hoveredId: string | null) => void;
  setQuality: (quality: GameSettings['graphicsQuality'], isSoftwareGl: boolean) => void;
  setReducedEffects: (reduced: boolean) => void;
  dispose: () => void;
}

interface BirdActor {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  baseY: number;
  speed: number;
  phase: number;
  flapRate: number;
}

interface CloudGroup {
  group: THREE.Group;
  speed: number;
  minX: number;
  maxX: number;
}

interface SwayTreeEntry {
  group: THREE.Group;
  phase: number;
  baseRotZ: number;
}

export function buildCalmWorld3D(
  renderer: THREE.WebGLRenderer,
  initialState: CalmEngineState,
  initialQuality: GameSettings['graphicsQuality'],
  isSoftwareGl: boolean,
  reducedEffects = false
): CalmWorld3DController {
  let quality = initialQuality;
  let effectsReduced = reducedEffects;

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

  // --- ENVIRONMENT IBL ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  roomEnv.dispose();
  pmrem.dispose();

  const worldW = initialState.worldWidth * WORLD_SCALE; // 42m
  const worldD = initialState.worldHeight * WORLD_SCALE; // 26.5m

  // --- SUNLIT SKY DOME & HORIZON FOG ---
  const horizonColor = 0xdbeafe;
  scene.background = new THREE.Color(horizonColor);
  const fog = new THREE.FogExp2(horizonColor, 0.0095);
  scene.fog = fog;

  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x60a5fa) },
    uMidColor: { value: new THREE.Color(0xbae6fd) },
    uHorizonColor: { value: new THREE.Color(0xfef3c7) },
  };
  const skyGeo = trackGeo(new THREE.SphereGeometry(118, 28, 18));
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos - vec3(21.0, 0.0, 13.0)).y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
          col = mix(col, uTopColor, smoothstep(0.28, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.position.set(worldW * 0.5, 0, worldD * 0.5);
  scene.add(skyDome);

  // Soft Glowing Sun Disc high in the east sky
  const sunDisc = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(3.8, 16, 12)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfffbeb, fog: false }))
  );
  sunDisc.position.set(worldW + 34, 42, -16);
  scene.add(sunDisc);

  // --- SOFT SUNLIT LIGHTING RIG ---
  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x84cc16, 0.88);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.55);
  sunLight.position.set(worldW * 0.78, 26, 6);
  sunLight.target.position.set(worldW * 0.45, 0, worldD * 0.5);
  scene.add(sunLight, sunLight.target);

  const shadowMapSize = quality === 'high' ? 2048 : 1024;
  sunLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 70;
  sunLight.shadow.camera.left = -28;
  sunLight.shadow.camera.right = 28;
  sunLight.shadow.camera.top = 24;
  sunLight.shadow.camera.bottom = -24;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.02;
  sunLight.castShadow = !isSoftwareGl && quality !== 'low';

  // Warm indoor ceiling fill lights
  const houseFill = new THREE.PointLight(0xffedd5, 2.2, 16, 1.4);
  houseFill.position.set(9.5, 3.05, 13.0);
  scene.add(houseFill);

  const kitchenFill = new THREE.PointLight(0xfef3c7, 1.9, 13, 1.4);
  kitchenFill.position.set(11.0, 3.05, 7.2);
  scene.add(kitchenFill);

  // --- NATURAL SUNLIT TERRAIN & ROLLING HILLS ---
  const meadowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.92,
      metalness: 0.0,
      map: mats.grassFloor.map,
    })
  );
  const outerGround = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(180, 180)), meadowMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.set(worldW * 0.5, -0.02, worldD * 0.5);
  outerGround.receiveShadow = true;
  scene.add(outerGround);

  // Rolling soft distant green hills around perimeter
  const hillMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4d7c0f,
      roughness: 0.95,
    })
  );
  const distantHillMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b9080,
      roughness: 0.96,
    })
  );
  const hillConfigs: [number, number, number, number, boolean][] = [
    [-18, -14, 18, 5.5, false],
    [16, -22, 24, 6.2, true],
    [48, -18, 22, 7.5, true],
    [62, 10, 20, 8.2, false],
    [58, 34, 22, 6.8, true],
    [26, 46, 25, 5.4, true],
    [-14, 42, 20, 6.0, false],
    [-22, 14, 17, 4.8, false],
  ];
  hillConfigs.forEach(([hx, hz, rad, height, distant]) => {
    const hill = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(rad, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      distant ? distantHillMat : hillMat
    );
    hill.scale.set(1.3, height / rad, 1.0);
    hill.position.set(hx, -0.25, hz);
    hill.receiveShadow = true;
    scene.add(hill);
  });

  // --- CLEAR SUNLIT BROOK & ARCHED TIMBER FOOTBRIDGE ---
  // Brook channel along bpX 965..1115 (worldX 24.125..27.875)
  const brookBed = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.2, 0.08, worldD + 44)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 }))
  );
  brookBed.position.set(26.0, -0.04, worldD * 0.5);
  brookBed.receiveShadow = true;
  scene.add(brookBed);

  const sharedTimeUniform = { value: 0 };
  const brookWaterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.14,
      metalness: 0.06,
      transparent: true,
      opacity: 0.78,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    })
  );
  brookWaterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTimeUniform;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      transformed.y += sin(position.z * 2.4 + uTime * 2.2) * 0.015 + cos(position.x * 3.1 - uTime * 1.7) * 0.012;
      `
    );
  };
  const brookSurface = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(3.8, worldD + 44, 10, 48)),
    brookWaterMat
  );
  brookSurface.rotation.x = -Math.PI / 2;
  brookSurface.position.set(26.0, 0.05, worldD * 0.5);
  brookSurface.receiveShadow = true;
  scene.add(brookSurface);

  // Brook stone banks along west and east edges
  const stoneGeo = trackGeo(createFoliageBlobGeo(0.28, 0.16, 0.26, 2.2));
  const stoneMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88 }));
  const stoneCount = 46;
  const stonesInst = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneCount);
  stonesInst.receiveShadow = true;
  let sIdx = 0;
  for (let i = 0; i < 23; i++) {
    const zPos = 1.0 + i * 1.12;
    if (zPos > 11.1 && zPos < 15.2) continue; // bridge opening
    for (const bx of [24.0, 28.0]) {
      if (sIdx >= stoneCount) break;
      _dummy.position.set(bx + Math.sin(i * 3.1) * 0.14, 0.06, zPos);
      _dummy.rotation.set(0, i * 0.8, 0);
      const sc = 0.85 + (i % 4) * 0.18;
      _dummy.scale.set(sc, sc * 0.75, sc * 1.1);
      _dummy.updateMatrix();
      stonesInst.setMatrixAt(sIdx++, _dummy.matrix);
    }
  }
  stonesInst.count = sIdx;
  stonesInst.instanceMatrix.needsUpdate = true;
  stonesInst.computeBoundingSphere();
  scene.add(stonesInst);

  // Arched Timber Footbridge spanning x: 23.625 .. 28.375, z: 11.5 .. 15.0
  const bridgeGroup = new THREE.Group();
  const bridgePlankGeo = trackGeo(createRoundedBoxGeo(0.32, 0.08, 3.3, 0.02, 0.008));
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = 23.72 + t * 4.56;
    const y = 0.1 + Math.sin(t * Math.PI) * 0.52;
    const plank = new THREE.Mesh(bridgePlankGeo, mats.oakWood);
    plank.position.set(x, y, 13.25);
    plank.rotation.z = Math.cos(t * Math.PI) * 0.24;
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }
  // Curved arched handrails & timber posts
  for (const side of [-1, 1]) {
    const rz = 13.25 + side * 1.55;
    const railPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = 23.7 + t * 4.6;
      const y = 0.14 + Math.sin(t * Math.PI) * 0.52 + 0.92;
      railPts.push(new THREE.Vector3(x, y, rz));
      if (i % 2 === 0) {
        const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 1.05, 8)), mats.darkWood);
        post.position.set(x, y - 0.5, rz);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const rail = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(railCurve, 18, 0.045, 8, false)), mats.darkWood);
    rail.castShadow = true;
    bridgeGroup.add(rail);
  }
  scene.add(bridgeGroup);

  // --- WINDING GARDEN STEPPING-STONE TRAIL ---
  const trailMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe7d7be,
      roughness: 0.9,
    })
  );
  const steppingGeo = trackGeo(createRoundedBoxGeo(1.05, 0.05, 0.85, 0.16, 0.02));
  const trailPoints: [number, number][] = [
    [16.2, 13.1], [17.8, 13.0], [19.4, 13.2], [21.0, 13.3], [22.5, 13.25],
    [29.3, 13.25], [30.7, 13.25],
    [12.2, 3.6], [13.5, 3.5], [15.0, 4.4], [16.5, 6.0], [17.8, 8.2], [18.9, 10.7],
  ];
  trailPoints.forEach(([tx, tz], i) => {
    const stone = new THREE.Mesh(steppingGeo, trailMat);
    stone.position.set(tx, 0.02, tz);
    stone.rotation.y = (i % 3) * 0.12 - 0.1;
    stone.receiveShadow = true;
    scene.add(stone);
  });

  // --- HIGH-GROUND OVERLOOK PLATEAU, RAMP & TIMBER GAZEBO ---
  // Sloped earth ramp (worldX 30.5 -> 33.0, height 0 -> 0.68)
  const plateauGeo = trackGeo(new THREE.BoxGeometry(11.0, 0.7, worldD + 4));
  const plateau = new THREE.Mesh(plateauGeo, mats.highgroundFloor);
  plateau.position.set(38.5, 0.33, worldD * 0.5);
  plateau.receiveShadow = true;
  scene.add(plateau);

  // Beveled ramp climbing smoothly onto plateau
  const rampGeo = trackGeo(new THREE.BoxGeometry(2.75, 0.12, 4.8));
  const ramp = new THREE.Mesh(rampGeo, trailMat);
  ramp.position.set(31.78, 0.33, 13.25);
  ramp.rotation.z = Math.atan2(0.68, 2.5);
  ramp.receiveShadow = true;
  scene.add(ramp);

  // Open Octagonal Timber Gazebo at High Ground (worldX 35.7, worldZ 13.2, baseY 0.68)
  const gazeboGroup = new THREE.Group();
  gazeboGroup.position.set(35.7, 0.68, 13.2);
  const deck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.55, 2.75, 0.18, 8)), mats.oakWood);
  deck.position.y = 0.09;
  deck.receiveShadow = true;
  gazeboGroup.add(deck);

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.3;
    const px = Math.cos(ang) * 2.15;
    const pz = Math.sin(ang) * 2.15;
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.095, 2.6, 10)), mats.darkWood);
    post.position.set(px, 1.4, pz);
    post.castShadow = true;
    gazeboGroup.add(post);
  }
  const gazRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.95, 1.35, 8)), mats.roofTile);
  gazRoof.position.y = 3.35;
  gazRoof.castShadow = true;
  const gazFinial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 10, 8)), mats.brass);
  gazFinial.position.y = 4.06;
  gazeboGroup.add(gazRoof, gazFinial);

  // Timber park bench & calm shelter signpost inside gazebo
  const benchSeat = new THREE.Mesh(trackGeo(createRoundedBoxGeo(0.55, 0.07, 1.5, 0.02, 0.01)), mats.oakWood);
  benchSeat.position.set(1.15, 0.56, 0);
  const benchBack = new THREE.Mesh(trackGeo(createRoundedBoxGeo(0.07, 0.45, 1.5, 0.02, 0.01)), mats.oakWood);
  benchBack.position.set(1.4, 0.82, 0);
  gazeboGroup.add(benchSeat, benchBack);
  scene.add(gazeboGroup);

  // --- SAFE HOUSE ARCHITECTURE (x: 3.0..15.5, z: 4.5..22.0) ---
  // Interior Hardwood Floor + Kitchen Ceramic Tile
  const livingFloor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(12.6, 0.08, 17.6)),
    mats.woodFloor
  );
  livingFloor.position.set(9.25, 0.02, 13.25);
  livingFloor.receiveShadow = true;
  scene.add(livingFloor);

  const kitchenTileFloor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.09, 4.4)),
    mats.tileFloor
  );
  kitchenTileFloor.position.set(11.6, 0.025, 6.8);
  kitchenTileFloor.receiveShadow = true;
  scene.add(kitchenTileFloor);

  // Plush living room rug under coffee table & sofa
  const rug = new THREE.Mesh(
    trackGeo(createRoundedBoxGeo(3.6, 0.02, 4.2, 0.05, 0.01)),
    mats.rugFabric
  );
  rug.position.set(6.4, 0.07, 13.3);
  rug.receiveShadow = true;
  scene.add(rug);

  // Ceiling + Pitched Roof over Safe House (stays clean overhead inside!)
  const houseCeiling = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(12.8, 0.14, 17.8)),
    mats.ceiling
  );
  houseCeiling.position.set(9.25, 3.25, 13.25);
  scene.add(houseCeiling);

  // Sloped Gable Roof visible when walking outside in the garden
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-9.35, 0);
  roofShape.lineTo(0, 2.35);
  roofShape.lineTo(9.35, 0);
  roofShape.lineTo(9.1, -0.14);
  roofShape.lineTo(0, 2.15);
  roofShape.lineTo(-9.1, -0.14);
  roofShape.closePath();
  const houseRoofGeo = trackGeo(
    new THREE.ExtrudeGeometry(roofShape, { depth: 13.5, bevelEnabled: false })
  );
  houseRoofGeo.rotateY(Math.PI / 2);
  houseRoofGeo.translate(2.5, 3.3, 13.25);
  const houseRoof = new THREE.Mesh(houseRoofGeo, mats.roofTile);
  houseRoof.castShadow = true;
  houseRoof.receiveShadow = true;
  scene.add(houseRoof);

  // Front Porch Wooden Deck & Awning facing the garden
  const porchDeck = new THREE.Mesh(
    trackGeo(createRoundedBoxGeo(1.75, 0.14, 4.4, 0.03, 0.01)),
    mats.oakWood
  );
  porchDeck.position.set(16.2, 0.05, 13.15);
  porchDeck.receiveShadow = true;
  const porchCanopy = new THREE.Mesh(
    trackGeo(createRoundedBoxGeo(1.9, 0.1, 4.4, 0.02, 0.01)),
    mats.roofTile
  );
  porchCanopy.position.set(16.2, 2.85, 13.15);
  porchCanopy.rotation.z = -0.14;
  porchCanopy.castShadow = true;
  scene.add(porchDeck, porchCanopy);
  for (const pz of [11.2, 15.1]) {
    const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.065, 0.075, 2.75, 8)), mats.skirtingWood);
    col.position.set(16.95, 1.42, pz);
    col.castShadow = true;
    scene.add(col);
  }

  // --- BUILD WALLS, WINDOWS & TREES FROM BLUEPRINT ---
  const wallHeight = 3.2;
  const swayTrees: SwayTreeEntry[] = [];

  initialState.walls.forEach((w, idx) => {
    // Skip brook invisible bank blockers (keep water clear & natural!)
    if (w.label?.startsWith('Brook Bank')) return;

    const wx = (w.x + w.w / 2) * WORLD_SCALE;
    const wz = (w.y + w.h / 2) * WORLD_SCALE;
    const ww = w.w * WORLD_SCALE;
    const wd = w.h * WORLD_SCALE;

    if (w.kind === 'wall') {
      const wallMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(ww, wallHeight, wd)),
        mats.interiorWall
      );
      wallMesh.position.set(wx, wallHeight / 2, wz);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);

      const baseboard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(ww + 0.025, 0.15, wd + 0.025)),
        mats.skirtingWood
      );
      baseboard.position.set(wx, 0.075, wz);
      scene.add(baseboard);
    } else if (w.kind === 'window') {
      const lower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ww, 0.85, wd + 0.05)), mats.interiorWall);
      lower.position.set(wx, 0.425, wz);
      const upper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ww, 0.75, wd + 0.05)), mats.interiorWall);
      upper.position.set(wx, 2.825, wz);
      const glass = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(Math.max(0.04, ww - 0.08), 1.6, Math.max(0.04, wd - 0.08))),
        mats.windowGlass
      );
      glass.position.set(wx, 1.65, wz);
      scene.add(lower, upper, glass);

      // Curtains inside sunlit windows
      const curtains = buildCurtains(Math.max(ww, wd) * 0.85, mats, geos);
      curtains.position.set(wx, 1.68, wz);
      if (wd > ww) curtains.rotation.y = Math.PI / 2;
      scene.add(curtains);
    } else if (w.kind === 'tree') {
      const tree = buildTree(4.6 + (idx % 3) * 0.7, mats, idx * 1.4, geos);
      tree.position.set(wx, getCalmGroundHeightWorld(wx, wz), wz);
      scene.add(tree);
      swayTrees.push({ group: tree, phase: idx * 1.2, baseRotZ: 0 });
    }
  });

  // Extra scenic background meadow trees framing horizon
  const bgTreeCoords: [number, number, number][] = [
    [1.0, 2.0, 5.2], [6.0, 1.4, 4.9], [20.5, 1.8, 5.4], [32.0, 2.2, 5.6],
    [43.0, 5.0, 5.1], [44.0, 19.5, 5.5], [22.0, 24.5, 5.2], [5.5, 24.8, 4.8],
    [0.5, 12.0, 5.3],
  ];
  bgTreeCoords.forEach(([tx, tz, th], idx) => {
    const t = buildTree(th, mats, 10 + idx * 1.9, geos);
    t.position.set(tx, getCalmGroundHeightWorld(tx, tz), tz);
    scene.add(t);
    swayTrees.push({ group: t, phase: idx * 0.9 + 2, baseRotZ: 0 });
  });

  // Distant neighboring cozy cottage across meadow for scenic warmth
  const neighborCottage = buildHouse(6.2, 5.0, 3.0, mats, 1, geos);
  neighborCottage.position.set(39.0, 0.68, 2.5);
  neighborCottage.rotation.y = -0.35;
  scene.add(neighborCottage);

  // --- SAFE HOUSE INTERIOR FURNITURE ---
  // Sturdy Oak Dining Table (Earthquake Cover Practice)
  const oakTable = buildTableWithChairs(2.75, 1.8, 0.8, mats, true, geos);
  oakTable.position.set((255 + 55) * WORLD_SCALE, 0.04, (685 + 36) * WORLD_SCALE);
  scene.add(oakTable);

  // Raycast proxy over Oak Table for calm_cover_table
  const coverObj = initialState.interactives.find((i) => i.id === 'calm_cover_table')!;
  const coverHighlightMeshes: THREE.Mesh[] = [];
  oakTable.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) coverHighlightMeshes.push(c as THREE.Mesh);
  });
  const coverProxy = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.8, 1.3, 1.85)),
    trackMat(new THREE.MeshBasicMaterial({ visible: false }))
  );
  coverProxy.position.set((255 + 55) * WORLD_SCALE, 0.7, (685 + 36) * WORLD_SCALE);
  tagRaycastProxy(coverProxy, coverObj.id, coverHighlightMeshes.slice(0, 3));
  scene.add(coverProxy);
  raycastTargets.push(coverProxy);

  // Sofa & Coffee Table
  const sofa = buildSofa(1.35, 3.1, mats, geos);
  sofa.position.set((155 + 27) * WORLD_SCALE, 0.04, (470 + 62.5) * WORLD_SCALE);
  scene.add(sofa);

  const coffeeTable = buildTableWithChairs(1.1, 1.9, 0.48, mats, false, geos);
  coffeeTable.position.set((260 + 23) * WORLD_SCALE, 0.04, (495 + 39) * WORLD_SCALE);
  scene.add(coffeeTable);

  // Bookshelf
  const bookshelf = buildBookshelf(2.1, 0.75, 2.05, mats, geos);
  bookshelf.position.set((148 + 42.5) * WORLD_SCALE, 0.04, (775 + 17) * WORLD_SCALE);
  scene.add(bookshelf);

  // Kitchen Counter & Fridge
  const kitchenCounter = buildKitchenCounter(2.75, 0.8, mats, geos);
  kitchenCounter.position.set((390 + 55) * WORLD_SCALE, 0.04, (345 + 16) * WORLD_SCALE);
  scene.add(kitchenCounter);

  const fridge = buildFridge(1.1, 0.85, mats, geos);
  fridge.position.set((540 + 26) * WORLD_SCALE, 0.04, (210 + 18) * WORLD_SCALE);
  scene.add(fridge);

  // Supplies Side Table
  const suppliesTable = buildTableWithChairs(1.9, 1.1, 0.78, mats, false, geos);
  suppliesTable.position.set((500 + 40) * WORLD_SCALE, 0.04, (745 + 24) * WORLD_SCALE);
  scene.add(suppliesTable);

  // Visual water bottles on supplies table next to the radio prop
  const bottleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      roughness: 0.12,
      transparent: true,
      opacity: 0.78,
    })
  );
  for (const bx of [-0.45, -0.3]) {
    const bottle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.055, 0.25, 10)), bottleMat);
    bottle.position.set((500 + 40) * WORLD_SCALE + bx, 0.94, (745 + 24) * WORLD_SCALE + 0.1);
    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8)), mats.skyGlow);
    cap.position.set((500 + 40) * WORLD_SCALE + bx, 1.08, (745 + 24) * WORLD_SCALE + 0.1);
    scene.add(bottle, cap);
  }

  // Interior Warm Details: Potted Plants, Wall Art, Clock, Ceiling Fan
  for (const [px, pz] of [
    [3.8, 10.6],
    [14.2, 10.8],
    [14.3, 15.6],
    [34.2, 11.4],
  ]) {
    const plant = buildPottedPlant(mats, geos);
    plant.position.set(px, getCalmGroundHeightWorld(px, pz) + 0.02, pz);
    scene.add(plant);
  }

  const wallArt = buildWallArt(1.5, 1.0, mats, geos);
  wallArt.position.set(3.58, 2.1, 13.3);
  wallArt.rotation.y = Math.PI / 2;
  scene.add(wallArt);

  const wallClock = buildWallClock(mats, geos);
  wallClock.position.set(8.05, 2.3, 7.2);
  wallClock.rotation.y = Math.PI / 2;
  scene.add(wallClock);

  const ceilingFan = buildCeilingFan(mats, geos);
  ceilingFan.position.set(9.2, 3.18, 13.2);
  scene.add(ceilingFan);

  // --- INTERACTIVE LEARNING PROPS & HINGED EXIT DOORS ---
  const interactiveHighlights = new Map<string, THREE.Mesh[]>();
  const doorEntries: { id: string; hingePivot: THREE.Group; openProgress: number }[] = [];
  const beaconRings: { id: string; ring: THREE.Mesh; baseY: number }[] = [];

  for (const obj of initialState.interactives) {
    if (obj.id === 'calm_cover_table') {
      interactiveHighlights.set(obj.id, coverHighlightMeshes.slice(0, 3));
      continue;
    }

    const ox = (obj.x + obj.w / 2) * WORLD_SCALE;
    const oz = (obj.y + obj.h / 2) * WORLD_SCALE;
    const groundY = getCalmGroundHeightWorld(ox, oz);

    if (obj.kind === 'exit_door' || obj.kind === 'stairs_exit') {
      const doorAsm = buildDoorAssembly(
        obj,
        obj.w * WORLD_SCALE,
        obj.h * WORLD_SCALE,
        true,
        false,
        mats,
        geos
      );
      doorAsm.group.position.set(ox, groundY, oz);
      scene.add(doorAsm.group);
      raycastTargets.push(doorAsm.proxy);
      interactiveHighlights.set(obj.id, doorAsm.highlightMeshes);
      doorEntries.push({ id: obj.id, hingePivot: doorAsm.hingePivot, openProgress: 0 });
    } else if (obj.kind === 'safe_zone') {
      // High-Ground Overlook Info Signpost & Weather Kiosk inside Gazebo
      const kioskGroup = new THREE.Group();
      kioskGroup.position.set(ox - 0.85, groundY + 0.18, oz - 0.45);
      const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 8)), mats.darkWood);
      pole.position.y = 0.75;
      const board = new THREE.Mesh(
        trackGeo(createRoundedBoxGeo(0.9, 0.62, 0.09, 0.03, 0.01)),
        mats.emeraldGlow.clone()
      );
      board.position.y = 1.48;
      board.rotation.y = -Math.PI * 0.35;
      const proxy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.5, 2.1, 1.5)),
        trackMat(new THREE.MeshBasicMaterial({ visible: false }))
      );
      proxy.position.y = 1.0;
      tagRaycastProxy(proxy, obj.id, [board]);
      kioskGroup.add(pole, board, proxy);
      scene.add(kioskGroup);
      raycastTargets.push(proxy);
      interactiveHighlights.set(obj.id, [board]);
    } else {
      const prop = buildInteractiveProp(obj, mats, geos);
      let propY = groundY;
      if (obj.id === 'calm_kit_open') propY = 0.46; // atop kitchen counter
      if (obj.id === 'calm_supplies_table') propY = -0.02; // sits cleanly over supplies table
      prop.group.position.set(ox, propY, oz);
      if (obj.id === 'calm_breaker') prop.group.rotation.y = Math.PI / 2;
      if (obj.id === 'calm_extinguisher') prop.group.rotation.y = -Math.PI / 2;
      scene.add(prop.group);
      prop.group.traverse((c) => {
        if (c.userData.interactiveId === obj.id) {
          raycastTargets.push(c);
        }
      });
      interactiveHighlights.set(obj.id, prop.highlightMeshes);
    }

    // Subtle botanical glow ring hovering near uncompleted learning stations
    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.32, 0.024, 8, 24)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x34d399,
          emissive: 0x10b981,
          emissiveIntensity: 0.75,
          transparent: true,
          opacity: 0.85,
        })
      )
    );
    ring.rotation.x = Math.PI / 2;
    const baseY = groundY + (obj.id === 'calm_kit_open' ? 1.48 : 0.16);
    ring.position.set(ox, baseY, oz);
    scene.add(ring);
    beaconRings.push({ id: obj.id, ring, baseY });
  }

  // --- WIND-SWAYING MEADOW GRASS & WILDFLOWERS (InstancedMesh + onBeforeCompile) ---
  const grassCount = quality === 'low' ? 160 : quality === 'medium' ? 320 : 520;
  const bladeGeo = trackGeo(new THREE.ConeGeometry(0.055, 0.38, 4));
  bladeGeo.translate(0, 0.19, 0);
  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      roughness: 0.78,
    })
  );
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTimeUniform;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.6 + instPos.x * 0.45 + instPos.z * 0.35) * 0.09 * smoothstep(0.0, 0.38, position.y);
        transformed.x += sway;
        transformed.z += sway * 0.5;
      #endif
      `
    );
  };
  const grassInst = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  grassInst.frustumCulled = false;
  let gIdx = 0;
  for (let i = 0; i < grassCount * 2 && gIdx < grassCount; i++) {
    const gx = 16.5 + ((i * 73.17) % 24.0);
    const gz = 1.5 + ((i * 41.89) % 23.5);
    // Avoid spawning grass in the brook channel or under the house
    if (gx > 23.6 && gx < 28.4) continue;
    if (gx < 16.4 && gz > 4.2 && gz < 22.3) continue;
    if (gx > 33.2 && gx < 38.4 && gz > 10.6 && gz < 15.8) continue;

    const gy = getCalmGroundHeightWorld(gx, gz);
    _dummy.position.set(gx, gy - 0.02, gz);
    _dummy.rotation.set(0, (i * 1.7) % Math.PI, 0);
    const sc = 0.75 + ((i * 19) % 7) * 0.11;
    _dummy.scale.set(sc, sc * (0.85 + (i % 3) * 0.2), sc);
    _dummy.updateMatrix();
    grassInst.setMatrixAt(gIdx, _dummy.matrix);
    _tempColor.setHSL(0.24 + (i % 5) * 0.014, 0.58, 0.44 + (i % 4) * 0.04);
    grassInst.setColorAt(gIdx, _tempColor);
    gIdx++;
  }
  grassInst.count = gIdx;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  scene.add(grassInst);

  // Wildflower clusters scattered around sunlit meadow
  const flowerCount = 85;
  const flowerGeo = trackGeo(new THREE.DodecahedronGeometry(0.085, 0));
  const flowerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
    })
  );
  const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  flowerInst.frustumCulled = false;
  const petalColors = [0xfef08a, 0xfbcfe8, 0xe0f2fe, 0xfed7aa];
  let fIdx = 0;
  for (let i = 0; i < flowerCount * 2 && fIdx < flowerCount; i++) {
    const fx = 16.8 + ((i * 53.3) % 23.0);
    const fz = 2.0 + ((i * 67.1) % 22.0);
    if (fx > 23.5 && fx < 28.5) continue;
    const fy = getCalmGroundHeightWorld(fx, fz);
    _dummy.position.set(fx, fy + 0.18, fz);
    _dummy.rotation.set(0, i * 0.7, 0);
    _dummy.scale.set(1, 0.55, 1);
    _dummy.updateMatrix();
    flowerInst.setMatrixAt(fIdx, _dummy.matrix);
    _tempColor.setHex(petalColors[i % petalColors.length]);
    flowerInst.setColorAt(fIdx, _tempColor);
    fIdx++;
  }
  flowerInst.count = fIdx;
  flowerInst.instanceMatrix.needsUpdate = true;
  if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
  flowerInst.computeBoundingSphere();
  scene.add(flowerInst);

  // --- DRIFTING SUNLIT 3D CLOUDS ---
  const cloudMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      emissive: 0xfefce8,
      emissiveIntensity: 0.16,
    })
  );
  const clouds: CloudGroup[] = [];
  for (let c = 0; c < 8; c++) {
    const cg = new THREE.Group();
    const lobes = 4 + (c % 2);
    for (let l = 0; l < lobes; l++) {
      const puff = new THREE.Mesh(
        trackGeo(createFoliageBlobGeo(1.7 + (l % 2) * 0.7, 0.95, 1.4, c * 3.1 + l)),
        cloudMat
      );
      puff.position.set((l - lobes / 2) * 1.45, (l % 2) * 0.45, ((l * 7) % 3 - 1) * 0.55);
      cg.add(puff);
    }
    cg.position.set(-22 + c * 11.5, 20 + (c % 3) * 3.2, -16 + (c % 4) * 14);
    scene.add(cg);
    clouds.push({
      group: cg,
      speed: 0.32 + (c % 3) * 0.12,
      minX: -36,
      maxX: 74,
    });
  }

  // --- FLYING 3D BIRDS IN THE SKY ---
  const birdMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
  const birds: BirdActor[] = [];
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.24, 0.08, 0.48, -0.02);
  wingShape.lineTo(0.42, -0.11);
  wingShape.quadraticCurveTo(0.18, -0.05, 0, -0.08);
  wingShape.closePath();
  const wingGeo = trackGeo(
    new THREE.ExtrudeGeometry(wingShape, { depth: 0.02, bevelEnabled: false })
  );
  wingGeo.rotateX(Math.PI / 2);

  for (let b = 0; b < 7; b++) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.045, 0.18, 4, 6)), birdMat);
    body.rotation.x = Math.PI / 2;

    const leftWing = new THREE.Group();
    const lwMesh = new THREE.Mesh(wingGeo, birdMat);
    lwMesh.scale.x = -1;
    leftWing.add(lwMesh);

    const rightWing = new THREE.Group();
    const rwMesh = new THREE.Mesh(wingGeo, birdMat);
    rightWing.add(rwMesh);

    root.add(body, leftWing, rightWing);
    scene.add(root);

    birds.push({
      root,
      leftWing,
      rightWing,
      centerX: 22 + (b % 3) * 5.5,
      centerZ: 10 + (b % 2) * 5.0,
      radiusX: 9 + (b % 4) * 3.2,
      radiusZ: 6.5 + (b % 3) * 2.8,
      baseY: 7.5 + (b % 4) * 1.4,
      speed: 0.22 + (b % 3) * 0.07,
      phase: b * 1.05,
      flapRate: 5.5 + (b % 3) * 0.9,
    });
  }

  // --- FLOATING SUNLIT GOLDEN POLLEN MOTES ---
  const moteCount = quality === 'low' ? 60 : 140;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = 15.5 + ((i * 37.7) % 25);
    motePos[i * 3 + 1] = 0.4 + ((i * 17.3) % 3.4);
    motePos[i * 3 + 2] = 2.0 + ((i * 53.9) % 22);
  }
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.08,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    })
  );
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  // --- ANIMATION UPDATE ---
  const update = (dt: number, elapsed: number, state: CalmEngineState, hoveredId: string | null) => {
    sharedTimeUniform.value = effectsReduced ? 0 : elapsed;

    // Slow ceiling fan spin
    ceilingFan.rotation.y += dt * (effectsReduced ? 0.5 : 1.4);

    // Gentle tree sway in breeze
    if (!effectsReduced) {
      for (const t of swayTrees) {
        t.group.rotation.z = t.baseRotZ + Math.sin(elapsed * 0.9 + t.phase) * 0.018;
        t.group.rotation.x = Math.cos(elapsed * 0.7 + t.phase) * 0.012;
      }
    }

    // Drifting 3D clouds
    for (const c of clouds) {
      c.group.position.x += c.speed * dt * (effectsReduced ? 0.35 : 1);
      if (c.group.position.x > c.maxX) c.group.position.x = c.minX;
    }

    // Soaring 3D birds with wing flaps
    for (const b of birds) {
      const ang = elapsed * b.speed + b.phase;
      const nx = b.centerX + Math.cos(ang) * b.radiusX;
      const nz = b.centerZ + Math.sin(ang) * b.radiusZ;
      const dx = -Math.sin(ang) * b.radiusX;
      const dz = Math.cos(ang) * b.radiusZ;
      b.root.position.set(nx, b.baseY + Math.sin(elapsed * 1.1 + b.phase) * 0.35, nz);
      b.root.rotation.y = Math.atan2(dx, dz);

      const flap = Math.sin(elapsed * b.flapRate + b.phase) * 0.55;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }

    // Drifting golden sunlit motes
    motes.visible = !effectsReduced;
    if (!effectsReduced) {
      const posAttr = moteGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i++) {
        let x = posAttr.getX(i) + Math.sin(elapsed * 0.6 + i) * dt * 0.14;
        let y = posAttr.getY(i) + dt * 0.06;
        if (y > 4.2) y = 0.4;
        if (x > 41) x = 15.5;
        posAttr.setXY(i, x, y);
      }
      posAttr.needsUpdate = true;
    }

    // Smooth door opening animations
    for (const d of doorEntries) {
      const isOpen = Boolean(state.doorOpenMap[d.id]);
      const target = isOpen ? 1 : 0;
      d.openProgress += (target - d.openProgress) * Math.min(1, dt * 6.5);
      d.hingePivot.rotation.y = -d.openProgress * Math.PI * 0.48;
    }

    // Subtle botanical highlight & beacon rings on learning stations
    for (const br of beaconRings) {
      const done = state.completedIds.includes(br.id);
      br.ring.visible = !done;
      if (!done) {
        br.ring.position.y = br.baseY + Math.sin(elapsed * 2.2) * 0.04;
        const sc = 1 + Math.sin(elapsed * 2.2) * 0.08;
        br.ring.scale.set(sc, sc, 1);
      }
    }

    const pulse = effectsReduced ? 0.55 : 0.45 + 0.3 * Math.sin(elapsed * 3.5);
    interactiveHighlights.forEach((meshes, id) => {
      const isHovered = id === hoveredId || state.nearestInteractive?.id === id;
      for (const m of meshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (!mat || !('emissive' in mat)) continue;
        if (isHovered) {
          mat.emissive.setHex(0x10b981);
          mat.emissiveIntensity = pulse;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    });
  };

  const setQuality = (nextQuality: GameSettings['graphicsQuality'], sw: boolean) => {
    quality = nextQuality;
    sunLight.castShadow = !sw && nextQuality !== 'low';
  };

  const setReducedEffects = (reduced: boolean) => {
    effectsReduced = reduced;
  };

  const dispose = () => {
    geos.disposeAll();
    disposeMaterialLibrary(mats);
    extraMats.forEach((m) => m.dispose());
    envRT.dispose();
  };

  return {
    scene,
    mats,
    raycastTargets,
    update,
    setQuality,
    setReducedEffects,
    dispose,
  };
}
