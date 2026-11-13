import * as THREE from 'three';
import { InteractiveKind, InteractiveObject } from '../game/types';
import {
  createCurtainGeo,
  createFoliageBlobGeo,
  createLeafGeo,
  createPillowGeo,
  createRoundedBoxGeo,
  createSedanBodyGeo,
  GeoTracker,
} from './geometryHelpers';
import { MaterialLibrary } from './materials';

function tagShadows(group: THREE.Object3D, cast = true, receive = true) {
  group.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
}

function track<T extends THREE.BufferGeometry>(g: T, geos?: GeoTracker): T {
  return geos ? geos.track(g) : g;
}

export function tagRaycastProxy(
  mesh: THREE.Object3D,
  interactiveId: string,
  highlightTargets: THREE.Mesh[]
) {
  mesh.layers.set(1);
  mesh.userData.interactiveId = interactiveId;
  mesh.userData.highlightTargets = highlightTargets;
}

function makeTurnedLegGeo(height: number, topR: number, botR: number): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(botR, 0),
    new THREE.Vector2(botR * 1.15, height * 0.08),
    new THREE.Vector2(botR * 0.85, height * 0.14),
    new THREE.Vector2(topR * 0.92, height * 0.82),
    new THREE.Vector2(topR * 1.15, height * 0.9),
    new THREE.Vector2(topR, height),
  ];
  return new THREE.LatheGeometry(pts, 10);
}

export function buildDiningChair(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(
    track(createRoundedBoxGeo(0.43, 0.055, 0.43, 0.05, 0.015), geos),
    mats.fabricSlate
  );
  seat.position.y = 0.45;
  const seatFrame = new THREE.Mesh(
    track(createRoundedBoxGeo(0.44, 0.035, 0.44, 0.04, 0.008), geos),
    mats.darkWood
  );
  seatFrame.position.y = 0.415;

  const legGeo = track(makeTurnedLegGeo(0.42, 0.024, 0.016), geos);
  for (const [lx, lz] of [
    [-0.17, -0.17],
    [0.17, -0.17],
    [-0.17, 0.17],
    [0.17, 0.17],
  ]) {
    const leg = new THREE.Mesh(legGeo, mats.darkWood);
    leg.position.set(lx, 0, lz);
    chair.add(leg);
  }

  // Slatted wooden backrest posts & curved top rail
  const postGeo = track(new THREE.CylinderGeometry(0.018, 0.022, 0.52, 8), geos);
  const postL = new THREE.Mesh(postGeo, mats.darkWood);
  postL.position.set(-0.18, 0.69, -0.19);
  postL.rotation.x = -0.07;
  const postR = postL.clone();
  postR.position.x = 0.18;

  const topRail = new THREE.Mesh(
    track(createRoundedBoxGeo(0.42, 0.09, 0.04, 0.02, 0.01), geos),
    mats.darkWood
  );
  topRail.position.set(0, 0.91, -0.205);
  topRail.rotation.x = -0.07;

  for (const sx of [-0.09, 0, 0.09]) {
    const slat = new THREE.Mesh(track(new THREE.CylinderGeometry(0.01, 0.01, 0.44, 6), geos), mats.oakWood);
    slat.position.set(sx, 0.67, -0.19);
    slat.rotation.x = -0.07;
    chair.add(slat);
  }

  chair.add(seat, seatFrame, postL, postR, topRail);
  return chair;
}

export function buildTableWithChairs(
  w: number,
  d: number,
  h: number,
  mats: MaterialLibrary,
  withChairs = true,
  geos?: GeoTracker
): THREE.Group {
  const g = new THREE.Group();
  const topThick = 0.075;

  // Chamfered/rounded tabletop
  const top = new THREE.Mesh(
    track(createRoundedBoxGeo(w, topThick, d, 0.06, 0.018), geos),
    mats.oakWood
  );
  top.position.y = h - topThick / 2;
  g.add(top);

  // Recessed apron frame underneath
  const apron = new THREE.Mesh(
    track(createRoundedBoxGeo(w - 0.14, 0.075, d - 0.14, 0.03, 0.008), geos),
    mats.darkWood
  );
  apron.position.y = h - topThick - 0.035;
  g.add(apron);

  // 4 lathe-turned corner legs
  const legGeo = track(makeTurnedLegGeo(h - topThick, 0.042, 0.024), geos);
  const offsets = [
    [-w / 2 + 0.1, -d / 2 + 0.1],
    [w / 2 - 0.1, -d / 2 + 0.1],
    [-w / 2 + 0.1, d / 2 - 0.1],
    [w / 2 - 0.1, d / 2 - 0.1],
  ];
  for (const [lx, lz] of offsets) {
    const leg = new THREE.Mesh(legGeo, mats.darkWood);
    leg.position.set(lx, 0, lz);
    g.add(leg);
  }

  // Centerpiece bowl, runner & mug
  if (withChairs) {
    const runner = new THREE.Mesh(
      track(createRoundedBoxGeo(w * 0.56, 0.012, d * 0.34, 0.02, 0.004), geos),
      mats.fabricNavy
    );
    runner.position.y = h + 0.006;

    const bowlPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.08, 0),
      new THREE.Vector2(0.14, 0.05),
      new THREE.Vector2(0.16, 0.1),
      new THREE.Vector2(0.145, 0.1),
      new THREE.Vector2(0.09, 0.02),
      new THREE.Vector2(0.001, 0.018),
    ];
    const bowl = new THREE.Mesh(track(new THREE.LatheGeometry(bowlPts, 14), geos), mats.porcelain);
    bowl.position.set(-w * 0.05, h + 0.01, 0);

    const mug = new THREE.Mesh(track(new THREE.CylinderGeometry(0.042, 0.036, 0.095, 10), geos), mats.porcelain);
    mug.position.set(w * 0.2, h + 0.048, d * 0.12);
    const mugHandle = new THREE.Mesh(track(new THREE.TorusGeometry(0.026, 0.007, 6, 12), geos), mats.porcelain);
    mugHandle.position.set(w * 0.2 + 0.04, h + 0.05, d * 0.12);
    g.add(runner, bowl, mug, mugHandle);

    const chairOffsets = [
      { x: -w * 0.25, z: -d / 2 - 0.26, ry: 0 },
      { x: w * 0.25, z: -d / 2 - 0.26, ry: 0 },
      { x: -w * 0.25, z: d / 2 + 0.26, ry: Math.PI },
      { x: w * 0.25, z: d / 2 + 0.26, ry: Math.PI },
    ];
    for (const c of chairOffsets) {
      const chair = buildDiningChair(mats, geos);
      chair.position.set(c.x, 0, c.z);
      chair.rotation.y = c.ry;
      g.add(chair);
    }
  } else {
    // Coffee table decor (book + saucer)
    const book = new THREE.Mesh(
      track(createRoundedBoxGeo(0.26, 0.032, 0.19, 0.01, 0.005), geos),
      mats.fabricNavy
    );
    book.position.set(-w * 0.14, h + 0.016, 0.04);
    book.rotation.y = 0.22;
    const candle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 12), geos), mats.porcelain);
    candle.position.set(w * 0.16, h + 0.045, -0.06);
    g.add(book, candle);
  }

  tagShadows(g, true, true);
  return g;
}

export function buildSofa(w: number, d: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  // 4 tapered wooden sofa legs
  const legGeo = track(new THREE.CylinderGeometry(0.032, 0.02, 0.14, 8), geos);
  for (const [lx, lz] of [
    [-w / 2 + 0.1, -d / 2 + 0.1],
    [w / 2 - 0.1, -d / 2 + 0.1],
    [-w / 2 + 0.1, d / 2 - 0.1],
    [w / 2 - 0.1, d / 2 - 0.1],
  ]) {
    const leg = new THREE.Mesh(legGeo, mats.darkWood);
    leg.position.set(lx, 0.07, lz);
    g.add(leg);
  }

  const base = new THREE.Mesh(
    track(createRoundedBoxGeo(w - 0.02, 0.16, d - 0.02, 0.04, 0.015), geos),
    mats.darkWood
  );
  base.position.y = 0.2;

  // Two plump rounded seat cushions
  const seatGeo = track(createRoundedBoxGeo(w - 0.16, 0.17, d * 0.45, 0.06, 0.028), geos);
  const seatL = new THREE.Mesh(seatGeo, mats.fabricSlate);
  seatL.position.set(0.05, 0.36, -d * 0.23);
  const seatR = new THREE.Mesh(seatGeo, mats.fabricSlate);
  seatR.position.set(0.05, 0.36, d * 0.23);

  // Sculpted backrest + tilted back cushions
  const backFrame = new THREE.Mesh(
    track(createRoundedBoxGeo(0.22, 0.62, d - 0.04, 0.06, 0.022), geos),
    mats.fabricSlate
  );
  backFrame.position.set(-w / 2 + 0.13, 0.56, 0);

  const backCushionGeo = track(createPillowGeo(0.18, 0.44, d * 0.42), geos);
  const backCushL = new THREE.Mesh(backCushionGeo, mats.fabricSlate);
  backCushL.position.set(-w / 2 + 0.27, 0.62, -d * 0.22);
  backCushL.rotation.z = -0.18;
  const backCushR = new THREE.Mesh(backCushionGeo, mats.fabricSlate);
  backCushR.position.set(-w / 2 + 0.27, 0.62, d * 0.22);
  backCushR.rotation.z = -0.18;

  // Rounded rolled armrests
  const armBaseGeo = track(createRoundedBoxGeo(w - 0.08, 0.32, 0.18, 0.04, 0.02), geos);
  const armRollGeo = track(new THREE.CylinderGeometry(0.11, 0.11, w - 0.06, 12), geos);
  armRollGeo.rotateZ(Math.PI / 2);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armBaseGeo, mats.fabricSlate);
    arm.position.set(0, 0.41, side * (d / 2 - 0.1));
    const roll = new THREE.Mesh(armRollGeo, mats.fabricSlate);
    roll.position.set(0, 0.57, side * (d / 2 - 0.1));
    g.add(arm, roll);
  }

  // Pinched throw pillows
  const pillowGeo = track(createPillowGeo(0.16, 0.3, 0.34), geos);
  const pillow1 = new THREE.Mesh(pillowGeo, mats.amberGlow);
  pillow1.position.set(-w / 2 + 0.4, 0.58, -d * 0.29);
  pillow1.rotation.set(0.14, 0.22, -0.32);
  const pillow2 = new THREE.Mesh(pillowGeo, mats.fabricNavy);
  pillow2.position.set(-w / 2 + 0.4, 0.57, d * 0.29);
  pillow2.rotation.set(-0.14, -0.22, -0.28);

  g.add(base, seatL, seatR, backFrame, backCushL, backCushR, pillow1, pillow2);
  tagShadows(g, true, true);
  return g;
}

