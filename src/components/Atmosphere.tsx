import { useEffect, useRef } from "react";
import type { Mood } from "../data/maidens";
import { prefersReducedMotion } from "../lib/station";

type Props = {
  mood: Mood;
  color: string;
  color2: string;
  /** Shared, smoothed pointer position in -1..1 (mutated by the parent, read every frame). */
  pointer?: { current: { x: number; y: number } };
  /** Pixels of parallax travel at full pointer deflection. Near layers move more. */
  depth?: number;
  density?: number;
  onLightning?: () => void;
  className?: string;
};

type P = { x: number; y: number; vx: number; vy: number; s: number; a: number; t: number; z: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function spawn(mood: Mood, w: number, h: number, initial: boolean): P {
  const z = Math.random();
  const p: P = { x: rand(0, w), y: initial ? rand(0, h) : -20, vx: 0, vy: 0, s: 1, a: 1, t: rand(0, 1000), z };
  switch (mood) {
    case "rain":
      p.vy = 900 + z * 700;
      p.vx = -120;
      p.s = 10 + z * 22;
      p.a = 0.15 + z * 0.35;
      break;
    case "neon":
    case "city":
      p.y = initial ? rand(0, h) : h + 20;
      p.vy = -(10 + z * 30);
      p.s = 1 + z * (mood === "city" ? 18 : 3);
      p.a = 0.2 + z * 0.6;
      break;
    case "sun":
    case "dust":
      p.vx = rand(-8, 14);
      p.vy = rand(-6, 6);
      p.s = 0.6 + z * 2.4;
      p.a = 0.2 + z * 0.6;
      break;
    case "moon":
      p.vx = rand(10, 40);
      p.vy = rand(20, 50);
      p.s = 3 + z * 5;
      p.a = 0.4 + z * 0.5;
      break;
    case "stars":
      p.y = rand(0, h);
      p.s = 0.4 + z * 1.6;
      p.a = 0.3 + z * 0.7;
      break;
    case "smoke":
      p.y = initial ? rand(0, h) : h + 40;
      p.vy = -(6 + z * 12);
      p.vx = rand(-4, 4);
      p.s = 30 + z * 80;
      p.a = 0.03 + z * 0.05;
      break;
    case "pixel":
      p.y = initial ? rand(0, h) : h + 10;
      p.vy = -(15 + z * 40);
      p.s = 2 + Math.floor(z * 4) * 2;
      p.a = 0.3 + z * 0.6;
      break;
  }
  return p;
}

export function Atmosphere({ mood, color, color2, pointer, depth = 18, density = 1, onLightning, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightningRef = useRef(onLightning);
  lightningRef.current = onLightning;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = prefersReducedMotion();
    let w = 0, h = 0, raf = 0, last = performance.now();
    let flash = 0, nextFlash = performance.now() + rand(4000, 9000), shooting: P | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const counts: Record<Mood, number> = { rain: 260, neon: 70, sun: 90, dust: 120, moon: 40, stars: 220, smoke: 26, city: 40, pixel: 50 };
    let ps: P[] = [];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(counts[mood] * density * Math.min(1, w / 1200 + 0.3));
      ps = Array.from({ length: n }, () => spawn(mood, w, h, true));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const px = pointer?.current.x ?? 0, py = pointer?.current.y ?? 0;

      if (mood === "rain" && now > nextFlash && !reduced) {
        flash = 1;
        nextFlash = now + rand(6000, 14000);
        lightningRef.current?.();
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(210,220,255,${flash * 0.55})`;
        ctx.fillRect(0, 0, w, h);
        flash = flash > 0.6 && Math.random() < 0.15 ? 0.9 : flash - dt * 3.2;
      }

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.t += dt;
        if (!reduced) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (mood === "sun" || mood === "dust") {
            p.vx += Math.sin(p.t * 0.7) * 2 * dt;
            p.vy += Math.cos(p.t * 0.5) * 2 * dt;
          }
          if (mood === "moon") p.x += Math.sin(p.t * 2) * 20 * dt;
        }
        const ox = px * depth * (0.4 + p.z), oy = py * depth * 0.6 * (0.4 + p.z);
        const x = p.x + ox, y = p.y + oy;

        if (p.y > h + 40 || p.y < -60 || p.x < -60 || p.x > w + 60) {
          ps[i] = spawn(mood, w, h, false);
          if (mood === "sun" || mood === "dust" || mood === "stars") ps[i] = spawn(mood, w, h, true);
          continue;
        }

        switch (mood) {
          case "rain": {
            ctx.strokeStyle = `rgba(190,205,255,${p.a})`;
            ctx.lineWidth = 0.6 + p.z;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (p.vx / p.vy) * p.s, y + p.s);
            ctx.stroke();
            break;
          }
          case "neon":
          case "city": {
            const c = i % 3 === 0 ? color2 : color;
            ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.t * 3));
            ctx.fillStyle = c;
            ctx.shadowColor = c;
            ctx.shadowBlur = mood === "city" ? 30 : 12;
            ctx.beginPath();
            ctx.arc(x, y, p.s, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            break;
          }
          case "sun":
          case "dust":
          case "stars": {
            const tw = mood === "stars" ? 0.5 + 0.5 * Math.sin(p.t * (1 + p.z * 3)) : 0.7 + 0.3 * Math.sin(p.t * 2);
            ctx.globalAlpha = p.a * tw;
            ctx.fillStyle = mood === "stars" ? (i % 5 ? "#fff" : color) : mood === "sun" ? color2 : color;
            ctx.beginPath();
            ctx.arc(x, y, p.s, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
          case "moon": {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(p.t * 1.5);
            ctx.globalAlpha = p.a;
            ctx.fillStyle = color2;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case "smoke": {
            const g = ctx.createRadialGradient(x, y, 0, x, y, p.s);
            g.addColorStop(0, `rgba(255,220,200,${p.a})`);
            g.addColorStop(1, "rgba(255,220,200,0)");
            ctx.fillStyle = g;
            ctx.fillRect(x - p.s, y - p.s, p.s * 2, p.s * 2);
            break;
          }
          case "pixel": {
            ctx.globalAlpha = p.a * (Math.sin(p.t * 6) > -0.6 ? 1 : 0.2);
            ctx.fillStyle = i % 2 ? color : color2;
            ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, p.s, p.s);
            ctx.globalAlpha = 1;
            break;
          }
        }
      }

      if (mood === "stars" && !reduced) {
        if (!shooting && Math.random() < dt * 0.25) {
          shooting = { x: rand(w * 0.2, w), y: rand(0, h * 0.4), vx: -rand(500, 800), vy: rand(200, 320), s: 0, a: 1, t: 0, z: 1 };
        }
        if (shooting) {
          shooting.t += dt;
          shooting.x += shooting.vx * dt;
          shooting.y += shooting.vy * dt;
          const tail = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * 0.15, shooting.y - shooting.vy * 0.15);
          tail.addColorStop(0, "rgba(255,255,255,0.9)");
          tail.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = tail;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shooting.x, shooting.y);
          ctx.lineTo(shooting.x - shooting.vx * 0.15, shooting.y - shooting.vy * 0.15);
          ctx.stroke();
          if (shooting.t > 1.2) shooting = null;
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [mood, color, color2, depth, density, pointer]);

  return <canvas ref={canvasRef} className={className ?? "atmo"} aria-hidden="true" />;
}
