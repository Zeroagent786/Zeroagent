"use client";

import { useEffect, useRef } from "react";

const BASE = "#07080A";
const TAU = Math.PI * 2;
const LINK_DIST = 120;
const STREAK_COUNT = 4;

function makeGlowSprite(size: number, r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d");
  if (x) {
    const grad = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, size, size);
  }
  return c;
}

function makeStreakSprite(): HTMLCanvasElement {
  const w = 640;
  const h = 24;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  if (x) {
    const gh = x.createLinearGradient(0, 0, w, 0);
    gh.addColorStop(0, "rgba(220,226,232,0)");
    gh.addColorStop(0.7, "rgba(220,226,232,0.55)");
    gh.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gh;
    x.fillRect(0, 0, w, h);
    // fade vertically into a blade-like taper
    x.globalCompositeOperation = "destination-in";
    const gv = x.createLinearGradient(0, 0, 0, h);
    gv.addColorStop(0, "rgba(0,0,0,0)");
    gv.addColorStop(0.5, "rgba(0,0,0,1)");
    gv.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gv;
    x.fillRect(0, 0, w, h);
  }
  return c;
}

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement ?? canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const tealSprite = makeGlowSprite(256, 13, 148, 136);
    const silverSprite = makeGlowSprite(256, 200, 210, 220);
    const streakSprite = makeStreakSprite();

    const MAX_P = 110;
    const px = new Float32Array(MAX_P);
    const py = new Float32Array(MAX_P);
    const vx = new Float32Array(MAX_P);
    const vy = new Float32Array(MAX_P);
    const depth = new Float32Array(MAX_P);
    const radius = new Float32Array(MAX_P);
    // per-particle display position (after parallax), reused each frame
    const dx = new Float32Array(MAX_P);
    const dy = new Float32Array(MAX_P);
    // streak state
    const streakPhase = new Float32Array(STREAK_COUNT);
    const streakSpeed = new Float32Array(STREAK_COUNT);
    const streakOffset = new Float32Array(STREAK_COUNT);
    const streakLen = new Float32Array(STREAK_COUNT);
    const streakAlpha = new Float32Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
      streakPhase[i] = i / STREAK_COUNT;
      streakSpeed[i] = 0.012 + Math.random() * 0.01;
      streakOffset[i] = (Math.random() - 0.5) * 0.7;
      streakLen[i] = 0.8 + Math.random() * 0.7;
      streakAlpha[i] = 0.28 + Math.random() * 0.22;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let count = 0;
    let t = 0;
    let last = 0;
    let raf = 0;
    let inView = true;
    let running = false;
    let mx = 0;
    let my = 0;
    let tmx = 0;
    let tmy = 0;

    const seed = () => {
      for (let i = 0; i < MAX_P; i++) {
        px[i] = Math.random() * w;
        py[i] = Math.random() * h;
        vx[i] = 0;
        vy[i] = 0;
        depth[i] = 0.3 + Math.random() * 0.7;
        radius[i] = 0.6 + Math.random() * 1.3;
      }
    };

    const frame = (dt: number) => {
      t += dt;
      mx += (tmx - mx) * Math.min(1, dt * 3);
      my += (tmy - my) * Math.min(1, dt * 3);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = BASE;
      ctx.fillRect(0, 0, w, h);

      // glows on Lissajous paths (additive)
      ctx.globalCompositeOperation = "lighter";
      const m = Math.max(w, h);
      const pxs = mx * 10;
      const pys = my * 8;

      let gx = w * (0.72 + 0.16 * Math.sin(t * 0.11)) + pxs * 1.6;
      let gy = h * (0.35 + 0.18 * Math.sin(t * 0.17 + 1.3)) + pys * 1.6;
      let gr = m * 0.55;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(tealSprite, gx - gr, gy - gr, gr * 2, gr * 2);

      gx = w * (0.22 + 0.15 * Math.sin(t * 0.13 + 2.1)) + pxs;
      gy = h * (0.65 + 0.2 * Math.cos(t * 0.09)) + pys;
      gr = m * 0.45;
      ctx.globalAlpha = 0.16;
      ctx.drawImage(silverSprite, gx - gr, gy - gr, gr * 2, gr * 2);

      gx = w * (0.5 + 0.3 * Math.cos(t * 0.07 + 0.6)) + pxs * 0.6;
      gy = h * (0.85 + 0.12 * Math.sin(t * 0.15 + 4)) + pys * 0.6;
      gr = m * 0.4;
      ctx.globalAlpha = 0.28;
      ctx.drawImage(tealSprite, gx - gr, gy - gr, gr * 2, gr * 2);

      // diagonal light streaks
      const ang = -0.42;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const diag = Math.sqrt(w * w + h * h);
      for (let i = 0; i < STREAK_COUNT; i++) {
        let p = streakPhase[i] + dt * streakSpeed[i];
        if (p > 1) p -= 1;
        streakPhase[i] = p;
        const len = diag * 0.55 * streakLen[i];
        const cx = (p * 1.5 - 0.5) * w;
        const cy = h * (0.5 + streakOffset[i]) + (cx - w * 0.5) * (sinA / cosA);
        // fade in/out at ends of the sweep
        const edge = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
        ctx.globalAlpha = streakAlpha[i] * edge;
        ctx.setTransform(dpr * cosA, dpr * sinA, -dpr * sinA, dpr * cosA, dpr * cx, dpr * cy);
        ctx.drawImage(streakSprite, 0, -10, len, 20);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // particles: flow field
      ctx.globalCompositeOperation = "source-over";
      const sp = 14;
      for (let i = 0; i < count; i++) {
        const x = px[i];
        const y = py[i];
        const a =
          (Math.sin(x * 0.0036 + t * 0.13) + Math.cos(y * 0.0042 - t * 0.1) + Math.sin((x + y) * 0.002 + t * 0.07)) *
          1.3;
        vx[i] += (Math.cos(a) * sp * depth[i] - vx[i]) * Math.min(1, dt * 1.5);
        vy[i] += (Math.sin(a) * sp * depth[i] - vy[i]) * Math.min(1, dt * 1.5);
        let nx = x + vx[i] * dt;
        let ny = y + vy[i] * dt;
        if (nx < -10) nx = w + 10;
        else if (nx > w + 10) nx = -10;
        if (ny < -10) ny = h + 10;
        else if (ny > h + 10) ny = -10;
        px[i] = nx;
        py[i] = ny;
        dx[i] = nx + mx * 14 * depth[i];
        dy[i] = ny + my * 10 * depth[i];
      }

      ctx.strokeStyle = "#AEB8C2";
      ctx.lineWidth = 0.7;
      const l2 = LINK_DIST * LINK_DIST;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const ddx = dx[i] - dx[j];
          const ddy = dy[i] - dy[j];
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < l2) {
            ctx.globalAlpha = (1 - d2 / l2) * 0.22;
            ctx.beginPath();
            ctx.moveTo(dx[i], dy[i]);
            ctx.lineTo(dx[j], dy[j]);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = "#DDE3E9";
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(dx[i], dy[i], radius[i], 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
    };

    const sync = () => {
      const shouldRun = !reduced && inView && !document.hidden;
      if (shouldRun && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = w < 640 ? 0.45 : w < 1024 ? 0.75 : 1;
      const prev = count;
      count = Math.round(MAX_P * scale);
      if (prev === 0) seed();
      if (!running) frame(0);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      tmx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      tmy = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
    };

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    const io = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      sync();
    });
    io.observe(parent);
    document.addEventListener("visibilitychange", sync);
    if (finePointer && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    resize();
    if (reduced) frame(0.016 * 600); // advance to a pleasing static frame
    sync();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* top scrim for nav legibility, bottom blend into the light canvas */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-[#FBFBFA]/10 to-[#FBFBFA]" />
    </div>
  );
}