export function buildBed(w: number, d: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  // Legs + rounded base frame
  const legGeo = track(new THREE.CylinderGeometry(0.038, 0.028, 0.16, 8), geos);
  for (const [lx, lz] of [
    [-w / 2 + 0.08, -d / 2 + 0.08],
    [w / 2 - 0.08, -d / 2 + 0.08],
    [-w / 2 + 0.08, d / 2 - 0.08],
    [w / 2 - 0.08, d / 2 - 0.08],
  ]) {
    const leg = new THREE.Mesh(legGeo, mats.darkWood);
    leg.position.set(lx, 0.08, lz);
    g.add(leg);
  }

  const frame = new THREE.Mesh(
    track(createRoundedBoxGeo(w, 0.18, d, 0.04, 0.015), geos),
    mats.darkWood
  );
  frame.position.y = 0.22;

  // Paneled headboard with corner posts
  const head = new THREE.Mesh(
    track(createRoundedBoxGeo(0.11, 0.88, d + 0.02, 0.03, 0.015), geos),
    mats.oakWood
  );
  head.position.set(-w / 2 + 0.06, 0.62, 0);
  const postGeo = track(new THREE.CylinderGeometry(0.045, 0.045, 1.14, 10), geos);
  const postL = new THREE.Mesh(postGeo, mats.darkWood);
  postL.position.set(-w / 2 + 0.06, 0.57, -d / 2 - 0.01);
  const postR = postL.clone();
  postR.position.z = d / 2 + 0.01;

  // Plush rounded mattress + draped folded blanket + pinched pillows
  const mattress = new THREE.Mesh(
    track(createRoundedBoxGeo(w - 0.16, 0.24, d - 0.1, 0.07, 0.03), geos),
    mats.fabricWhite
  );
  mattress.position.set(0.05, 0.41, 0);

  const blanket = new THREE.Mesh(
    track(createRoundedBoxGeo(w * 0.62, 0.255, d - 0.06, 0.07, 0.032), geos),
    mats.fabricNavy
  );
  blanket.position.set(w * 0.16, 0.415, 0);

  const fold = new THREE.Mesh(
    track(createRoundedBoxGeo(0.18, 0.05, d - 0.07, 0.03, 0.018), geos),
    mats.fabricWhite
  );
  fold.position.set(-w * 0.13, 0.535, 0);

  const pillowGeo = track(createPillowGeo(0.36, 0.14, 0.54), geos);
  const p1 = new THREE.Mesh(pillowGeo, mats.fabricWhite);
  p1.position.set(-w / 2 + 0.34, 0.58, -d * 0.22);
  p1.rotation.z = -0.14;
  const p2 = new THREE.Mesh(pillowGeo, mats.fabricWhite);
  p2.position.set(-w / 2 + 0.34, 0.58, d * 0.22);
  p2.rotation.z = -0.14;

  g.add(frame, head, postL, postR, mattress, blanket, fold, p1, p2);
  tagShadows(g, true, true);
  return g;
}

export function buildNightstandWithLamp(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    track(createRoundedBoxGeo(0.52, 0.56, 0.46, 0.03, 0.014), geos),
    mats.darkWood
  );
  body.position.y = 0.28;
  const top = new THREE.Mesh(
    track(createRoundedBoxGeo(0.56, 0.04, 0.5, 0.03, 0.012), geos),
    mats.oakWood
  );
  top.position.y = 0.57;
  const knob = new THREE.Mesh(track(new THREE.SphereGeometry(0.02, 8, 8), geos), mats.brass);
  knob.position.set(0.28, 0.42, 0);

  // Turned ceramic table lamp base + conical shade
  const basePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.08, 0),
    new THREE.Vector2(0.09, 0.06),
    new THREE.Vector2(0.05, 0.18),
    new THREE.Vector2(0.025, 0.22),
  ];
  const lampBase = new THREE.Mesh(track(new THREE.LatheGeometry(basePts, 12), geos), mats.porcelain);
  lampBase.position.y = 0.59;
  const shade = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 16, 1, false), geos),
    mats.amberGlow
  );
  shade.position.y = 0.87;
  g.add(body, top, knob, lampBase, shade);
  tagShadows(g, true, true);
  return g;
}

export function buildTVStand(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    track(createRoundedBoxGeo(0.45, 0.48, 1.85, 0.03, 0.014), geos),
    mats.darkWood
  );
  body.position.y = 0.28;
  for (const lz of [-0.82, 0.82]) {
    const leg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.02, 0.1, 8), geos), mats.darkMetal);
    leg.position.set(0, 0.05, lz);
    g.add(leg);
  }
  const standNeck = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.045, 0.2, 8), geos), mats.darkMetal);
  standNeck.position.set(0, 0.58, 0);
  const standFoot = new THREE.Mesh(
    track(createRoundedBoxGeo(0.24, 0.025, 0.52, 0.02, 0.006), geos),
    mats.darkMetal
  );
  standFoot.position.set(0, 0.53, 0);

  // Slim beveled flat-screen TV
  const frame = new THREE.Mesh(
    track(createRoundedBoxGeo(0.04, 0.72, 1.32, 0.02, 0.008), geos),
    mats.darkMetal
  );
  frame.position.set(0, 0.94, 0);
  const screen = new THREE.Mesh(track(new THREE.BoxGeometry(0.048, 0.65, 1.24), geos), mats.tvScreenMat);
  screen.position.set(0.005, 0.94, 0);

  // Ceramic vase next to TV
  const vasePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.055, 0),
    new THREE.Vector2(0.085, 0.12),
    new THREE.Vector2(0.042, 0.24),
    new THREE.Vector2(0.052, 0.28),
  ];
  const vase = new THREE.Mesh(track(new THREE.LatheGeometry(vasePts, 12), geos), mats.porcelain);
  vase.position.set(0, 0.52, 0.76);

  g.add(body, standNeck, standFoot, frame, screen, vase);
  tagShadows(g, true, true);
  return g;
}

export function buildKitchenCounter(w: number, d: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    track(createRoundedBoxGeo(w, 0.85, d, 0.03, 0.012), geos),
    mats.interiorWall
  );
  body.position.y = 0.425;

  const top = new THREE.Mesh(
    track(createRoundedBoxGeo(w + 0.05, 0.065, d + 0.05, 0.03, 0.016), geos),
    mats.darkMetal
  );
  top.position.y = 0.885;

  // Recessed cabinet doors & brass pulls
  for (let i = -1; i <= 1; i++) {
    const door = new THREE.Mesh(
      track(createRoundedBoxGeo(w * 0.28, 0.68, 0.032, 0.02, 0.008), geos),
      mats.oakWood
    );
    door.position.set(i * (w * 0.31), 0.44, d / 2 + 0.012);
    const pull = new THREE.Mesh(track(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6), geos), mats.brass);
    pull.position.set(i * (w * 0.31) + w * 0.09, 0.55, d / 2 + 0.035);
    g.add(door, pull);
  }

  // Stovetop + oven glass window + knobs
  const stove = new THREE.Mesh(
    track(createRoundedBoxGeo(0.78, 0.03, d - 0.12, 0.02, 0.006), geos),
    mats.darkMetal
  );
  stove.position.set(-w * 0.24, 0.925, 0);
  for (const bx of [-0.18, 0.18]) {
    for (const bz of [-0.14, 0.14]) {
      const burner = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), geos), mats.brushedMetal);
      burner.position.set(-w * 0.24 + bx, 0.945, bz);
      g.add(burner);
    }
  }
  const ovenWindow = new THREE.Mesh(track(new THREE.BoxGeometry(0.56, 0.34, 0.02), geos), mats.windowGlass);
  ovenWindow.position.set(-w * 0.24, 0.48, d / 2 + 0.032);
  g.add(ovenWindow);

  // Turned cooking pot with domed lid & handles
  const potPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.125, 0),
    new THREE.Vector2(0.135, 0.14),
    new THREE.Vector2(0.12, 0.17),
    new THREE.Vector2(0.001, 0.19),
  ];
  const pot = new THREE.Mesh(track(new THREE.LatheGeometry(potPts, 14), geos), mats.brushedMetal);
  pot.position.set(-w * 0.24 - 0.18, 0.955, 0.12);

  // Recessed sink basin + gooseneck curved TubeGeometry faucet
  const sink = new THREE.Mesh(
    track(createRoundedBoxGeo(0.64, 0.035, d - 0.22, 0.05, 0.008), geos),
    mats.brushedMetal
  );
  sink.position.set(w * 0.16, 0.92, 0);

  const faucetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(0, 0.3, 0.08),
    new THREE.Vector3(0, 0.24, 0.16),
  ]);
  const faucet = new THREE.Mesh(track(new THREE.TubeGeometry(faucetCurve, 12, 0.016, 8, false), geos), mats.brushedMetal);
  faucet.position.set(w * 0.16, 0.92, -d * 0.24);

  // Rounded microwave
  const micro = new THREE.Mesh(
    track(createRoundedBoxGeo(0.54, 0.34, 0.38, 0.03, 0.012), geos),
    mats.darkMetal
  );
  micro.position.set(w * 0.38, 1.09, -d * 0.1);
  const microWin = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.2, 0.02), geos), mats.windowGlass);
  microWin.position.set(w * 0.34, 1.09, -d * 0.1 + 0.19);

  // Upper wall cabinets with cornice
  const upperCab = new THREE.Mesh(
    track(createRoundedBoxGeo(w * 0.74, 0.72, d * 0.45, 0.02, 0.01), geos),
    mats.oakWood
  );
  upperCab.position.set(w * 0.1, 2.35, -d * 0.25);

  g.add(body, top, stove, pot, sink, faucet, micro, microWin, upperCab);
  tagShadows(g, true, true);
  return g;
}

