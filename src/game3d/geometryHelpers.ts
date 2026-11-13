import * as THREE from 'three';

export class GeoTracker {
  private geos: THREE.BufferGeometry[] = [];
  private cache = new Map<string, THREE.BufferGeometry>();

  track<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  getOrCreate<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    const existing = this.cache.get(key);
    if (existing) return existing as T;
    const g = factory();
    this.cache.set(key, g);
    this.geos.push(g);
    return g;
  }

  disposeAll(): void {
    this.geos.forEach((g) => g.dispose());
    this.geos = [];
    this.cache.clear();
  }
}

/**
 * Creates a rounded, beveled rectangular box centered at the origin (0, 0, 0)
 * using ExtrudeGeometry with smooth edge bevels instead of sharp cube corners.
 */
export function createRoundedBoxGeo(
  w: number,
  h: number,
  d: number,
  radius = 0.04,
  bevelSize = 0.015,
  bevelSegments = 2
): THREE.ExtrudeGeometry {
  const safeBevel = Math.min(bevelSize, w * 0.18, h * 0.18, d * 0.18);
  const innerW = Math.max(0.01, w - safeBevel * 2);
  const innerH = Math.max(0.01, h - safeBevel * 2);
  const innerD = Math.max(0.01, d - safeBevel * 2);
  const r = Math.min(radius, innerW * 0.45, innerH * 0.45);

  const shape = new THREE.Shape();
  const hw = innerW / 2;
  const hh = innerH / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerD,
    bevelEnabled: safeBevel > 0.002,
    bevelThickness: safeBevel,
    bevelSize: safeBevel,
    bevelSegments,
    curveSegments: 5,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a soft bulging pillow / cushion geometry with pinched seams along edges.
 */
export function createPillowGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, 6, 3, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const hw = w / 2 || 1;
  const hd = d / 2 || 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / hw;
    const nz = z / hd;
    const edgeFactor = Math.max(0, 1 - nx * nx * 0.72) * Math.max(0, 1 - nz * nz * 0.72);
    // Pinch rim down & swell center vertically
    const ny = y * (0.28 + 1.05 * edgeFactor);
    // Slightly round horizontal corners inward
    const cornerPull = 1 - 0.08 * (nx * nx * nz * nz);
    pos.setXYZ(i, x * cornerPull, ny, z * cornerPull);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a pleated hanging curtain panel using harmonic cloth folds.
 */
export function createCurtainGeo(w: number, h: number, folds = 6): THREE.BufferGeometry {
  const segX = folds * 4;
  const segY = 8;
  const geo = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = (x / w + 0.5);
    const v = 0.5 - y / h; // 0 at top, 1 at bottom
    const ripple = Math.sin(u * Math.PI * folds * 2) * (0.045 + v * 0.028);
    // Slight inward gather near the middle/tieback
    const gather = 1 - Math.sin(v * Math.PI) * 0.14;
    pos.setXYZ(i, x * gather, y, ripple);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates an organic curved single botanical leaf blade.
 */
export function createLeafGeo(length: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(width * 0.7, length * 0.35, 0, length);
  shape.quadraticCurveTo(-width * 0.7, length * 0.35, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 5);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const t = ly / (length || 1);
    // Arch the leaf forward and curl edges slightly upward
    const droopZ = -Math.pow(t, 1.8) * length * 0.35 + Math.abs(lx) * 0.18;
    pos.setZ(i, droopZ);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a jagged multi-branch lightning/earthquake crack strip geometry.
 */
export function createJaggedCrackGeo(length: number, maxWidth = 0.065): THREE.BufferGeometry {
  const segs = 12;
  const shape = new THREE.Shape();
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = (t - 0.5) * length;
    const jitter = i === 0 || i === segs ? 0 : Math.sin(i * 3.7 + length) * 0.16;
    pts.push([x, jitter]);
  }
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const taper = Math.sin((i / segs) * Math.PI);
    shape.lineTo(pts[i][0], pts[i][1] + maxWidth * 0.5 * taper);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const taper = Math.sin((i / segs) * Math.PI);
    shape.lineTo(pts[i][0], pts[i][1] - maxWidth * 0.5 * taper);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Creates a sculpted aerodynamic sedan body silhouette via ExtrudeGeometry.
 */
export function createSedanBodyGeo(length: number, width: number): THREE.BufferGeometry {
  const hl = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hl * 0.96, 0.24);
  shape.lineTo(-hl * 0.98, 0.55); // rear bumper
  shape.lineTo(-hl * 0.88, 0.78); // trunk edge
  shape.lineTo(-hl * 0.56, 0.83); // rear deck
  shape.lineTo(-hl * 0.34, 1.32); // rear C-pillar
  shape.quadraticCurveTo(0, 1.4, hl * 0.24, 1.32); // curved roof
  shape.lineTo(hl * 0.52, 0.84); // raked windshield
  shape.quadraticCurveTo(hl * 0.86, 0.78, hl * 0.98, 0.54); // sloped hood & nose
  shape.lineTo(hl * 0.97, 0.24); // front bumper bottom
  shape.closePath();

  const innerW = Math.max(0.4, width - 0.14);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -innerW / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a displaced organic foliage canopy cluster (bumpy ellipsoid, never a sharp box/cone).
 */
export function createFoliageBlobGeo(rx: number, ry: number, rz: number, seed = 0): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n =
      1 +
      0.16 * Math.sin(vx * 3.7 + seed) * Math.cos(vz * 3.4 - seed) +
      0.1 * Math.sin(vy * 5.2 + vx * 2.1);
    pos.setXYZ(i, vx * rx * n, vy * ry * n, vz * rz * n);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
