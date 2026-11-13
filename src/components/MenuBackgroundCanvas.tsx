import { useEffect, useRef } from 'react';
import eqArt from '../assets/images/disaster_card_earthquake_1794565786312.jpg';
import floodArt from '../assets/images/disaster_card_flood_1794565786303.jpg';
import fireArt from '../assets/images/disaster_card_fire_1794565786545.jpg';

interface AtmosphericParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  kind: 'ember' | 'rain' | 'smoke';
}

export function MenuBackgroundCanvas({ showDisasterTriptych = false }: { showDisasterTriptych?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: AtmosphericParticle[] = Array.from({ length: 84 }, (_, i) => {
      const mod = i % 5;
      if (mod === 0) {
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 14,
          vy: -8 - Math.random() * 14,
          size: 28 + Math.random() * 44,
          alpha: 0.04 + Math.random() * 0.05,
          kind: 'smoke',
        };
      }
      if (mod === 1 || mod === 2) {
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: -65,
          vy: 280 + Math.random() * 140,
          size: 1.5,
          alpha: 0.16 + Math.random() * 0.22,
          kind: 'rain',
        };
      }
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 24,
        vy: -18 - Math.random() * 34,
        size: 1.8 + Math.random() * 2.8,
        alpha: 0.28 + Math.random() * 0.5,
        kind: 'ember',
      };
    });

    const draw = (time: number) => {
      const t = time * 0.001;
      ctx.clearRect(0, 0, w, h);

      // Deep charcoal-navy radial backdrop with warm hazard glow
      const bg = ctx.createRadialGradient(w * 0.72, h * 0.28, 30, w * 0.45, h * 0.5, Math.max(w, h) * 0.9);
      bg.addColorStop(0, 'rgba(38, 22, 16, 0.72)');
      bg.addColorStop(0.42, 'rgba(13, 21, 34, 0.88)');
      bg.addColorStop(1, 'rgba(6, 10, 17, 0.96)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle tactical grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
      ctx.lineWidth = 1;
      const step = 72;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        // Emergency pulsing dual light beams (amber fire & electric flood blue)
        const orangePulse = 0.08 + Math.sin(t * 1.8) * 0.04;
        const gOrange = ctx.createRadialGradient(w * 0.82, h * 0.22, 10, w * 0.82, h * 0.22, w * 0.42);
        gOrange.addColorStop(0, `rgba(249, 115, 22, ${orangePulse})`);
        gOrange.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = gOrange;
        ctx.fillRect(0, 0, w, h);

        const bluePulse = 0.07 + Math.cos(t * 1.4) * 0.035;
        const gBlue = ctx.createRadialGradient(w * 0.18, h * 0.78, 10, w * 0.18, h * 0.78, w * 0.38);
        gBlue.addColorStop(0, `rgba(14, 165, 233, ${bluePulse})`);
        gBlue.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = gBlue;
        ctx.fillRect(0, 0, w, h);

        // Seismic wave line
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 22) {
          const y = h * 0.82 + Math.sin(x * 0.008 + t * 1.7) * 16 + Math.cos(x * 0.022 - t * 2.4) * 7;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Atmospheric particles: smoke, rain, embers
        for (const p of particles) {
          p.x += p.vx * 0.016;
          p.y += p.vy * 0.016;

          if (p.kind === 'rain') {
            if (p.y > h + 20) {
              p.y = -20;
              p.x = Math.random() * (w + 120);
            }
            ctx.strokeStyle = `rgba(125, 211, 252, ${p.alpha})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 5, p.y + 18);
            ctx.stroke();
          } else if (p.kind === 'smoke') {
            if (p.y < -80) {
              p.y = h + 60;
              p.x = Math.random() * w;
            }
            ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            if (p.y < -12) {
              p.y = h + 12;
              p.x = Math.random() * w;
            }
            ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {showDisasterTriptych && (
        <div className="absolute inset-0 grid grid-cols-3 opacity-25">
          <img src={eqArt} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover scale-105" />
          <img src={floodArt} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover scale-105" />
          <img src={fireArt} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover scale-105" />
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