export function buildFridge(w: number, d: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    track(createRoundedBoxGeo(w, 1.98, d, 0.05, 0.025), geos),
    mats.brushedMetal
  );
  body.position.y = 0.99;
  const seam = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.01, 0.025, d + 0.01), geos), mats.darkMetal);
  seam.position.y = 1.28;

  const hGeo = track(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 8), geos);
  const handle1 = new THREE.Mesh(hGeo, mats.darkMetal);
  handle1.position.set(-w * 0.34, 1.58, d / 2 + 0.035);
  const handle2 = new THREE.Mesh(hGeo, mats.darkMetal);
  handle2.position.set(-w * 0.34, 0.85, d / 2 + 0.035);

  const dispenser = new THREE.Mesh(
    track(createRoundedBoxGeo(0.24, 0.28, 0.04, 0.02, 0.008), geos),
    mats.darkMetal
  );
  dispenser.position.set(w * 0.08, 1.38, d / 2 + 0.005);

  g.add(body, seam, handle1, handle2, dispenser);
  tagShadows(g, true, true);
  return g;
}

export function buildBathroomSink(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const pedPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.11, 0.14),
    new THREE.Vector2(0.1, 0.7),
    new THREE.Vector2(0.26, 0.84),
    new THREE.Vector2(0.28, 0.92),
    new THREE.Vector2(0.22, 0.92),
    new THREE.Vector2(0.15, 0.8),
    new THREE.Vector2(0.001, 0.79),
  ];
  const basin = new THREE.Mesh(track(new THREE.LatheGeometry(pedPts, 16), geos), mats.porcelain);
  const faucetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.92, -0.18),
    new THREE.Vector3(0, 1.07, -0.16),
    new THREE.Vector3(0, 1.08, -0.05),
  ]);
  const faucet = new THREE.Mesh(track(new THREE.TubeGeometry(faucetCurve, 10, 0.014, 8, false), geos), mats.brushedMetal);

  const mirrorFrame = new THREE.Mesh(
    track(createRoundedBoxGeo(0.65, 0.82, 0.04, 0.03, 0.01), geos),
    mats.oakWood
  );
  mirrorFrame.position.set(0, 1.58, -0.25);
  const mirror = new THREE.Mesh(track(new THREE.BoxGeometry(0.55, 0.72, 0.045), geos), mats.windowGlass);
  mirror.position.set(0, 1.58, -0.245);

  g.add(basin, faucet, mirrorFrame, mirror);
  tagShadows(g, true, true);
  return g;
}

export function buildToilet(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const bowlPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.15, 0),
    new THREE.Vector2(0.12, 0.2),
    new THREE.Vector2(0.21, 0.4),
    new THREE.Vector2(0.17, 0.42),
    new THREE.Vector2(0.001, 0.24),
  ];
  const bowl = new THREE.Mesh(track(new THREE.LatheGeometry(bowlPts, 14), geos), mats.porcelain);
  bowl.position.z = 0.08;

  const seat = new THREE.Mesh(track(new THREE.TorusGeometry(0.16, 0.032, 8, 16), geos), mats.fabricWhite);
  seat.rotation.x = Math.PI / 2;
  seat.position.set(0, 0.42, 0.08);

  const tank = new THREE.Mesh(
    track(createRoundedBoxGeo(0.42, 0.44, 0.2, 0.04, 0.016), geos),
    mats.porcelain
  );
  tank.position.set(0, 0.62, -0.18);

  const lever = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.02, 0.03), geos), mats.brushedMetal);
  lever.position.set(-0.18, 0.78, -0.07);

  g.add(bowl, seat, tank, lever);
  tagShadows(g, true, true);
  return g;
}

export function buildBookshelf(w: number, d: number, h: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const back = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.04), geos), mats.darkWood);
  back.position.set(0, h / 2, -d / 2 + 0.02);

  const sideGeo = track(createRoundedBoxGeo(0.055, h, d, 0.015, 0.008), geos);
  const sideL = new THREE.Mesh(sideGeo, mats.oakWood);
  sideL.position.set(-w / 2 + 0.03, h / 2, 0);
  const sideR = new THREE.Mesh(sideGeo, mats.oakWood);
  sideR.position.set(w / 2 - 0.03, h / 2, 0);

  // Decorative top crown cornice
  const crown = new THREE.Mesh(
    track(createRoundedBoxGeo(w + 0.08, 0.07, d + 0.06, 0.02, 0.012), geos),
    mats.darkWood
  );
  crown.position.set(0, h + 0.01, 0.02);
  g.add(back, sideL, sideR, crown);

  const bookMats = [mats.redPaint, mats.fabricNavy, mats.amberGlow, mats.fabricSlate, mats.oakWood];
  const shelfCount = 4;
  for (let i = 0; i <= shelfCount; i++) {
    const sy = 0.06 + (i / shelfCount) * (h - 0.14);
    const shelf = new THREE.Mesh(
      track(createRoundedBoxGeo(w - 0.08, 0.042, d - 0.02, 0.012, 0.006), geos),
      mats.oakWood
    );
    shelf.position.set(0, sy, 0);
    g.add(shelf);

    if (i < shelfCount) {
      // Individual varied upright & tilted books instead of a single uniform rectangle
      let curX = -w / 2 + 0.14;
      const maxX = w / 2 - 0.14;
      let idx = 0;
      while (curX < maxX - 0.1) {
        if ((i + idx) % 5 === 3) {
          // Small ceramic vase or decorative box gap
          const vase = new THREE.Mesh(
            track(new THREE.CylinderGeometry(0.045, 0.06, 0.18, 10), geos),
            mats.porcelain
          );
          vase.position.set(curX + 0.08, sy + 0.11, 0.02);
          g.add(vase);
          curX += 0.22;
        } else {
          const bt = 0.038 + ((idx * 13 + i * 7) % 3) * 0.014;
          const bh = 0.21 + ((idx * 19 + i * 11) % 5) * 0.022;
          const bd = d * (0.58 + (idx % 2) * 0.12);
          const book = new THREE.Mesh(
            track(createRoundedBoxGeo(bt, bh, bd, 0.008, 0.003), geos),
            bookMats[(i * 3 + idx) % bookMats.length]
          );
          const lean = idx % 6 === 5 ? 0.18 : 0;
          book.position.set(curX + bt / 2 + lean * 0.08, sy + 0.02 + bh / 2, 0.02);
          book.rotation.z = -lean;
          g.add(book);
          curX += bt + 0.012 + (lean > 0 ? 0.04 : 0);
        }
        idx++;
      }
    }
  }

  tagShadows(g, true, true);
  return g;
}

export function buildOfficeDesk(w: number, d: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const h = 0.76;
  const top = new THREE.Mesh(
    track(createRoundedBoxGeo(w, 0.055, d, 0.05, 0.014), geos),
    mats.oakWood
  );
  top.position.y = h - 0.028;

  // Brushed steel tubular legs + modesty panel
  const legGeo = track(new THREE.CylinderGeometry(0.028, 0.024, h - 0.05, 8), geos);
  for (const [lx, lz] of [
    [-w / 2 + 0.09, -d / 2 + 0.09],
    [w / 2 - 0.09, -d / 2 + 0.09],
    [-w / 2 + 0.09, d / 2 - 0.09],
    [w / 2 - 0.09, d / 2 - 0.09],
  ]) {
    const leg = new THREE.Mesh(legGeo, mats.brushedMetal);
    leg.position.set(lx, (h - 0.05) / 2, lz);
    g.add(leg);
  }
  const modesty = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.18, 0.34, 0.025), geos), mats.darkMetal);
  modesty.position.set(0, 0.54, -d / 2 + 0.1);

  // Curved monitor stand + slim beveled widescreen monitor
  const standBase = new THREE.Mesh(
    track(createRoundedBoxGeo(0.24, 0.02, 0.16, 0.03, 0.006), geos),
    mats.darkMetal
  );
  standBase.position.set(0, h + 0.01, -d * 0.24);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, h + 0.02, -d * 0.25),
    new THREE.Vector3(0, h + 0.14, -d * 0.28),
    new THREE.Vector3(0, h + 0.24, -d * 0.22),
  ]);
  const neck = new THREE.Mesh(track(new THREE.TubeGeometry(neckCurve, 8, 0.022, 8, false), geos), mats.darkMetal);
  const bezel = new THREE.Mesh(
    track(createRoundedBoxGeo(0.68, 0.4, 0.032, 0.02, 0.008), geos),
    mats.darkMetal
  );
  bezel.position.set(0, h + 0.29, -d * 0.21);
  const screen = new THREE.Mesh(track(new THREE.BoxGeometry(0.63, 0.35, 0.038), geos), mats.skyGlow);
  screen.position.set(0, h + 0.29, -d * 0.21 + 0.004);

  // Keyboard, mouse, rounded PC tower & porcelain mug
  const kb = new THREE.Mesh(
    track(createRoundedBoxGeo(0.42, 0.02, 0.15, 0.012, 0.005), geos),
    mats.darkMetal
  );
  kb.position.set(-0.04, h + 0.01, 0.08);
  const mouse = new THREE.Mesh(
    track(createRoundedBoxGeo(0.065, 0.028, 0.1, 0.025, 0.01), geos),
    mats.darkMetal
  );
  mouse.position.set(0.26, h + 0.014, 0.08);

  const tower = new THREE.Mesh(
    track(createRoundedBoxGeo(0.2, 0.42, 0.42, 0.025, 0.01), geos),
    mats.darkMetal
  );
  tower.position.set(w * 0.34, h + 0.21, -d * 0.08);

  const mug = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), geos), mats.porcelain);
  mug.position.set(-w * 0.32, h + 0.045, 0.12);

  // Ergonomic 5-star caster swivel chair
  const cz = d / 2 + 0.32;
  const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(0.028, 0.032, 0.34, 8), geos), mats.brushedMetal);
  stem.position.set(0, 0.24, cz);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(
      track(createRoundedBoxGeo(0.04, 0.03, 0.28, 0.01, 0.005), geos),
      mats.darkMetal
    );
    arm.position.set(Math.sin(ang) * 0.13, 0.07, cz + Math.cos(ang) * 0.13);
    arm.rotation.y = ang;
    const wheel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 8), geos), mats.matteRubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(Math.sin(ang) * 0.24, 0.028, cz + Math.cos(ang) * 0.24);
    g.add(arm, wheel);
  }
  const seat = new THREE.Mesh(
    track(createRoundedBoxGeo(0.48, 0.075, 0.46, 0.06, 0.02), geos),
    mats.fabricSlate
  );
  seat.position.set(0, 0.45, cz);
  const backMesh = new THREE.Mesh(
    track(createRoundedBoxGeo(0.44, 0.52, 0.065, 0.06, 0.02), geos),
    mats.fabricSlate
  );
  backMesh.position.set(0, 0.74, cz + 0.22);
  backMesh.rotation.x = -0.1;

  g.add(top, modesty, standBase, neck, bezel, screen, kb, mouse, tower, mug, stem, seat, backMesh);
  tagShadows(g, true, true);
  return g;
}

