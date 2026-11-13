import { GameEngineState } from './engine';
import { DisasterId, InteractiveObject } from './types';

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  state: GameEngineState,
  viewW: number,
  viewH: number
): void {
  const now = performance.now() * 0.001;
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);

  // Deep atmospheric outer void
  ctx.fillStyle = '#060a11';
  ctx.fillRect(0, 0, viewW, viewH);

  const zoom = viewW < 640 ? 0.78 : viewW < 1024 ? 0.92 : 1.06;
  const halfW = viewW / (2 * zoom);
  const halfH = viewH / (2 * zoom);

  const clampedCamX = Math.max(halfW - 40, Math.min(state.worldWidth - halfW + 40, state.camX));
  const clampedCamY = Math.max(halfH - 40, Math.min(state.worldHeight - halfH + 40, state.camY));

  ctx.translate(viewW / 2 + state.shakeOffsetX, viewH / 2 + state.shakeOffsetY);
  ctx.scale(zoom, zoom);
  ctx.translate(-clampedCamX, -clampedCamY);

  // 1. Detailed Floor Textures & Pathways
  drawFloorZones(ctx, state, now);

  // 2. Earthquake floor cracks with shadow depth
  if (state.disaster === 'earthquake' && state.elapsed > 3) {
    drawEarthquakeCracks(ctx, state);
  }

  // 3. Safe Zone Destination Beacon
  drawSafeZone(ctx, state, now);

  // 4. Hazards underneath entities (water, caustics, glass, electric arcs)
  drawHazardsBase(ctx, state, now);

  // 5. Floating Debris (Flood)
  for (const deb of state.floatingDebris) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(deb.x + 3, deb.y + 5, deb.w, deb.h);
    ctx.fillStyle = deb.kind === 'plank' ? '#a16207' : deb.kind === 'bin' ? '#334155' : '#4d7c0f';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(deb.x, deb.y, deb.w, deb.h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 6. Detailed Walls, Windows, Furniture & Vehicles
  drawWallsAndFurniture(ctx, state, now);

  // 7. Interactive Objects (except cover tabletops drawn over player when inside)
  for (const obj of state.interactives) {
    if (obj.kind === 'cover_table' && state.player.inCoverId === obj.id) {
      continue;
    }
    drawInteractiveObject(ctx, obj, state.nearestInteractive?.id === obj.id, now, state);
  }

  // 8. NPCs
  for (const npc of state.npcs) {
    if (npc.evacuated) continue;
    drawPerson(ctx, npc.x, npc.y, 0, 1, now * 6, npc.color, npc.hairColor, false, false, false, now);
    if (npc.speech && npc.speechTimer > 0) {
      drawSpeechBubble(ctx, npc.x, npc.y - 30, npc.speech);
    }
  }

  // 9. Player Character + Water Ripples / Vision Cone
  const p = state.player;
  const inCover = Boolean(p.inCoverId);

  if (p.inWater && !inCover) {
    ctx.save();
    const rip = (now * 1.8) % 1;
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.75 * (1 - rip)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 + rip * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawPerson(
    ctx,
    p.x,
    p.y,
    p.facingX,
    p.facingY,
    p.walkPhase,
    p.damageFlash > 0.2 ? '#ef4444' : '#f97316',
    '#1e293b',
    p.crouching || inCover,
    inCover,
    true,
    now
  );

  // Cover tabletop OVER player when tucked underneath
  if (p.inCoverId) {
    const table = state.interactives.find((o) => o.id === p.inCoverId);
    if (table) {
      ctx.save();
      ctx.globalAlpha = 0.88;
      drawInteractiveObject(ctx, table, state.nearestInteractive?.id === table.id, now, state);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.96)';
      ctx.beginPath();
      ctx.roundRect(p.x - 62, p.y - 48, 124, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#022c22';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COVERED · SAFE', p.x, p.y - 32);
      ctx.restore();
    }
  }

  // 10. Falling Objects (Earthquake)
  for (const fo of state.fallingObjects) {
    ctx.save();
    if (!fo.landed) {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(fo.x, fo.targetY, fo.size * 0.9, fo.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = fo.kind === 'books' ? '#b45309' : fo.kind === 'lamp' ? '#facc15' : '#cbd5e1';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.fillRect(fo.x - fo.size / 2, fo.y - fo.size / 2, fo.size, fo.size);
    ctx.strokeRect(fo.x - fo.size / 2, fo.y - fo.size / 2, fo.size, fo.size);
    ctx.restore();
  }

  // 11. Active Flames & Dense Smoke Clouds
  drawHazardsOverlay(ctx, state, now);

  // 12. Particles
  for (const pt of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.alpha);
    if (pt.kind === 'rain') {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - 6, pt.y + 20);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 13. Clear High-Contrast Floating Interaction Prompt
  if (state.nearestInteractive) {
    const obj = state.nearestInteractive;
    const isCoverToggle = obj.kind === 'cover_table' && state.player.inCoverId === obj.id;
    const label = isCoverToggle ? obj.secondaryPrompt || 'Leave Cover' : obj.prompt;
    drawWorldPrompt(ctx, obj.x + obj.w / 2, obj.y - 18, `E · ${label}`);
  }

  ctx.restore();

  // --- SCREEN-SPACE CINEMATIC LIGHTING & ATMOSPHERE ---
  if (state.disaster === 'earthquake') {
    if (state.lightFlicker < 0.92) {
      ctx.fillStyle = `rgba(6, 9, 16, ${1 - state.lightFlicker})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    // Warm emergency amber glow vignette during shaking
    if (state.eqPhase === 'shaking' || state.eqPhase === 'aftershock') {
      const vg = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.3, viewW / 2, viewH / 2, viewW * 0.72);
      vg.addColorStop(0, 'rgba(249, 115, 22, 0)');
      vg.addColorStop(1, 'rgba(234, 88, 12, 0.22)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  if (state.disaster === 'fire') {
    if (state.player.inSmoke) {
      const smokeOpacity = state.player.crouching ? 0.16 : 0.48;
      ctx.fillStyle = `rgba(12, 18, 28, ${smokeOpacity})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    if (state.fireAlarmActive && Math.sin(now * 8) > 0.3) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(0, 0, viewW, viewH);
    }
    // Warm firelight perimeter glow
    const fg = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.32, viewW / 2, viewH / 2, viewW * 0.75);
    fg.addColorStop(0, 'rgba(249, 115, 22, 0)');
    fg.addColorStop(1, 'rgba(180, 45, 12, 0.24)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  if (state.disaster === 'flood') {
    ctx.fillStyle = 'rgba(6, 20, 44, 0.24)';
    ctx.fillRect(0, 0, viewW, viewH);
    if (state.lightningAlpha > 0.02) {
      ctx.fillStyle = `rgba(224, 242, 254, ${state.lightningAlpha * 0.5})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  if (state.player.damageFlash > 0.05) {
    const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.24, viewW / 2, viewH / 2, viewW * 0.72);
    grad.addColorStop(0, 'rgba(220, 38, 38, 0)');
    grad.addColorStop(1, `rgba(220, 38, 38, ${state.player.damageFlash * 0.62})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawFloorZones(ctx: CanvasRenderingContext2D, state: GameEngineState, now: number) {
  for (const z of state.floorZones) {
    ctx.save();
    if (z.style === 'wood') {
      ctx.fillStyle = '#684e38';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(25, 16, 10, 0.34)';
      ctx.lineWidth = 1;
      for (let py = z.y; py < z.y + z.h; py += 20) {
        ctx.beginPath();
        ctx.moveTo(z.x, py);
        ctx.lineTo(z.x + z.w, py);
        ctx.stroke();
        const offset = ((py / 20) % 2) * 32;
        for (let px = z.x + offset; px < z.x + z.w; px += 64) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, Math.min(z.y + z.h, py + 20));
          ctx.stroke();
        }
      }
      // Living room rug accent for earthquake apartment
      if (state.disaster === 'earthquake' && z.x === 144 && z.y === 144) {
        ctx.fillStyle = 'rgba(153, 27, 27, 0.35)';
        ctx.fillRect(240, 225, 165, 130);
        ctx.strokeStyle = 'rgba(254, 215, 170, 0.22)';
        ctx.lineWidth = 2;
        ctx.strokeRect(246, 231, 153, 118);
      }
    } else if (z.style === 'tile') {
      ctx.fillStyle = '#9aa8b8';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      for (let tx = z.x; tx < z.x + z.w; tx += 36) {
        for (let ty = z.y; ty < z.y + z.h; ty += 36) {
          if (((tx + ty) / 36) % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fillRect(tx, ty, 36, 36);
          }
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx, ty, 36, 36);
        }
      }
    } else if (z.style === 'carpet') {
      ctx.fillStyle = '#3f4d63';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      for (let cy = z.y + 16; cy < z.y + z.h; cy += 32) {
        ctx.strokeRect(z.x + 8, cy, z.w - 16, 16);
      }
    } else if (z.style === 'road') {
      ctx.fillStyle = '#293548';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      // Curbs
      ctx.fillStyle = '#475569';
      ctx.fillRect(z.x, z.y, z.w, 8);
      ctx.fillRect(z.x, z.y + z.h - 8, z.w, 8);
      // Dashed lane markings
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.28)';
      ctx.setLineDash([22, 20]);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(z.x + 20, z.y + z.h / 2);
      ctx.lineTo(z.x + z.w - 20, z.y + z.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (z.style === 'concrete') {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.lineWidth = 1.5;
      for (let py = z.y; py < z.y + z.h; py += 42) {
        ctx.strokeRect(z.x, py, z.w, 42);
      }
    } else if (z.style === 'highground') {
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(z.x + 12, z.y + 18, z.w - 24, z.h - 36);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x + 12, z.y + 18, z.w - 24, z.h - 36);
    } else {
      ctx.fillStyle = '#284323';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      // Subtle grass tuft texture
      ctx.fillStyle = '#36582f';
      for (let gx = z.x + 30; gx < z.x + z.w - 20; gx += 110) {
        for (let gy = z.y + 30; gy < z.y + z.h - 20; gy += 95) {
          ctx.fillRect(gx, gy, 6, 3);
          ctx.fillRect(gx + 8, gy + 4, 5, 3);
        }
      }
    }
    ctx.restore();
  }

  // Flood Wooden Footbridge
  if (state.disaster === 'flood') {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(468, 222, 210, 98);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(468, 214, 210, 96);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2;
    for (let bx = 472; bx < 676; bx += 18) {
      ctx.strokeRect(bx, 216, 16, 92);
    }
    ctx.fillStyle = '#d97706';
    ctx.fillRect(468, 210, 210, 9);
    ctx.fillRect(468, 304, 210, 9);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.5)';
    ctx.lineWidth = 2.5;
    for (let wy = 95; wy < 205; wy += 26) {
      const shift = Math.sin(now * 3.2 + wy) * 9;
      ctx.beginPath();
      ctx.moveTo(525 + shift, wy);
      ctx.lineTo(578 + shift, wy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEarthquakeCracks(ctx: CanvasRenderingContext2D, state: GameEngineState) {
  ctx.save();
  ctx.strokeStyle = 'rgba(12, 16, 24, 0.85)';
  ctx.lineWidth = 3;
  const cracks = [
    [250, 195, 310, 240, 290, 295],
    [605, 475, 680, 520, 725, 585],
    [820, 610, 885, 642, 925, 695],
    [418, 618, 470, 672, 534, 662],
    [690, 380, 730, 420, 705, 455],
  ];
  for (const c of cracks) {
    ctx.beginPath();
    ctx.moveTo(c[0], c[1]);
    ctx.lineTo(c[2], c[3]);
    ctx.lineTo(c[4], c[5]);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSafeZone(ctx: CanvasRenderingContext2D, state: GameEngineState, now: number) {
  const sz = state.safeZone;
  const pulse = 0.55 + Math.sin(now * 4.5) * 0.25;
  ctx.save();
  ctx.fillStyle = `rgba(16, 185, 129, ${0.22 + pulse * 0.12})`;
  ctx.strokeStyle = `rgba(52, 211, 153, ${0.75 + pulse * 0.25})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 6]);
  ctx.fillRect(sz.x, sz.y, sz.w, sz.h);
  ctx.strokeRect(sz.x, sz.y, sz.w, sz.h);
  ctx.setLineDash([]);

  ctx.fillStyle = '#ecfdf5';
  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SAFE ZONE', sz.x + sz.w / 2, sz.y + sz.h / 2 - 4);
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(sz.label, sz.x + sz.w / 2, sz.y + sz.h / 2 + 18);
  ctx.restore();
}

function drawHazardsBase(ctx: CanvasRenderingContext2D, state: GameEngineState, now: number) {
  for (const h of state.hazards) {
    if (!h.active) continue;
    ctx.save();
    if (h.kind === 'floodwater') {
      if (h.id === 'creek_basin_south' && state.floodWaterLevel < 0.2) {
        ctx.restore();
        continue;
      }
      const alpha = h.id === 'creek_basin_south' ? 0.4 + state.floodWaterLevel * 0.45 : 0.78;
      ctx.fillStyle = `rgba(14, 116, 184, ${alpha})`;
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 2.2;
      for (let ry = h.y + 24; ry < h.y + h.h - 14; ry += 38) {
        for (let rx = h.x + 20; rx < h.x + h.w - 50; rx += 90) {
          const shift = Math.sin(now * 2.8 + rx * 0.02 + ry * 0.02) * 14;
          ctx.beginPath();
          ctx.moveTo(rx + shift, ry);
          ctx.lineTo(rx + 32 + shift, ry);
          ctx.stroke();
        }
      }
    } else if (h.kind === 'electric_water') {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.5)';
      ctx.beginPath();
      ctx.arc(h.x + h.w / 2, h.y + h.h / 2, h.w * 0.49, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = Math.sin(now * 24) > 0 ? '#38bdf8' : '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.x + h.w / 2, h.y + h.h / 2, h.w * (0.35 + Math.sin(now * 9) * 0.07), 0, Math.PI * 2);
      ctx.stroke();
    } else if (h.kind === 'glass') {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.28)';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#e0f2fe';
      for (let i = 0; i < 14; i++) {
        const sx = h.x + ((i * 37) % (h.w - 10)) + 4;
        const sy = h.y + ((i * 53) % (h.h - 10)) + 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 8, sy + 3);
        ctx.lineTo(sx + 2, sy + 9);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawHazardsOverlay(ctx: CanvasRenderingContext2D, state: GameEngineState, now: number) {
  for (const h of state.hazards) {
    if (!h.active) continue;
    ctx.save();
    if (h.kind === 'fire') {
      const grad = ctx.createRadialGradient(
        h.x + h.w / 2,
        h.y + h.h / 2,
        10,
        h.x + h.w / 2,
        h.y + h.h / 2,
        Math.max(h.w, h.h) * 0.72
      );
      grad.addColorStop(0, 'rgba(251, 146, 60, 0.9)');
      grad.addColorStop(0.55, 'rgba(239, 68, 68, 0.65)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(h.x - 20, h.y - 20, h.w + 40, h.h + 40);

      const cols = Math.max(2, Math.floor(h.w / 40));
      const rows = Math.max(2, Math.floor(h.h / 40));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fx = h.x + (c + 0.5) * (h.w / cols);
          const fy = h.y + (r + 0.5) * (h.h / rows);
          const flicker = Math.sin(now * 15 + c * 2 + r * 3) * 5.5;
          ctx.fillStyle = '#ea580c';
          ctx.beginPath();
          ctx.arc(fx, fy + flicker * 0.4, 20 + flicker * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(fx, fy + flicker * 0.2, 13 + flicker * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(fx, fy + 3, 8 + flicker * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (h.kind === 'smoke') {
      ctx.fillStyle = state.player.crouching ? 'rgba(30, 41, 59, 0.24)' : 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(h.x, h.y, h.w, h.h);
    }
    ctx.restore();
  }
}

function drawWallsAndFurniture(ctx: CanvasRenderingContext2D, state: GameEngineState, now: number) {
  for (const w of state.walls) {
    const r = w.toppled && w.toppledRect ? w.toppledRect : w;
    ctx.save();
    if (w.kind === 'wall') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(r.x + 4, r.y + 5, r.w, r.h);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#475569';
      ctx.fillRect(r.x + 2, r.y + 2, Math.max(0, r.w - 4), Math.max(0, r.h - 6));
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else if (w.kind === 'window') {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    } else if (w.kind === 'house') {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(r.x + 6, r.y + 8, r.w, r.h);
      ctx.fillStyle = w.color || '#64748b';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#334155';
      ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.h / 2);
      ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      ctx.stroke();
    } else if (w.kind === 'car') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(r.x + 4, r.y + 6, r.w, r.h);
      ctx.fillStyle = w.color || '#0284c7';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(r.x + r.w * 0.6, r.y + 7, r.w * 0.22, r.h - 14);
      // Headlights
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(r.x + r.w - 4, r.y + 6, 4, 8);
      ctx.fillRect(r.x + r.w - 4, r.y + r.h - 14, 4, 8);
    } else if (w.kind === 'pillar') {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = Math.sin(now * 16) > 0 ? '#facc15' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (w.kind === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2 + 4, r.y + r.h / 2 + 5, r.w * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.72, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Detailed Furniture
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(r.x + 4, r.y + 5, r.w, r.h);
      ctx.fillStyle = w.toppled ? '#7f1d1d' : w.color || '#78350f';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Add subtle detail by label
      if (w.label === 'Bed') {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(r.x + 6, r.y + 10, 26, r.h - 20);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(r.x + 38, r.y + 6, r.w - 44, r.h - 12);
      } else if (w.label === 'Sofa') {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(r.x + 12, r.y + 10, r.w - 18, r.h - 20);
      } else if (w.label === 'Kitchen Counter') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(r.x + 16, r.y + 6, 44, r.h - 12);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(r.x + 28, r.y + 14, 5, 0, Math.PI * 2);
        ctx.arc(r.x + 48, r.y + 28, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (w.label === 'Desk') {
        // glowing computer monitor
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(r.x + r.w / 2 - 12, r.y + 8, 24, 10);
      }
    }
    ctx.restore();
  }
}

function drawInteractiveObject(
  ctx: CanvasRenderingContext2D,
  obj: InteractiveObject,
  isHighlighted: boolean,
  now: number,
  state: GameEngineState
) {
  ctx.save();

  // Subtle ambient interactive pulse ring so players notice key objects
  if (!obj.used || obj.kind === 'cover_table') {
    const glow = 0.25 + Math.sin(now * 4) * 0.15;
    ctx.strokeStyle = isHighlighted ? '#facc15' : `rgba(250, 204, 21, ${glow})`;
    ctx.lineWidth = isHighlighted ? 4 : 2;
    ctx.strokeRect(obj.x - 5, obj.y - 5, obj.w + 10, obj.h + 10);
  }

  switch (obj.kind) {
    case 'cover_table': {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(obj.x + 5, obj.y + 7, obj.w, obj.h);
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(69, 26, 3, 0.35)';
      ctx.beginPath();
      ctx.moveTo(obj.x + 8, obj.y + obj.h / 2);
      ctx.lineTo(obj.x + obj.w - 8, obj.y + obj.h / 2);
      ctx.stroke();
      break;
    }
    case 'emergency_kit': {
      if (obj.used) break;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#fef2f2';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(obj.x + obj.w / 2 - 3, obj.y + 7, 6, obj.h - 14);
      ctx.fillRect(obj.x + 9, obj.y + obj.h / 2 - 3, obj.w - 18, 6);
      break;
    }
    case 'gas_valve':
    case 'breaker_panel': {
      ctx.fillStyle = obj.used ? '#10b981' : '#f59e0b';
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      break;
    }
    case 'radio':
    case 'phone': {
      ctx.fillStyle = obj.used ? '#10b981' : '#0ea5e9';
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      break;
    }
    case 'fire_alarm': {
      ctx.fillStyle = obj.used ? '#f59e0b' : '#ef4444';
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      break;
    }
    case 'fire_extinguisher': {
      if (obj.used) break;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(obj.x + 4, obj.y + 4, obj.w - 8, obj.h - 6, 4);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(obj.x + 8, obj.y, obj.w - 16, 6);
      break;
    }
    case 'elevator': {
      ctx.fillStyle = '#334155';
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      ctx.fillStyle = '#fecaca';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ELEVATOR · UNSAFE', obj.x + obj.w / 2, obj.y + obj.h / 2 + 4);
      break;
    }
    case 'parked_car': {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(obj.x + 52, obj.y + 6, 20, obj.h - 12);
      break;
    }
    case 'exit_door':
    case 'stairs_exit':
    case 'check_door': {
      if (obj.used && obj.kind !== 'check_door') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.38)';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      } else {
        const isDangerHot = obj.hot && state.disaster === 'fire';
        ctx.fillStyle = isDangerHot ? '#991b1b' : obj.kind === 'stairs_exit' ? '#10b981' : '#b45309';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      }
      break;
    }
  }

  ctx.restore();
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fx: number,
  fy: number,
  walkPhase: number,
  shirtColor: string,
  hairColor: string,
  crouching: boolean,
  hiddenUnderCover: boolean,
  isPlayer: boolean,
  now: number
) {
  ctx.save();
  ctx.translate(x, y);
  const angle = Math.atan2(fy, fx);

  // Subtle player beacon ring on floor so character is always clearly visible
  if (isPlayer) {
    const ringAlpha = 0.45 + Math.sin(now * 5) * 0.2;
    ctx.strokeStyle = `rgba(249, 115, 22, ${ringAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, crouching ? 16 : 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.rotate(angle + Math.PI / 2);
  if (crouching) {
    ctx.scale(0.84, 0.84);
  }
  if (hiddenUnderCover) {
    ctx.globalAlpha = 0.65;
  }

  // Flashlight / forward sight cone for player
  if (isPlayer && !hiddenUnderCover) {
    const cone = ctx.createRadialGradient(0, -8, 4, 0, -52, 74);
    cone.addColorStop(0, 'rgba(254, 240, 138, 0.18)');
    cone.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-34, -90);
    ctx.lineTo(34, -90);
    ctx.closePath();
    ctx.fill();
  }

  const swing = Math.sin(walkPhase) * 5.5;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-5.5, 6 + swing * 0.55, 4.2, 0, Math.PI * 2);
  ctx.arc(5.5, 6 - swing * 0.55, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(-11.5, -swing * 0.75, 4, 0, Math.PI * 2);
  ctx.arc(11.5, swing * 0.75, 4, 0, Math.PI * 2);
  ctx.fill();

  // Torso / Vest
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (isPlayer) {
    // High-visibility safety stripe across shoulders
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-8, -2, 16, 2.5);
  }

  // Backpack
  ctx.fillStyle = '#334155';
  ctx.fillRect(-7.5, 4, 15, 6.5);

  // Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -3, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair / Cap
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(0, -1, 7.6, 0, Math.PI);
  ctx.fill();

  ctx.restore();
}

function drawWorldPrompt(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(text);
  const pw = metrics.width + 24;
  const ph = 32;
  ctx.fillStyle = 'rgba(10, 16, 28, 0.96)';
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - ph, pw, ph, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 11);
  ctx.restore();
}

function drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  const pw = ctx.measureText(text).width + 20;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, y - 26, pw, 26, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 9);
  ctx.restore();
}

export function renderMiniMap(ctx: CanvasRenderingContext2D, state: GameEngineState, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#080e19';
  ctx.fillRect(0, 0, w, h);

  const sx = w / state.worldWidth;
  const sy = h / state.worldHeight;

  ctx.fillStyle = '#475569';
  for (const wall of state.walls) {
    const r = wall.toppled && wall.toppledRect ? wall.toppledRect : wall;
    ctx.fillRect(r.x * sx, r.y * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
  }

  for (const hz of state.hazards) {
    if (!hz.active) continue;
    if (hz.kind === 'floodwater' || hz.kind === 'electric_water') {
      ctx.fillStyle = hz.kind === 'electric_water' ? 'rgba(56, 189, 248, 0.75)' : 'rgba(14, 116, 184, 0.6)';
    } else if (hz.kind === 'fire') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    }
    ctx.fillRect(hz.x * sx, hz.y * sy, hz.w * sx, hz.h * sy);
  }

  ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
  ctx.fillRect(state.safeZone.x * sx, state.safeZone.y * sy, state.safeZone.w * sx, state.safeZone.h * sy);

  for (const obj of state.interactives) {
    if (obj.used) continue;
    if (obj.kind === 'cover_table' || obj.kind === 'emergency_kit' || obj.kind === 'fire_alarm' || obj.kind === 'stairs_exit') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(obj.x * sx - 1.5, obj.y * sy - 1.5, 4.5, 4.5);
    }
  }

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(state.player.x * sx, state.player.y * sy, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

export function renderDisasterCardPreview(
  ctx: CanvasRenderingContext2D,
  disaster: DisasterId,
  w: number,
  h: number,
  t: number
): void {
  ctx.clearRect(0, 0, w, h);

  if (disaster === 'earthquake') {
    ctx.fillStyle = 'rgba(249, 115, 22, 0.08)';
    ctx.fillRect(0, 0, w, h);
    // Floating dust specks
    for (let i = 0; i < 20; i++) {
      const x = ((i * 53 + Math.sin(t + i) * 18) % w + w) % w;
      const y = ((i * 37 + t * 22) % h);
      ctx.fillStyle = 'rgba(254, 215, 170, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (disaster === 'flood') {
    // Rain streaks overlay
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 28; i++) {
      const rx = (i * 31 + t * 110) % w;
      const ry = (i * 43 + t * 280) % h;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 16);
      ctx.stroke();
    }
  } else {
    // Rising glowing embers overlay
    for (let i = 0; i < 24; i++) {
      const ex = ((i * 47 + Math.sin(t * 1.6 + i) * 20) % w + w) % w;
      const ey = h - ((i * 31 + t * 55) % h);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 146, 60, 0.7)' : 'rgba(250, 204, 21, 0.65)';
      ctx.beginPath();
      ctx.arc(ex, ey, 1.8 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
