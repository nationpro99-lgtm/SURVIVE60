import * as THREE from 'three';

export interface MaterialLibrary {
  woodFloor: THREE.MeshStandardMaterial;
  tileFloor: THREE.MeshStandardMaterial;
  carpetFloor: THREE.MeshStandardMaterial;
  roadFloor: THREE.MeshStandardMaterial;
  wetRoadFloor: THREE.MeshPhysicalMaterial;
  concreteFloor: THREE.MeshStandardMaterial;
  grassFloor: THREE.MeshStandardMaterial;
  highgroundFloor: THREE.MeshStandardMaterial;
  interiorWall: THREE.MeshStandardMaterial;
  exteriorWall: THREE.MeshStandardMaterial;
  stuccoWall: THREE.MeshStandardMaterial;
  sidingWall: THREE.MeshStandardMaterial;
  wetBrickWall: THREE.MeshStandardMaterial;
  charredWood: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  oakWood: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  skirtingWood: THREE.MeshStandardMaterial;
  fabricSlate: THREE.MeshStandardMaterial;
  fabricNavy: THREE.MeshStandardMaterial;
  fabricWhite: THREE.MeshStandardMaterial;
  curtainFabric: THREE.MeshStandardMaterial;
  rugFabric: THREE.MeshStandardMaterial;
  porcelain: THREE.MeshStandardMaterial;
  matteRubber: THREE.MeshStandardMaterial;
  brushedMetal: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  windowGlass: THREE.MeshPhysicalMaterial;
  tvScreenMat: THREE.MeshPhysicalMaterial;
  waterSurface: THREE.MeshStandardMaterial;
  redPaint: THREE.MeshStandardMaterial;
  emeraldGlow: THREE.MeshStandardMaterial;
  amberGlow: THREE.MeshStandardMaterial;
  skyGlow: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  foliageLight: THREE.MeshStandardMaterial;
  leafMat: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  roofTile: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  glove: THREE.MeshStandardMaterial;
  exitSignMat: THREE.MeshStandardMaterial;
  artFrameCanvas: THREE.MeshStandardMaterial;
  whiteboardMat: THREE.MeshStandardMaterial;
  flameSheetMat: THREE.MeshBasicMaterial;
  smokePuffMat: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
  materials: THREE.Material[];
}