export function buildCopier(w: number, d: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    track(createRoundedBoxGeo(w, 0.62, d, 0.04, 0.018), geos),
    mats.fabricWhite
  );
  base.position.y = 0.31;
  const upper = new THREE.Mesh(
    track(createRoundedBoxGeo(w * 0.94, 0.28, d * 0.92, 0.03, 0.014), geos),
    mats.brushedMetal
  );
  upper.position.y = 0.76;
  const lid = new THREE.Mesh(
    track(createRoundedBoxGeo(w * 0.92, 0.08, d * 0.88, 0.025, 0.01), geos),
    mats.darkMetal
  );
  lid.position.y = 0.94;
  const panel = new THREE.Mesh(
    track(createRoundedBoxGeo(0.28, 0.04, 0.16, 0.01, 0.005), geos),
    mats.skyGlow
  );
  panel.position.set(-w * 0.24, 0.92, d * 0.36);
  panel.rotation.x = 0.45;
  g.add(base, upper, lid, panel);
  tagShadows(g, true, true);
  return g;
}

export function buildVehicle(
  w: number,
  d: number,
  colorHex: number,
  isTruck: boolean,
  mats: MaterialLibrary,
  geos?: GeoTracker
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.24,
    metalness: 0.62,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14,
  });

  if (isTruck) {
    const chassis = new THREE.Mesh(
      track(createRoundedBoxGeo(w, 0.32, d - 0.08, 0.05, 0.02), geos),
      mats.darkMetal
    );
    chassis.position.y = 0.42;
    const cargo = new THREE.Mesh(
      track(createRoundedBoxGeo(w * 0.66, 1.38, d - 0.08, 0.06, 0.025), geos),
      mats.fabricWhite
    );
    cargo.position.set(-w * 0.14, 1.24, 0);
    const cab = new THREE.Mesh(
      track(createRoundedBoxGeo(w * 0.3, 1.04, d - 0.12, 0.08, 0.03), geos),
      bodyMat
    );
    cab.position.set(w * 0.33, 1.08, 0);
    const windshield = new THREE.Mesh(
      track(createRoundedBoxGeo(0.06, 0.52, d - 0.26, 0.02, 0.008), geos),
      mats.windowGlass
    );
    windshield.position.set(w * 0.48, 1.28, 0);
    windshield.rotation.z = 0.16;
    const grille = new THREE.Mesh(
      track(createRoundedBoxGeo(0.05, 0.36, d * 0.56, 0.02, 0.008), geos),
      mats.brushedMetal
    );
    grille.position.set(w * 0.48, 0.72, 0);
    g.add(chassis, cargo, cab, windshield, grille);
  } else {
    // Sculpted aerodynamic ExtrudeGeometry sedan silhouette
    const sedanBody = new THREE.Mesh(track(createSedanBodyGeo(w, d), geos), bodyMat);
    const cabinGlass = new THREE.Mesh(
      track(createRoundedBoxGeo(w * 0.48, 0.44, d - 0.18, 0.06, 0.02), geos),
      mats.windowGlass
    );
    cabinGlass.position.set(-w * 0.04, 1.04, 0);
    const grille = new THREE.Mesh(
      track(createRoundedBoxGeo(0.06, 0.2, d * 0.52, 0.03, 0.01), geos),
      mats.brushedMetal
    );
    grille.position.set(w * 0.485, 0.42, 0);
    const bumperR = new THREE.Mesh(
      track(createRoundedBoxGeo(0.1, 0.18, d - 0.04, 0.04, 0.015), geos),
      mats.darkMetal
    );
    bumperR.position.set(-w * 0.485, 0.34, 0);
    g.add(sedanBody, cabinGlass, grille, bumperR);
  }

  // 4 detailed wheels with rubber tires & multi-spoke alloy rims
  const tireGeo = track(new THREE.CylinderGeometry(0.32, 0.32, 0.23, 16), geos);
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = track(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 12), geos);
  rimGeo.rotateX(Math.PI / 2);
  const hubGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 0.27, 8), geos);
  hubGeo.rotateX(Math.PI / 2);
  for (const wx of [-w * 0.31, w * 0.31]) {
    for (const wz of [-d / 2 + 0.04, d / 2 - 0.04]) {
      const wheel = new THREE.Mesh(tireGeo, mats.matteRubber);
      wheel.position.set(wx, 0.32, wz);
      const rim = new THREE.Mesh(rimGeo, mats.brushedMetal);
      rim.position.set(wx, 0.32, wz);
      const hub = new THREE.Mesh(hubGeo, mats.darkMetal);
      hub.position.set(wx, 0.32, wz);
      g.add(wheel, rim, hub);
    }
  }

  // Side mirrors & headlights/taillights
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(
      track(createRoundedBoxGeo(0.11, 0.09, 0.15, 0.02, 0.008), geos),
      bodyMat
    );
    mirror.position.set(w * 0.22, 0.88, side * (d / 2 + 0.05));
    const hl = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 10, 8), geos), mats.amberGlow);
    hl.scale.set(0.45, 0.75, 1.3);
    hl.position.set(w * 0.48, 0.52, side * d * 0.33);
    const tl = new THREE.Mesh(track(createRoundedBoxGeo(0.05, 0.13, 0.22, 0.02, 0.008), geos), mats.redPaint);
    tl.position.set(-w * 0.485, 0.56, side * d * 0.33);
    g.add(mirror, hl, tl);
  }

  tagShadows(g, true, true);
  return g;
}

export function buildHouse(
  w: number,
  d: number,
  h: number,
  mats: MaterialLibrary,
  styleIdx = 0,
  geos?: GeoTracker
): THREE.Group {
  const g = new THREE.Group();
  const wallMat =
    styleIdx % 3 === 0 ? mats.exteriorWall : styleIdx % 3 === 1 ? mats.sidingWall : mats.stuccoWall;

  // Stone foundation plinth + main body
  const foundation = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.12, 0.32, d + 0.12), geos), mats.concreteFloor);
  foundation.position.y = 0.16;
  const walls = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d), geos), wallMat);
  walls.position.y = h / 2 + 0.15;
  g.add(foundation, walls);

  // Overhanging pitched roof + fascia eaves + chimney with cap
  const roofH = 1.65;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-d / 2 - 0.36, 0);
  roofShape.lineTo(0, roofH);
  roofShape.lineTo(d / 2 + 0.36, 0);
  roofShape.lineTo(d / 2 + 0.24, -0.08);
  roofShape.lineTo(0, roofH - 0.12);
  roofShape.lineTo(-d / 2 - 0.24, -0.08);
  roofShape.closePath();

  const roofGeo = track(new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.64, bevelEnabled: false }), geos);
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-w / 2 - 0.32, h + 0.14, 0);
  const roof = new THREE.Mesh(roofGeo, mats.roofTile);

  const chimney = new THREE.Mesh(track(new THREE.BoxGeometry(0.54, 1.25, 0.54), geos), mats.exteriorWall);
  chimney.position.set(w * 0.26, h + 1.15, -d * 0.18);
  const chimneyCap = new THREE.Mesh(
    track(createRoundedBoxGeo(0.68, 0.12, 0.68, 0.02, 0.01), geos),
    mats.concreteFloor
  );
  chimneyCap.position.set(w * 0.26, h + 1.8, -d * 0.18);
  g.add(roof, chimney, chimneyCap);

  // Paneled front door with stone stoop & awning
  const door = new THREE.Mesh(
    track(createRoundedBoxGeo(0.95, 2.05, 0.1, 0.02, 0.01), geos),
    mats.darkWood
  );
  door.position.set(0, 1.25, d / 2 + 0.03);
  const stoop = new THREE.Mesh(
    track(createRoundedBoxGeo(1.45, 0.28, 0.85, 0.03, 0.012), geos),
    mats.concreteFloor
  );
  stoop.position.set(0, 0.14, d / 2 + 0.42);
  const porchRoof = new THREE.Mesh(
    track(createRoundedBoxGeo(1.7, 0.1, 0.95, 0.02, 0.01), geos),
    mats.roofTile
  );
  porchRoof.position.set(0, 2.42, d / 2 + 0.45);
  porchRoof.rotation.x = 0.16;
  const colGeo = track(new THREE.CylinderGeometry(0.055, 0.065, 2.15, 8), geos);
  const colL = new THREE.Mesh(colGeo, mats.skirtingWood);
  colL.position.set(-0.7, 1.32, d / 2 + 0.78);
  const colR = colL.clone();
  colR.position.x = 0.7;
  g.add(door, stoop, porchRoof, colL, colR);

  // Shuttered framed windows (front + back) & optional balcony on style 1
  for (const wx of [-w * 0.29, w * 0.29]) {
    for (const side of [-1, 1]) {
      const fz = side * (d / 2 + 0.02);
      const frame = new THREE.Mesh(track(new THREE.BoxGeometry(1.0, 1.12, 0.09), geos), mats.skirtingWood);
      frame.position.set(wx, h * 0.56, fz);
      const glass = new THREE.Mesh(track(new THREE.BoxGeometry(0.84, 0.96, 0.11), geos), mats.amberGlow);
      glass.position.set(wx, h * 0.56, fz);
      const sill = new THREE.Mesh(
        track(createRoundedBoxGeo(1.12, 0.09, 0.18, 0.015, 0.008), geos),
        mats.concreteFloor
      );
      sill.position.set(wx, h * 0.56 - 0.56, fz + side * 0.04);
      // Window shutters
      const shutterL = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 1.06, 0.06), geos), mats.fabricNavy);
      shutterL.position.set(wx - 0.62, h * 0.56, fz);
      const shutterR = shutterL.clone();
      shutterR.position.x = wx + 0.62;
      g.add(frame, glass, sill, shutterL, shutterR);
    }
  }

  if (styleIdx % 2 === 1) {
    // Upper projecting balcony with railing
    const balcFloor = new THREE.Mesh(
      track(createRoundedBoxGeo(w * 0.54, 0.12, 0.9, 0.03, 0.012), geos),
      mats.concreteFloor
    );
    balcFloor.position.set(0, h * 0.78, d / 2 + 0.45);
    const balcRail = new THREE.Mesh(track(new THREE.BoxGeometry(w * 0.54, 0.05, 0.05), geos), mats.darkMetal);
    balcRail.position.set(0, h * 0.78 + 0.68, d / 2 + 0.88);
    g.add(balcFloor, balcRail);
  }

  tagShadows(g, true, true);
  return g;
}

export function buildCityBuilding(
  w: number,
  h: number,
  d: number,
  mats: MaterialLibrary,
  seed = 0,
  geos?: GeoTracker
): THREE.Group {
  const g = new THREE.Group();
  const wallMat = seed % 3 === 0 ? mats.exteriorWall : seed % 3 === 1 ? mats.concreteFloor : mats.sidingWall;

  // Lower street podium
  const podH = Math.min(4.2, h * 0.3);
  const podium = new THREE.Mesh(track(new THREE.BoxGeometry(w, podH, d), geos), mats.concreteFloor);
  podium.position.y = podH / 2;

  // Main tower shaft (stepped in slightly)
  const shaftH = h - podH - 1.6;
  const shaft = new THREE.Mesh(track(new THREE.BoxGeometry(w * 0.9, shaftH, d * 0.9), geos), wallMat);
  shaft.position.y = podH + shaftH / 2;

  // Horizontal window ribbon bands on shaft
  const floors = Math.max(2, Math.floor(shaftH / 3.1));
  for (let f = 0; f < floors; f++) {
    const wy = podH + 1.5 + f * 3.1;
    if (wy < podH + shaftH - 0.8) {
      const band = new THREE.Mesh(
        track(new THREE.BoxGeometry(w * 0.915, 1.35, d * 0.915), geos),
        mats.windowGlass
      );
      band.position.y = wy;
      g.add(band);
    }
  }

  // Upper cornice + penthouse setback + rooftop HVAC unit
  const cornice = new THREE.Mesh(
    track(createRoundedBoxGeo(w * 0.96, 0.38, d * 0.96, 0.04, 0.02), geos),
    mats.darkMetal
  );
  cornice.position.y = podH + shaftH;
  const pent = new THREE.Mesh(track(new THREE.BoxGeometry(w * 0.56, 1.5, d * 0.56), geos), mats.darkMetal);
  pent.position.y = podH + shaftH + 0.75;
  const hvac = new THREE.Mesh(
    track(createRoundedBoxGeo(1.4, 0.9, 1.2, 0.04, 0.02), geos),
    mats.brushedMetal
  );
  hvac.position.set(w * 0.14, podH + shaftH + 1.9, -d * 0.1);

  g.add(podium, shaft, cornice, pent, hvac);
  return g;
}

export function buildTree(height: number, mats: MaterialLibrary, seed = 0, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  // Flared root collar + curved organic trunk
  const rootFlare = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.17, 0.34, height * 0.14, 9), geos),
    mats.bark
  );
  rootFlare.position.y = height * 0.07;

  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, 0),
    new THREE.Vector3(Math.sin(seed) * 0.08, height * 0.25, Math.cos(seed) * 0.06),
    new THREE.Vector3(Math.sin(seed + 1.2) * 0.12, height * 0.55, Math.cos(seed + 1.2) * 0.08),
  ]);
  const trunk = new THREE.Mesh(
    track(new THREE.TubeGeometry(trunkCurve, 8, height * 0.036, 7, false), geos),
    mats.bark
  );
  g.add(rootFlare, trunk);

  // 3 natural angled limbs + organic multi-lobe foliage canopy (never stacked cones!)
  const branchAngles = [0.2 + seed, 2.3 + seed, 4.4 + seed];
  for (let i = 0; i < branchAngles.length; i++) {
    const a = branchAngles[i];
    const startY = height * (0.42 + i * 0.06);
    const endX = Math.cos(a) * height * 0.26;
    const endZ = Math.sin(a) * height * 0.26;
    const endY = height * (0.64 + (i % 2) * 0.08);
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, startY, 0),
      new THREE.Vector3(endX * 0.55, (startY + endY) * 0.52, endZ * 0.55),
      new THREE.Vector3(endX, endY, endZ),
    ]);
    const branch = new THREE.Mesh(
      track(new THREE.TubeGeometry(bCurve, 6, height * 0.018, 6, false), geos),
      mats.bark
    );
    const cluster = new THREE.Mesh(
      track(createFoliageBlobGeo(height * 0.24, height * 0.2, height * 0.24, seed + i * 1.7), geos),
      i % 2 === 0 ? mats.foliage : mats.foliageLight
    );
    cluster.position.set(endX * 1.05, endY + height * 0.08, endZ * 1.05);
    g.add(branch, cluster);
  }

  // Crown canopy clusters
  const crown = new THREE.Mesh(
    track(createFoliageBlobGeo(height * 0.28, height * 0.25, height * 0.27, seed + 5.1), geos),
    mats.foliageLight
  );
  crown.position.set(0, height * 0.82, 0);
  const crownTop = new THREE.Mesh(
    track(createFoliageBlobGeo(height * 0.19, height * 0.17, height * 0.19, seed + 8.3), geos),
    mats.foliage
  );
  crownTop.position.set(0.12, height * 0.94, -0.08);
  g.add(crown, crownTop);

  tagShadows(g, true, true);
  return g;
}

export function buildStreetLamp(
  mats: MaterialLibrary,
  withLight = false,
  geos?: GeoTracker
): { group: THREE.Group; light?: THREE.PointLight } {
  const g = new THREE.Group();
  const basePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.2, 0.28),
    new THREE.Vector2(0.12, 0.5),
    new THREE.Vector2(0.08, 0.6),
  ];
  const base = new THREE.Mesh(track(new THREE.LatheGeometry(basePts, 12), geos), mats.darkMetal);
  const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.085, 3.8, 10), geos), mats.darkMetal);
  post.position.y = 2.4;

  // Curved swan-neck TubeGeometry arm
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.25, 0),
    new THREE.Vector3(0.18, 4.68, 0),
    new THREE.Vector3(0.62, 4.74, 0),
    new THREE.Vector3(0.92, 4.52, 0),
  ]);
  const arm = new THREE.Mesh(track(new THREE.TubeGeometry(armCurve, 12, 0.036, 8, false), geos), mats.darkMetal);
  const head = new THREE.Mesh(
    track(createRoundedBoxGeo(0.4, 0.11, 0.24, 0.04, 0.015), geos),
    mats.darkMetal
  );
  head.position.set(0.95, 4.48, 0);
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 10, 8), geos), mats.amberGlow);
  bulb.scale.set(1.3, 0.45, 0.9);
  bulb.position.set(0.95, 4.42, 0);
  g.add(base, post, arm, head, bulb);

  let light: THREE.PointLight | undefined;
  if (withLight) {
    light = new THREE.PointLight(0xfde68a, 5.5, 16, 1.5);
    light.position.set(0.95, 4.18, 0);
    g.add(light);
  }
  tagShadows(g, true, true);
  return { group: g, light };
}

export function buildFireHydrant(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.14, 0.08),
    new THREE.Vector2(0.11, 0.14),
    new THREE.Vector2(0.11, 0.46),
    new THREE.Vector2(0.15, 0.5),
    new THREE.Vector2(0.13, 0.58),
    new THREE.Vector2(0.05, 0.68),
    new THREE.Vector2(0.001, 0.72),
  ];
  const body = new THREE.Mesh(track(new THREE.LatheGeometry(pts, 12), geos), mats.redPaint);
  const nozL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), geos), mats.brushedMetal);
  nozL.rotation.z = Math.PI / 2;
  nozL.position.y = 0.42;
  const nozF = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 8), geos), mats.brushedMetal);
  nozF.rotation.x = Math.PI / 2;
  nozF.position.set(0, 0.38, 0.1);
  g.add(body, nozL, nozF);
  tagShadows(g, true, true);
  return g;
}

export function buildDrainGrate(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    track(createRoundedBoxGeo(0.96, 0.04, 0.66, 0.03, 0.008), geos),
    mats.darkMetal
  );
  frame.position.y = 0.02;
  g.add(frame);
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(track(new THREE.BoxGeometry(0.045, 0.048, 0.54), geos), mats.brushedMetal);
    bar.position.set(i * 0.11, 0.03, 0);
    g.add(bar);
  }
  return g;
}

export function buildWallArt(w: number, h: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    track(createRoundedBoxGeo(w, h, 0.055, 0.02, 0.008), geos),
    mats.darkWood
  );
  frame.position.y = -h / 2;
  const matBoard = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.09, h - 0.09, 0.058), geos), mats.fabricWhite);
  matBoard.position.y = -h / 2;
  const art = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.18, h - 0.18, 0.062), geos), mats.artFrameCanvas);
  art.position.y = -h / 2;
  g.add(frame, matBoard, art);
  tagShadows(g, false, true);
  return g;
}