function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  srgb = true,
  clamp = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createMaterialLibrary(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  quality: 'low' | 'medium' | 'high' = 'high'
): MaterialLibrary {
  const maxAniso =
    quality === 'low' || isSoftwareGl
      ? 2
      : Math.min(quality === 'high' ? 16 : 8, renderer.capabilities.getMaxAnisotropy() || 1);

  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const regTex = (t: THREE.CanvasTexture) => {
    textures.push(t);
    return t;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Natural Oak Hardwood Planks (Albedo + Bump)
  const woodTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#735035';
        ctx.fillRect(0, 0, s, s);
        const plankH = 64;
        for (let y = 0; y < s; y += plankH) {
          const idx = y / plankH;
          const shade = ((idx * 17) % 18) - 9;
          ctx.fillStyle = `rgb(${118 + shade}, ${82 + shade}, ${54 + shade})`;
          ctx.fillRect(0, y, s, plankH - 2);
          // Organic wavy grain + knots
          ctx.strokeStyle = 'rgba(42, 24, 12, 0.22)';
          ctx.lineWidth = 1.6;
          for (let g = 6; g < plankH - 4; g += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y + g);
            ctx.bezierCurveTo(s * 0.28, y + g + 3, s * 0.68, y + g - 3, s, y + g);
            ctx.stroke();
          }
          // Subtle plank knot
          if (idx % 3 === 1) {
            ctx.fillStyle = 'rgba(42, 24, 12, 0.25)';
            ctx.beginPath();
            ctx.ellipse((idx * 97) % (s - 60) + 30, y + plankH * 0.5, 11, 5, 0.1, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#2a180b';
          ctx.fillRect(0, y + plankH - 2, s, 2);
          const stagger = ((idx % 2) * 256 + 128) % s;
          ctx.fillRect(stagger, y, 3, plankH);
        }
      },
      5,
      5,
      maxAniso,
      true
    )
  );

  const woodBumpTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(0, 0, s, s);
        const plankH = 64;
        for (let y = 0; y < s; y += plankH) {
          ctx.strokeStyle = '#9a9a9a';
          ctx.lineWidth = 1.5;
          for (let g = 8; g < plankH - 4; g += 9) {
            ctx.beginPath();
            ctx.moveTo(0, y + g);
            ctx.lineTo(s, y + g + (g % 2 === 0 ? 2 : -2));
            ctx.stroke();
          }
          ctx.fillStyle = '#202020';
          ctx.fillRect(0, y + plankH - 2, s, 2);
        }
      },
      5,
      5,
      maxAniso,
      false
    )
  );

  // 2. Natural Stone Ceramic Tile (Albedo + Grout Bump)
  const tileTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#8b97a6';
        ctx.fillRect(0, 0, s, s);
        const cell = 128;
        for (let y = 0; y < s; y += cell) {
          for (let x = 0; x < s; x += cell) {
            const alt = ((x + y) / cell) % 2 === 0;
            const tone = alt ? 186 : 164;
            ctx.fillStyle = `rgb(${tone}, ${tone + 8}, ${tone + 18})`;
            ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
            // Subtle stone veining & wear speckles
            for (let k = 0; k < 24; k++) {
              ctx.fillStyle = k % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(30,41,59,0.06)';
              ctx.fillRect(
                x + 8 + ((k * 37) % (cell - 20)),
                y + 8 + ((k * 53) % (cell - 20)),
                6,
                2
              );
            }
          }
        }
        ctx.strokeStyle = '#4e5b6c';
        ctx.lineWidth = 4;
        for (let i = 0; i <= s; i += cell) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(s, i);
          ctx.stroke();
        }
      },
      7,
      7,
      maxAniso,
      true
    )
  );

  const tileBumpTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#363636';
        ctx.lineWidth = 5;
        const cell = 128;
        for (let i = 0; i <= s; i += cell) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(s, i);
          ctx.stroke();
        }
      },
      7,
      7,
      maxAniso,
      false
    )
  );

  // 3. Woven Fabric & Carpet Weave (Albedo + Micro-weave Bump)
  const fabricBumpTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 4) {
          for (let x = 0; x < s; x += 4) {
            const v = (x + y) % 8 === 0 ? 158 : 102;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 3, 3);
          }
        }
      },
      10,
      10,
      maxAniso,
      false
    )
  );

  const carpetTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#364457';
        ctx.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 4) {
          for (let x = 0; x < s; x += 4) {
            const v = ((x + y) % 8 === 0 ? 7 : -6) + Math.floor(Math.random() * 10);
            ctx.fillStyle = `rgb(${54 + v}, ${68 + v}, ${87 + v})`;
            ctx.fillRect(x, y, 3, 3);
          }
        }
      },
      8,
      8,
      maxAniso,
      true
    )
  );

  // 4. Area Rug Pattern Texture
  const rugTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 18;
        ctx.strokeRect(24, 24, s - 48, s - 48);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 6;
        ctx.strokeRect(48, 48, s - 96, s - 96);
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(72, 72, s - 144, s - 144);
        // Center diamond medallion
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(s / 2, 110);
        ctx.lineTo(s - 110, s / 2);
        ctx.lineTo(s / 2, s - 110);
        ctx.lineTo(110, s / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 4;
        ctx.stroke();
      },
      1,
      1,
      maxAniso,
      true,
      true
    )
  );

  // 5. Asphalt Road + Street Markings + Grit Bump
  const roadTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#28303d';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 4000; i++) {
          const v = 30 + Math.floor(Math.random() * 38);
          ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
        }
        // Dashed lane markings & subtle tire wear tracks
        ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.fillRect(s * 0.22, 0, 64, s);
        ctx.fillRect(s * 0.68, 0, 64, s);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.55)';
        ctx.fillRect(s * 0.488, 20, 12, 170);
        ctx.fillRect(s * 0.488, 276, 12, 170);
      },
      7,
      7,
      maxAniso,
      true
    )
  );

  const asphaltBumpTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 2800; i++) {
          const v = 65 + Math.floor(Math.random() * 125);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
      },
      14,
      14,
      maxAniso,
      false
    )
  );

  // 6. Concrete Sidewalk Slabs
  const concreteTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#778393';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1800; i++) {
          const v = 98 + Math.floor(Math.random() * 38);
          ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
        }
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, s - 4, s - 4);
        ctx.beginPath();
        ctx.moveTo(s / 2, 0);
        ctx.lineTo(s / 2, s);
        ctx.moveTo(0, s / 2);
        ctx.lineTo(s, s / 2);
        ctx.stroke();
      },
      10,
      10,
      maxAniso,
      true
    )
  );

  // 7. Grass & Organic Earth Texture
  const grassTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#2d4c25';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 4200; i++) {
          const g = 52 + Math.floor(Math.random() * 58);
          ctx.fillStyle = `rgb(${28 + Math.floor(Math.random() * 24)}, ${g}, ${20 + Math.floor(Math.random() * 18)})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 5);
        }
      },
      16,
      16,
      maxAniso,
      true
    )
  );

  // 8. Painted Drywall Plaster (clean upper-to-lower gradient, real 3D skirting handles baseboard!)
  const wallTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, 0, s);
        grad.addColorStop(0, '#c2ccd8');
        grad.addColorStop(0.15, '#dce3ec');
        grad.addColorStop(0.85, '#cfd8e4');
        grad.addColorStop(1, '#b6c1cf');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 2400; i++) {
          const v = 196 + Math.floor(Math.random() * 34);
          ctx.fillStyle = `rgba(${v}, ${v + 3}, ${v + 7}, 0.28)`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
        }
      },
      2,
      1,
      maxAniso,
      true
    )
  );

  // 9. Brick Exterior & Clapboard Siding & Stucco
  const brickTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#6c7580';
        ctx.fillRect(0, 0, s, s);
        const bh = 32;
        const bw = 64;
        for (let y = 0; y < s; y += bh) {
          const offset = ((y / bh) % 2) * (bw / 2);
          for (let x = -bw; x < s + bw; x += bw) {
            const shade = Math.floor(Math.random() * 26) - 13;
            ctx.fillStyle = `rgb(${118 + shade}, ${74 + shade}, ${62 + shade})`;
            ctx.fillRect(x + offset + 2, y + 2, bw - 4, bh - 4);
          }
        }
      },
      4,
      2,
      maxAniso,
      true
    )
  );

  const brickBumpTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#323232';
        ctx.fillRect(0, 0, s, s);
        const bh = 32;
        const bw = 64;
        ctx.fillStyle = '#e0e0e0';
        for (let y = 0; y < s; y += bh) {
          const offset = ((y / bh) % 2) * (bw / 2);
          for (let x = -bw; x < s + bw; x += bw) {
            ctx.fillRect(x + offset + 3, y + 3, bw - 6, bh - 6);
          }
        }
      },
      4,
      2,
      maxAniso,
      false
    )
  );

  const sidingTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(0, 0, s, s);
        const plank = 32;
        for (let y = 0; y < s; y += plank) {
          const grad = ctx.createLinearGradient(0, y, 0, y + plank);
          grad.addColorStop(0, '#94a3b8');
          grad.addColorStop(0.82, '#7c8b9e');
          grad.addColorStop(1, '#475569');
          ctx.fillStyle = grad;
          ctx.fillRect(0, y, s, plank);
        }
      },
      3,
      2,
      maxAniso,
      true
    )
  );

  const stuccoTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#d6cab8';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 2000; i++) {
          const v = 188 + Math.floor(Math.random() * 44);
          ctx.fillStyle = `rgb(${v}, ${v - 10}, ${v - 26})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
        }
      },
      3,
      2,
      maxAniso,
      true
    )
  );

  // 10. Acoustic Ceiling Grid Texture
  const ceilingTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#2d394b';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#192230';
        ctx.lineWidth = 4;
        const step = 64;
        for (let i = 0; i <= s; i += step) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(s, i);
          ctx.stroke();
        }
      },
      12,
      10,
      maxAniso,
      true
    )
  );

  // 11. Water Ripple Bump Texture
  const waterBumpTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 5) {
          for (let x = 0; x < s; x += 5) {
            const v = Math.floor(
              128 +
                Math.sin(x * 0.14 + y * 0.05) * 55 +
                Math.cos(y * 0.18 - x * 0.06) * 46
            );
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, 5, 5);
          }
        }
      },
      14,
      14,
      maxAniso,
      false
    )
  );

  // 12. EXIT Sign, Wall Art, Whiteboard, Organic Flame & Feathered Smoke Textures
  const exitTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, s - 16, s - 16);
        ctx.fillStyle = '#6ee7b7';
        ctx.font = '900 84px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIT', s / 2, s / 2 + 4);
      },
      1,
      1,
      maxAniso,
      true,
      true
    )
  );

  const artTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, '#1e3a5f');
        g.addColorStop(0.55, '#f59e0b');
        g.addColorStop(0.56, '#1e293b');
        g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(s * 0.65, s * 0.36, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, s * 0.72);
        ctx.lineTo(s * 0.35, s * 0.48);
        ctx.lineTo(s * 0.65, s * 0.68);
        ctx.lineTo(s, s * 0.52);
        ctx.lineTo(s, s);
        ctx.lineTo(0, s);
        ctx.closePath();
        ctx.fill();
      },
      1,
      1,
      maxAniso,
      true,
      true
    )
  );

  const whiteboardTex = regTex(
    makeCanvasTexture(
      512,
      (ctx, s) => {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, s - 16, s - 16);
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('FLOOR 4 EVACUATION PLAN', 34, 62);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 4;
        ctx.strokeRect(46, 98, 220, 180);
        ctx.strokeStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(90, 220);
        ctx.lineTo(180, 220);
        ctx.lineTo(180, 120);
        ctx.lineTo(350, 120);
        ctx.stroke();
        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('NORTH STAIRS ->', 260, 165);
        ctx.fillStyle = '#334155';
        ctx.font = '20px sans-serif';
        ctx.fillText('• DO NOT USE ELEVATORS', 46, 330);
        ctx.fillText('• STAY LOW UNDER SMOKE', 46, 368);
      },
      1,
      1,
      maxAniso,
      true,
      true
    )
  );

  const flameTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        // Layered organic flame silhouette
        const outer = ctx.createRadialGradient(s * 0.5, s * 0.72, 10, s * 0.5, s * 0.54, s * 0.45);
        outer.addColorStop(0, 'rgba(255, 250, 205, 0.98)');
        outer.addColorStop(0.28, 'rgba(251, 146, 60, 0.92)');
        outer.addColorStop(0.62, 'rgba(220, 38, 38, 0.58)');
        outer.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.moveTo(s * 0.5, s * 0.05);
        ctx.bezierCurveTo(s * 0.82, s * 0.35, s * 0.88, s * 0.85, s * 0.5, s * 0.96);
        ctx.bezierCurveTo(s * 0.12, s * 0.85, s * 0.18, s * 0.35, s * 0.5, s * 0.05);
        ctx.fill();
      },
      1,
      1,
      maxAniso,
      true,
      true
    )
  );

  const smokeTex = regTex(
    makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        const g = ctx.createRadialGradient(s / 2, s / 2, 12, s / 2, s / 2, s * 0.48);
        g.addColorStop(0, 'rgba(38, 44, 56, 0.82)');
        g.addColorStop(0.55, 'rgba(30, 36, 46, 0.45)');
        g.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      },
      1,
      1,
      maxAniso,
      true,
      true
    )
  );

  const windowGlass = regMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xa5d8ff,
      metalness: 0.06,
      roughness: 0.06,
      transparent: true,
      opacity: isSoftwareGl ? 0.36 : 0.46,
      transmission: isSoftwareGl ? 0 : 0.58,
      ior: 1.5,
      reflectivity: 0.92,
      clearcoat: 1.0,
      depthWrite: false,
    })
  );

  const tvScreenMat = regMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b1220,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.4,
    })
  );

  const wetRoadFloor = regMat(
    new THREE.MeshPhysicalMaterial({
      map: roadTex,
      bumpMap: asphaltBumpTex,
      bumpScale: 0.015,
      roughness: 0.16,
      metalness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.55,
    })
  );

  const waterSurface = regMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b5e8a,
      roughness: 0.1,
      metalness: 0.42,
      bumpMap: waterBumpTex,
      bumpScale: 0.12,
      transparent: true,
      opacity: 0.82,
      envMapIntensity: 1.65,
    })
  );

  return {
    woodFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        bumpMap: woodBumpTex,
        bumpScale: 0.018,
        roughness: 0.58,
        metalness: 0.03,
      })
    ),
    tileFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: tileTex,
        bumpMap: tileBumpTex,
        bumpScale: 0.016,
        roughness: 0.36,
        metalness: 0.06,
      })
    ),
    carpetFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: carpetTex,
        bumpMap: fabricBumpTex,
        bumpScale: 0.01,
        roughness: 0.94,
        metalness: 0.0,
      })
    ),
    roadFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: roadTex,
        bumpMap: asphaltBumpTex,
        bumpScale: 0.02,
        roughness: 0.8,
        metalness: 0.04,
      })
    ),
    wetRoadFloor,
    concreteFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: concreteTex,
        bumpMap: asphaltBumpTex,
        bumpScale: 0.014,
        roughness: 0.76,
        metalness: 0.02,
      })
    ),
    grassFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: grassTex,
        roughness: 0.95,
        metalness: 0.0,
      })
    ),
    highgroundFloor: regMat(
      new THREE.MeshStandardMaterial({
        map: concreteTex,
        color: 0xa3b18a,
        roughness: 0.76,
      })
    ),
    interiorWall: regMat(
      new THREE.MeshStandardMaterial({
        map: wallTex,
        roughness: 0.86,
        metalness: 0.01,
      })
    ),
    exteriorWall: regMat(
      new THREE.MeshStandardMaterial({
        map: brickTex,
        bumpMap: brickBumpTex,
        bumpScale: 0.034,
        roughness: 0.88,
        metalness: 0.02,
      })
    ),
    stuccoWall: regMat(
      new THREE.MeshStandardMaterial({
        map: stuccoTex,
        bumpMap: asphaltBumpTex,
        bumpScale: 0.012,
        roughness: 0.9,
        metalness: 0.0,
      })
    ),
    sidingWall: regMat(
      new THREE.MeshStandardMaterial({
        map: sidingTex,
        roughness: 0.76,
        metalness: 0.03,
      })
    ),
    wetBrickWall: regMat(
      new THREE.MeshStandardMaterial({
        map: brickTex,
        bumpMap: brickBumpTex,
        bumpScale: 0.032,
        color: 0x64748b,
        roughness: 0.25,
        metalness: 0.08,
      })
    ),
    charredWood: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x1c1512,
        bumpMap: woodBumpTex,
        bumpScale: 0.024,
        roughness: 0.96,
        metalness: 0.02,
      })
    ),
    ceiling: regMat(
      new THREE.MeshStandardMaterial({
        map: ceilingTex,
        roughness: 0.9,
        metalness: 0.01,
      })
    ),
    oakWood: regMat(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        color: 0xc9935b,
        bumpMap: woodBumpTex,
        bumpScale: 0.014,
        roughness: 0.56,
        metalness: 0.03,
      })
    ),
    darkWood: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x4f321c,
        bumpMap: woodBumpTex,
        bumpScale: 0.014,
        roughness: 0.62,
        metalness: 0.03,
      })
    ),
    skirtingWood: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xdbe3ed,
        roughness: 0.6,
        metalness: 0.02,
      })
    ),
    fabricSlate: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        bumpMap: fabricBumpTex,
        bumpScale: 0.012,
        roughness: 0.92,
        metalness: 0.0,
      })
    ),
    fabricNavy: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        bumpMap: fabricBumpTex,
        bumpScale: 0.012,
        roughness: 0.91,
        metalness: 0.0,
      })
    ),
    fabricWhite: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        bumpMap: fabricBumpTex,
        bumpScale: 0.01,
        roughness: 0.9,
        metalness: 0.0,
      })
    ),
    curtainFabric: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        bumpMap: fabricBumpTex,
        bumpScale: 0.014,
        roughness: 0.93,
        metalness: 0.0,
        side: THREE.DoubleSide,
      })
    ),
    rugFabric: regMat(
      new THREE.MeshStandardMaterial({
        map: rugTex,
        bumpMap: fabricBumpTex,
        bumpScale: 0.015,
        roughness: 0.96,
        metalness: 0.0,
      })
    ),
    porcelain: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.14,
        metalness: 0.04,
      })
    ),
    matteRubber: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x141920,
        roughness: 0.92,
        metalness: 0.02,
      })
    ),
    brushedMetal: regMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.24, metalness: 0.86 })),
    darkMetal: regMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.74 })),
    brass: regMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.22, metalness: 0.9 })),
    windowGlass,
    tvScreenMat,
    waterSurface,
    redPaint: regMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, metalness: 0.16 })),
    emeraldGlow: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      })
    ),
    amberGlow: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        roughness: 0.35,
      })
    ),
    skyGlow: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.95,
        roughness: 0.25,
      })
    ),
    foliage: regMat(new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.88, metalness: 0.0 })),
    foliageLight: regMat(new THREE.MeshStandardMaterial({ color: 0x2d6a3e, roughness: 0.86, metalness: 0.0 })),
    leafMat: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x276738,
        roughness: 0.62,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
    ),
    bark: regMat(new THREE.MeshStandardMaterial({ color: 0x4a3321, roughness: 0.94, metalness: 0.0 })),
    roofTile: regMat(new THREE.MeshStandardMaterial({ color: 0x3f2e2b, roughness: 0.8, metalness: 0.06 })),
    skin: regMat(new THREE.MeshStandardMaterial({ color: 0xf2c29b, roughness: 0.62, metalness: 0.0 })),
    sleeve: regMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.84, metalness: 0.02 })),
    glove: regMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.08 })),
    exitSignMat: regMat(
      new THREE.MeshStandardMaterial({
        map: exitTex,
        emissiveMap: exitTex,
        emissive: 0x34d399,
        emissiveIntensity: 1.2,
        roughness: 0.25,
      })
    ),
    artFrameCanvas: regMat(new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.45, metalness: 0.05 })),
    whiteboardMat: regMat(new THREE.MeshStandardMaterial({ map: whiteboardTex, roughness: 0.22, metalness: 0.04 })),
    flameSheetMat: regMat(
      new THREE.MeshBasicMaterial({
        map: flameTex,
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    ),
    smokePuffMat: regMat(
      new THREE.MeshStandardMaterial({
        map: smokeTex,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    ),
    textures,
    materials,
  };
}

export function disposeMaterialLibrary(lib: MaterialLibrary): void {
  lib.textures.forEach((t) => t.dispose());
  lib.materials.forEach((m) => m.dispose());
}