export function buildWallClock(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.024, 10, 24), geos), mats.darkMetal);
  const face = new THREE.Mesh(track(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), geos), mats.porcelain);
  face.rotation.x = Math.PI / 2;
  const handH = new THREE.Mesh(track(new THREE.BoxGeometry(0.018, 0.1, 0.01), geos), mats.darkMetal);
  handH.position.set(0.03, 0.03, 0.018);
  handH.rotation.z = -0.6;
  const handM = new THREE.Mesh(track(new THREE.BoxGeometry(0.014, 0.15, 0.01), geos), mats.redPaint);
  handM.position.set(-0.02, 0.05, 0.02);
  handM.rotation.z = 0.45;
  g.add(rim, face, handH, handM);
  return g;
}

export function buildWhiteboard(w: number, h: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    track(createRoundedBoxGeo(w, h, 0.045, 0.02, 0.008), geos),
    mats.brushedMetal
  );
  const board = new THREE.Mesh(track(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.05), geos), mats.whiteboardMat);
  const tray = new THREE.Mesh(track(new THREE.BoxGeometry(w * 0.7, 0.03, 0.08), geos), mats.brushedMetal);
  tray.position.set(0, -h / 2 + 0.02, 0.04);
  g.add(frame, board, tray);
  return g;
}

export function buildCurtains(winW: number, mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, winW + 0.55, 10), geos), mats.brass);
  rod.rotation.z = Math.PI / 2;
  rod.position.y = 1.05;
  for (const fx of [-(winW + 0.58) / 2, (winW + 0.58) / 2]) {
    const finial = new THREE.Mesh(track(new THREE.SphereGeometry(0.036, 8, 8), geos), mats.brass);
    finial.position.set(fx, 1.05, 0);
    g.add(finial);
  }
  const panelW = Math.min(0.85, winW * 0.36);
  const panelGeo = track(createCurtainGeo(panelW, 2.15, 5), geos);
  const leftPanel = new THREE.Mesh(panelGeo, mats.curtainFabric);
  leftPanel.position.set(-winW / 2 - panelW * 0.2, -0.02, 0.04);
  const rightPanel = new THREE.Mesh(panelGeo, mats.curtainFabric);
  rightPanel.position.set(winW / 2 + panelW * 0.2, -0.02, 0.04);
  g.add(rod, leftPanel, rightPanel);
  tagShadows(g, true, true);
  return g;
}

export function buildPottedPlant(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const potPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.15, 0),
    new THREE.Vector2(0.21, 0.32),
    new THREE.Vector2(0.24, 0.36),
    new THREE.Vector2(0.2, 0.36),
    new THREE.Vector2(0.18, 0.3),
    new THREE.Vector2(0.001, 0.29),
  ];
  const pot = new THREE.Mesh(track(new THREE.LatheGeometry(potPts, 14), geos), mats.roofTile);
  const soil = new THREE.Mesh(track(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12), geos), mats.bark);
  soil.position.y = 0.3;

  const leafGeo = track(createLeafGeo(0.42, 0.16), geos);
  const stemCount = 5;
  for (let s = 0; s < stemCount; s++) {
    const ang = (s / stemCount) * Math.PI * 2 + 0.3;
    const h = 0.56 + (s % 2) * 0.16;
    const sCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(Math.cos(ang) * 0.06, 0.45, Math.sin(ang) * 0.06),
      new THREE.Vector3(Math.cos(ang) * 0.12, h, Math.sin(ang) * 0.12),
    ]);
    const stem = new THREE.Mesh(track(new THREE.TubeGeometry(sCurve, 6, 0.012, 6, false), geos), mats.bark);
    g.add(stem);

    for (let l = 0; l < 3; l++) {
      const leaf = new THREE.Mesh(leafGeo, mats.leafMat);
      const lAng = ang + (l - 1) * 0.72;
      leaf.position.set(
        Math.cos(ang) * 0.11,
        0.48 + l * 0.11 + (s % 2) * 0.05,
        Math.sin(ang) * 0.11
      );
      leaf.rotation.y = lAng;
      leaf.rotation.x = 0.65 + l * 0.14;
      g.add(leaf);
    }
  }

  g.add(pot, soil);
  tagShadows(g, true, true);
  return g;
}

export function buildWaterCooler(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    track(createRoundedBoxGeo(0.42, 0.96, 0.42, 0.04, 0.015), geos),
    mats.porcelain
  );
  body.position.y = 0.48;
  const jugPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.08, 0),
    new THREE.Vector2(0.16, 0.1),
    new THREE.Vector2(0.16, 0.42),
    new THREE.Vector2(0.11, 0.48),
    new THREE.Vector2(0.001, 0.48),
  ];
  const jug = new THREE.Mesh(track(new THREE.LatheGeometry(jugPts, 14), geos), mats.windowGlass);
  jug.position.y = 0.96;
  const tap = new THREE.Mesh(track(createRoundedBoxGeo(0.14, 0.08, 0.07, 0.015, 0.006), geos), mats.skyGlow);
  tap.position.set(0, 0.82, 0.22);
  g.add(body, jug, tap);
  tagShadows(g, true, true);
  return g;
}

export function buildCeilingFan(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), geos), mats.darkMetal);
  rod.position.y = -0.14;
  const motor = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.14, 0.12, 14), geos), mats.brass);
  motor.position.y = -0.3;
  const bladeGeo = track(createRoundedBoxGeo(0.68, 0.018, 0.15, 0.04, 0.006), geos);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const blade = new THREE.Mesh(bladeGeo, mats.oakWood);
    blade.position.x = 0.44;
    blade.rotation.x = 0.14;
    arm.add(blade);
    arm.position.y = -0.3;
    arm.rotation.y = (i / 4) * Math.PI * 2;
    g.add(arm);
  }
  const lightBowl = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), geos),
    mats.amberGlow
  );
  lightBowl.position.y = -0.36;
  g.add(rod, motor, lightBowl);
  return g;
}

export function buildUtilityPole(mats: MaterialLibrary, geos?: GeoTracker): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.18, 6.2, 10), geos), mats.bark);
  pole.position.y = 3.1;
  const cross = new THREE.Mesh(
    track(createRoundedBoxGeo(1.9, 0.15, 0.15, 0.02, 0.01), geos),
    mats.darkWood
  );
  cross.position.y = 5.6;
  const braceL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6), geos), mats.darkMetal);
  braceL.position.set(-0.34, 5.32, 0);
  braceL.rotation.z = -0.7;
  const braceR = braceL.clone();
  braceR.position.x = 0.34;
  braceR.rotation.z = 0.7;

  const insL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.075, 0.2, 8), geos), mats.skyGlow);
  insL.position.set(-0.75, 5.75, 0);
  const insR = insL.clone();
  insR.position.x = 0.75;

  // Dangling snapped power cable curving to ground
  const wireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.75, 5.65, 0),
    new THREE.Vector3(-0.9, 2.8, 0.3),
    new THREE.Vector3(-0.4, 0.45, 0.65),
    new THREE.Vector3(0.35, 0.08, 0.45),
  ]);
  const wire = new THREE.Mesh(track(new THREE.TubeGeometry(wireCurve, 14, 0.018, 6, false), geos), mats.matteRubber);
  const arc = new THREE.Mesh(track(new THREE.TorusGeometry(0.95, 0.032, 6, 20), geos), mats.skyGlow);
  arc.rotation.x = Math.PI / 2;
  arc.position.y = 0.1;

  g.add(pole, cross, braceL, braceR, insL, insR, wire, arc);
  tagShadows(g, true, true);
  return g;
}

export function buildDoorAssembly(
  obj: InteractiveObject,
  w: number,
  d: number,
  isExitSign: boolean,
  isHotDoor: boolean,
  mats: MaterialLibrary,
  geos?: GeoTracker
): { group: THREE.Group; hingePivot: THREE.Group; proxy: THREE.Mesh; highlightMeshes: THREE.Mesh[] } {
  const g = new THREE.Group();
  const doorLen = Math.max(w, d);
  const doorHeight = 2.34;
  const alongZ = d > w;

  // Profiled door jamb posts + lintel header
  const lintel = new THREE.Mesh(
    track(
      createRoundedBoxGeo(
        alongZ ? 0.24 : doorLen + 0.22,
        0.15,
        alongZ ? doorLen + 0.22 : 0.24,
        0.02,
        0.01
      ),
      geos
    ),
    mats.skirtingWood
  );
  lintel.position.y = doorHeight + 0.075;
  const postGeo = track(new THREE.BoxGeometry(alongZ ? 0.22 : 0.11, doorHeight, alongZ ? 0.11 : 0.22), geos);
  const postA = new THREE.Mesh(postGeo, mats.skirtingWood);
  const postB = new THREE.Mesh(postGeo, mats.skirtingWood);
  if (alongZ) {
    postA.position.set(0, doorHeight / 2, -doorLen / 2 - 0.04);
    postB.position.set(0, doorHeight / 2, doorLen / 2 + 0.04);
  } else {
    postA.position.set(-doorLen / 2 - 0.04, doorHeight / 2, 0);
    postB.position.set(doorLen / 2 + 0.04, doorHeight / 2, 0);
  }
  g.add(lintel, postA, postB);

  if (isExitSign) {
    const signBox = new THREE.Mesh(
      track(createRoundedBoxGeo(0.64, 0.3, 0.1, 0.02, 0.008), geos),
      mats.darkMetal
    );
    signBox.position.set(0, doorHeight + 0.38, 0);
    const signFace = new THREE.Mesh(track(new THREE.BoxGeometry(0.58, 0.24, 0.11), geos), mats.exitSignMat);
    signFace.position.set(0, doorHeight + 0.38, 0);
    if (alongZ) {
      signBox.rotation.y = Math.PI / 2;
      signFace.rotation.y = Math.PI / 2;
    }
    g.add(signBox, signFace);
  }

  // Hinge Pivot Group at one edge
  const hingePivot = new THREE.Group();
  if (alongZ) {
    hingePivot.position.set(0, 0, -doorLen / 2);
  } else {
    hingePivot.position.set(-doorLen / 2, 0, 0);
  }

  const leafMat = isHotDoor
    ? mats.redPaint.clone()
    : isExitSign
      ? mats.emeraldGlow.clone()
      : mats.oakWood.clone();
  const leaf = new THREE.Mesh(
    track(
      createRoundedBoxGeo(alongZ ? 0.09 : doorLen, doorHeight, alongZ ? doorLen : 0.09, 0.02, 0.008),
      geos
    ),
    leafMat
  );
  if (alongZ) {
    leaf.position.set(0, doorHeight / 2, doorLen / 2);
  } else {
    leaf.position.set(doorLen / 2, doorHeight / 2, 0);
  }

  // Raised decorative recessed panels on door face + curved lever handle
  const panelGeo = track(
    createRoundedBoxGeo(
      alongZ ? 0.11 : doorLen * 0.62,
      0.78,
      alongZ ? doorLen * 0.62 : 0.11,
      0.02,
      0.006
    ),
    geos
  );
  const topPanel = new THREE.Mesh(panelGeo, mats.darkWood);
  const botPanel = new THREE.Mesh(panelGeo, mats.darkWood);
  topPanel.position.copy(leaf.position);
  topPanel.position.y = 1.68;
  botPanel.position.copy(leaf.position);
  botPanel.position.y = 0.65;

  const escutcheon = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), geos), mats.brass);
  const lever = new THREE.Mesh(track(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), geos), mats.brass);
  if (alongZ) {
    escutcheon.rotation.z = Math.PI / 2;
    escutcheon.position.set(0, 1.05, doorLen * 0.85);
    lever.rotation.x = Math.PI / 2;
    lever.position.set(0.07, 1.05, doorLen * 0.79);
  } else {
    escutcheon.rotation.x = Math.PI / 2;
    escutcheon.position.set(doorLen * 0.85, 1.05, 0);
    lever.rotation.z = Math.PI / 2;
    lever.position.set(doorLen * 0.79, 1.05, 0.07);
  }

  hingePivot.add(leaf, topPanel, botPanel, escutcheon, lever);
  g.add(hingePivot);

  const proxy = new THREE.Mesh(
    track(new THREE.BoxGeometry(alongZ ? 0.65 : doorLen + 0.2, doorHeight, alongZ ? doorLen + 0.2 : 0.65), geos),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  proxy.position.y = doorHeight / 2;
  tagRaycastProxy(proxy, obj.id, [leaf]);
  g.add(proxy);

  tagShadows(g, true, true);
  return { group: g, hingePivot, proxy, highlightMeshes: [leaf] };
}

export function buildInteractiveProp(
  obj: InteractiveObject,
  mats: MaterialLibrary,
  geos?: GeoTracker
): { group: THREE.Group; highlightMeshes: THREE.Mesh[] } {
  const g = new THREE.Group();
  const highlights: THREE.Mesh[] = [];

  if (obj.kind === 'emergency_kit') {
    const ped = new THREE.Mesh(
      track(createRoundedBoxGeo(0.68, 0.48, 0.54, 0.03, 0.015), geos),
      mats.darkWood
    );
    ped.position.y = 0.24;
    const bag = new THREE.Mesh(
      track(createRoundedBoxGeo(0.56, 0.36, 0.4, 0.06, 0.025), geos),
      mats.redPaint.clone()
    );
    bag.position.y = 0.66;
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0.84, 0),
      new THREE.Vector3(-0.08, 0.94, 0),
      new THREE.Vector3(0.08, 0.94, 0),
      new THREE.Vector3(0.12, 0.84, 0),
    ]);
    const handle = new THREE.Mesh(track(new THREE.TubeGeometry(handleCurve, 10, 0.018, 6, false), geos), mats.darkMetal);
    const crossV = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.2, 0.42), geos), mats.porcelain);
    crossV.position.y = 0.66;
    const crossH = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.08, 0.42), geos), mats.porcelain);
    crossH.position.y = 0.66;
    g.add(ped, bag, handle, crossV, crossH);
    highlights.push(bag);
  } else if (obj.kind === 'gas_valve' || obj.kind === 'breaker_panel') {
    const box = new THREE.Mesh(
      track(createRoundedBoxGeo(0.44, 0.58, 0.2, 0.025, 0.01), geos),
      obj.kind === 'gas_valve' ? mats.amberGlow.clone() : mats.darkMetal.clone()
    );
    box.position.y = 1.25;
    const pipe = new THREE.Mesh(track(new THREE.CylinderGeometry(0.028, 0.028, 1.4, 8), geos), mats.brushedMetal);
    pipe.position.set(0, 0.7, -0.04);
    const lever =
      obj.kind === 'gas_valve'
        ? new THREE.Mesh(track(new THREE.TorusGeometry(0.1, 0.02, 8, 14), geos), mats.redPaint.clone())
        : new THREE.Mesh(track(createRoundedBoxGeo(0.22, 0.07, 0.12, 0.015, 0.006), geos), mats.redPaint.clone());
    lever.position.set(0, 1.25, 0.13);
    g.add(pipe, box, lever);
    highlights.push(box, lever);
  } else if (obj.kind === 'radio' || obj.kind === 'phone') {
    const body = new THREE.Mesh(
      track(createRoundedBoxGeo(0.36, 0.22, 0.2, 0.03, 0.012), geos),
      mats.skyGlow.clone()
    );
    body.position.y = 0.92;
    const dial = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), geos), mats.brushedMetal);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(-0.08, 0.9, 0.11);
    const ant = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.012, 0.36, 6), geos), mats.brushedMetal);
    ant.position.set(0.12, 1.16, 0);
    g.add(body, dial, ant);
    highlights.push(body);
  } else if (obj.kind === 'fire_alarm') {
    const back = new THREE.Mesh(
      track(createRoundedBoxGeo(0.32, 0.44, 0.12, 0.025, 0.01), geos),
      mats.redPaint.clone()
    );
    back.position.y = 1.35;
    const lever = new THREE.Mesh(
      track(createRoundedBoxGeo(0.18, 0.12, 0.09, 0.015, 0.006), geos),
      mats.porcelain
    );
    lever.position.set(0, 1.32, 0.07);
    const beacon = new THREE.Mesh(track(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 12), geos), mats.amberGlow.clone());
    beacon.position.y = 1.66;
    g.add(back, lever, beacon);
    highlights.push(back, beacon);
  } else if (obj.kind === 'fire_extinguisher') {
    const tankPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.11, 0),
      new THREE.Vector2(0.12, 0.04),
      new THREE.Vector2(0.12, 0.46),
      new THREE.Vector2(0.08, 0.56),
      new THREE.Vector2(0.035, 0.6),
      new THREE.Vector2(0.001, 0.6),
    ];
    const cyl = new THREE.Mesh(track(new THREE.LatheGeometry(tankPts, 14), geos), mats.redPaint.clone());
    cyl.position.y = 0.36;
    const valve = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.045, 0.12, 8), geos), mats.brass);
    valve.position.y = 1.0;
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.03, 1.0, 0),
      new THREE.Vector3(0.16, 0.96, 0.06),
      new THREE.Vector3(0.17, 0.68, 0.08),
    ]);
    const hose = new THREE.Mesh(track(new THREE.TubeGeometry(hoseCurve, 10, 0.016, 6, false), geos), mats.matteRubber);
    const horn = new THREE.Mesh(track(new THREE.ConeGeometry(0.045, 0.12, 8), geos), mats.matteRubber);
    horn.position.set(0.17, 0.6, 0.08);
    g.add(cyl, valve, hose, horn);
    highlights.push(cyl);
  } else if (obj.kind === 'elevator') {
    const frame = new THREE.Mesh(
      track(createRoundedBoxGeo(2.55, 2.55, 0.28, 0.03, 0.015), geos),
      mats.darkMetal
    );
    frame.position.y = 1.27;
    const doorGeo = track(createRoundedBoxGeo(1.04, 2.22, 0.32, 0.02, 0.008), geos);
    const doorL = new THREE.Mesh(doorGeo, mats.brushedMetal);
    doorL.position.set(-0.54, 1.11, 0);
    const doorR = new THREE.Mesh(doorGeo, mats.brushedMetal);
    doorR.position.set(0.54, 1.11, 0);
    const warnBar = new THREE.Mesh(
      track(createRoundedBoxGeo(2.2, 0.22, 0.35, 0.02, 0.01), geos),
      mats.redPaint.clone()
    );
    warnBar.position.y = 2.26;
    g.add(frame, doorL, doorR, warnBar);
    highlights.push(warnBar);
  }

  const proxy = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.2, 1.9, 1.2), geos),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  proxy.position.y = 0.95;
  tagRaycastProxy(proxy, obj.id, highlights);
  g.add(proxy);

  tagShadows(g, true, true);
  return { group: g, highlightMeshes: highlights };
}

export type HandActionType = 'none' | 'door' | 'pickup' | 'radio' | 'cover' | 'interact';

export interface FirstPersonHandRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  activeAction: HandActionType;
  actionTimer: number;
  actionDuration: number;
  crouchBlend: number;
  coverBlend: number;
}

export function triggerHandAction(rig: FirstPersonHandRig, kind: InteractiveKind | null): void {
  if (!kind) {
    rig.activeAction = 'interact';
    rig.actionDuration = 0.36;
  } else if (kind === 'exit_door' || kind === 'stairs_exit' || kind === 'check_door') {
    rig.activeAction = 'door';
    rig.actionDuration = 0.52;
  } else if (kind === 'emergency_kit' || kind === 'fire_extinguisher') {
    rig.activeAction = 'pickup';
    rig.actionDuration = 0.55;
  } else if (kind === 'radio' || kind === 'phone') {
    rig.activeAction = 'radio';
    rig.actionDuration = 0.65;
  } else if (kind === 'cover_table') {
    rig.activeAction = 'cover';
    rig.actionDuration = 0.45;
  } else {
    rig.activeAction = 'interact';
    rig.actionDuration = 0.42;
  }
  rig.actionTimer = rig.actionDuration;
}

export function buildFirstPersonHands(mats: MaterialLibrary, geos?: GeoTracker): FirstPersonHandRig {
  const root = new THREE.Group();

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    const forearm = new THREE.Group();

    // Smooth cylindrical sleeve + ribbed cuff + tapered wrist + sculpted rounded palm + 4 fingers + thumb
    const sleeveGeo = track(new THREE.CylinderGeometry(0.052, 0.06, 0.42, 12), geos);
    sleeveGeo.rotateX(Math.PI / 2);
    const sleeve = new THREE.Mesh(sleeveGeo, mats.sleeve);
    sleeve.position.set(0, 0, 0.13);

    const cuffGeo = track(new THREE.CylinderGeometry(0.048, 0.052, 0.045, 12), geos);
    cuffGeo.rotateX(Math.PI / 2);
    const cuff = new THREE.Mesh(cuffGeo, mats.darkMetal);
    cuff.position.set(0, 0, -0.08);

    const wristGeo = track(new THREE.CylinderGeometry(0.036, 0.042, 0.065, 10), geos);
    wristGeo.rotateX(Math.PI / 2);
    const wrist = new THREE.Mesh(wristGeo, mats.skin);
    wrist.position.set(0, 0, -0.125);

    const palm = new THREE.Mesh(
      track(createRoundedBoxGeo(0.086, 0.046, 0.1, 0.018, 0.01), geos),
      mats.glove
    );
    palm.position.set(0, 0, -0.195);

    // 4 individual articulated capsule fingers
    const fingerGeo = track(new THREE.CapsuleGeometry(0.0085, 0.05, 4, 6), geos);
    fingerGeo.rotateX(Math.PI / 2);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(fingerGeo, mats.glove);
      const fx = -0.028 + f * 0.019;
      const lenScale = f === 1 || f === 2 ? 1.08 : f === 3 ? 0.86 : 0.96;
      finger.scale.set(1, 1, lenScale);
      finger.position.set(fx, -0.012, -0.265);
      finger.rotation.x = 0.38;
      forearm.add(finger);
    }

    const thumb = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.0105, 0.042, 4, 6), geos), mats.glove);
    thumb.rotation.x = Math.PI / 2;
    thumb.position.set(-side * 0.048, 0.01, -0.19);
    thumb.rotation.y = side * 0.55;
    forearm.add(sleeve, cuff, wrist, palm, thumb);

    if (side === -1) {
      // Responder watch bezel + glowing face on left wrist
      const strap = new THREE.Mesh(track(new THREE.TorusGeometry(0.04, 0.008, 6, 14), geos), mats.matteRubber);
      strap.position.set(0, 0, -0.115);
      const face = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12), geos), mats.amberGlow);
      face.position.set(0, 0.038, -0.115);
      forearm.add(strap, face);
    }

    if (side === 1) {
      // Knurled pocket flashlight in right hand
      const body = new THREE.Mesh(track(new THREE.CylinderGeometry(0.021, 0.024, 0.18, 12), geos), mats.darkMetal);
      body.rotation.x = Math.PI / 2;
      body.position.set(-0.018, 0.04, -0.2);
      const bezel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.027, 0.024, 0.03, 12), geos), mats.brushedMetal);
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(-0.018, 0.04, -0.29);
      const lens = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12), geos), mats.amberGlow);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(-0.018, 0.04, -0.302);
      forearm.add(body, bezel, lens);
    }

    shoulder.add(forearm);
    shoulder.position.set(side * 0.28, -0.27, -0.44);
    shoulder.rotation.set(0.14, side * -0.08, 0);
    return { shoulder, forearm };
  };

  const left = makeArm(-1);
  const right = makeArm(1);
  root.add(left.shoulder, right.shoulder);

  return {
    root,
    leftArm: left.shoulder,
    rightArm: right.shoulder,
    leftForearm: left.forearm,
    rightForearm: right.forearm,
    activeAction: 'none',
    actionTimer: 0,
    actionDuration: 0.4,
    crouchBlend: 0,
    coverBlend: 0,
  };
}

export function buildNpcAvatar(
  shirtHex: number,
  hairHex: number,
  mats: MaterialLibrary,
  geos?: GeoTracker
): { group: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh } {
  const ng = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtHex,
    roughness: 0.85,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairHex,
    roughness: 0.88,
  });

  const torso = new THREE.Mesh(
    track(createRoundedBoxGeo(0.42, 0.62, 0.23, 0.08, 0.03), geos),
    shirtMat
  );
  torso.position.y = 1.12;

  const neck = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), geos), mats.skin);
  neck.position.y = 1.46;

  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.155, 14, 12), geos), mats.skin);
  head.scale.set(0.92, 1.08, 0.96);
  head.position.y = 1.63;

  const hair = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.162, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), geos),
    hairMat
  );
  hair.position.set(0, 1.65, -0.015);
  hair.rotation.x = -0.18;

  const armGeo = track(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), geos);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.27, 1.1, 0);
  armL.rotation.z = 0.08;
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.27, 1.1, 0);
  armR.rotation.z = -0.08;

  const legGeo = track(new THREE.CapsuleGeometry(0.075, 0.58, 4, 8), geos);
  const legL = new THREE.Mesh(legGeo, mats.darkMetal);
  legL.position.set(-0.11, 0.39, 0);
  const legR = new THREE.Mesh(legGeo, mats.darkMetal);
  legR.position.set(0.11, 0.39, 0);

  ng.add(torso, neck, head, hair, armL, armR, legL, legR);
  tagShadows(ng, true, false);
  return { group: ng, legL, legR };
}

export function updateFirstPersonHands(
  rig: FirstPersonHandRig,
  dt: number,
  elapsed: number,
  params: {
    speedMag: number;
    walkPhase: number;
    runBlend: number;
    crouching: boolean;
    inCover: boolean;
    bracing: boolean;
    recoilIntensity: number;
    reducedMotion: boolean;
  }
): void {
  const motionScale = params.reducedMotion ? 0.35 : 1;
  rig.crouchBlend += ((params.crouching ? 1 : 0) - rig.crouchBlend) * Math.min(1, dt * 10);
  const shieldTarget = params.inCover || params.bracing ? 1 : 0;
  rig.coverBlend += (shieldTarget - rig.coverBlend) * Math.min(1, dt * 9);

  if (rig.actionTimer > 0) {
    rig.actionTimer = Math.max(0, rig.actionTimer - dt);
    if (rig.actionTimer === 0) rig.activeAction = 'none';
  }
  const actPhase =
    rig.actionDuration > 0 && rig.actionTimer > 0
      ? Math.sin((1 - rig.actionTimer / rig.actionDuration) * Math.PI)
      : 0;

  const moveFactor = Math.min(1, params.speedMag / 160);
  const walkAmp = (0.02 + params.runBlend * 0.032) * moveFactor * motionScale;
  const strideSin = Math.sin(params.walkPhase);
  const strideCos = Math.cos(params.walkPhase * 2);
  const breath = Math.sin(elapsed * 2.1) * 0.004 * motionScale;
  const recoil = params.recoilIntensity * 0.08 * motionScale;

  let lX = -0.28 - rig.crouchBlend * 0.04 + rig.coverBlend * 0.14;
  let lY = -0.27 - rig.crouchBlend * 0.05 + rig.coverBlend * 0.12 + breath + strideCos * walkAmp * 0.45 - recoil;
  let lZ = -0.44 - rig.coverBlend * 0.1 + strideSin * walkAmp * 1.15 + recoil * 0.5;
  let lRotX = 0.14 + params.runBlend * 0.16 * moveFactor + rig.coverBlend * 0.55 - recoil * 2.5;
  let lRotY = 0.08 + rig.coverBlend * 0.48;
  const lRotZ = 0;

  let rX = 0.28 + rig.crouchBlend * 0.04 - rig.coverBlend * 0.14;
  let rY = -0.27 - rig.crouchBlend * 0.05 + rig.coverBlend * 0.12 + breath + strideCos * walkAmp * 0.45 - recoil;
  let rZ = -0.44 - rig.coverBlend * 0.1 - strideSin * walkAmp * 1.15 + recoil * 0.5;
  let rRotX = 0.14 + params.runBlend * 0.16 * moveFactor + rig.coverBlend * 0.55 - recoil * 2.5;
  let rRotY = -0.08 - rig.coverBlend * 0.48;
  let rRotZ = 0;

  if (actPhase > 0) {
    if (rig.activeAction === 'door') {
      rZ -= actPhase * 0.26;
      rY += actPhase * 0.07;
      rX -= actPhase * 0.06;
      rRotX += actPhase * 0.35;
      rRotZ -= actPhase * 0.65;
    } else if (rig.activeAction === 'pickup') {
      lZ -= actPhase * 0.18;
      rZ -= actPhase * 0.22;
      lY -= actPhase * 0.1;
      rY -= actPhase * 0.1;
      lX += actPhase * 0.08;
      rX -= actPhase * 0.08;
      lRotX -= actPhase * 0.28;
      rRotX -= actPhase * 0.28;
    } else if (rig.activeAction === 'radio') {
      lX += actPhase * 0.14;
      lY += actPhase * 0.16;
      lZ -= actPhase * 0.12;
      lRotX += actPhase * 0.55;
      lRotY += actPhase * 0.35;
    } else if (rig.activeAction === 'cover') {
      lY += actPhase * 0.1;
      rY += actPhase * 0.1;
    } else {
      rZ -= actPhase * 0.24;
      rRotX += actPhase * 0.36;
      lZ -= actPhase * 0.08;
    }
  }

  rig.leftArm.position.set(lX, lY, lZ);
  rig.leftArm.rotation.set(lRotX, lRotY, lRotZ);
  rig.rightArm.position.set(rX, rY, rZ);
  rig.rightArm.rotation.set(rRotX, rRotY, rRotZ);
}
