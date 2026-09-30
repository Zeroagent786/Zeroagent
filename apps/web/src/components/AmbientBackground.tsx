"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const LINK_DIST = 140;
const STREAKS = 2;

function glowSprite(size: number, r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d");
  if (x) {
    const grad = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, size, size);
  }
  return c;
}

function streakSprite(): HTMLCanvasElement {
  const w = 640;
  const h = 32;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  if (x) {
    const gh = x.createLinearGradient(0, 0, w, 0);
    gh.addColorStop(0, "rgba(13,148,136,0)");
    gh.addColorStop(0.7, "rgba(13,148,136,0.6)");
    gh.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gh;
    x.fillRect(0, 0, w, h);
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

/** Fixed full-viewport light-theme ambient canvas, mounted once in the root layout. */
export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const tealS = glowSprite(256, 13, 148, 136);
    const slateS = glowSprite(256, 30, 41, 59);
    const streakS = streakSprite();

    const MAX_P = 45;
    const px = new Float32Array(MAX_P);
    const py = new Float32Array(MAX_P);
    const vx = new Float32Array(MAX_P);
    const vy = new Float32Array(MAX_P);
    const depth = new Float32Array(MAX_P);
    const rad = new Float32Array(MAX_P);
    const dx = new Float32Array(MAX_P);
    const dy = new Float32Array(MAX_P);
    const sPhase = new Float32Array(STREAKS);
    const sSpeed = new Float32Array(STREAKS);
    const sOff = new Float32Array(STREAKS);
    for (let i = 0; i < STREAKS; i++) {
      sPhase[i] = i / STREAKS;
      sSpeed[i] = 0.014 + Math.random() * 0.008;
      sOff[i] = (Math.random() - 0.5) * 0.6;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let count = 0;
    let t = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let mx = 0;
    let my = 0;
    let tmx = 0;
    let tmy = 0;

    const seed = () => {
      for (let i = 0; i < MAX_P; i++) {
        px[i] = Math.random() * w;
        py[i] = Math.random() * h;
        depth[i] = 0.3 + Math.random() * 0.7;
        rad[i] = 1 + Math.random() * 1.2;
      }
    };

    const frame = (dt: number) => {
      t += dt;
      mx += (tmx - mx) * Math.min(1, dt * 3);
      my += (tmy - my) * Math.min(1, dt * 3);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      const m = Math.max(w, h);
      const pxs = mx * 10;
      const pys = my * 8;

      // glows (alpha tuned so peak ~ 0.07 teal / 0.05 slate)
      let gx = w * (0.75 + 0.15 * Math.sin(t * 0.11)) + pxs * 1.6;
      let gy = h * (0.3 + 0.18 * Math.sin(t * 0.17 + 1.3)) + pys * 1.6;
      let gr = m * 0.5;
      ctx.globalAlpha = 0.28;
      ctx.drawImage(tealS, gx - gr, gy - gr, gr * 2, gr * 2);

      gx = w * (0.2 + 0.15 * Math.sin(t * 0.13 + 2.1)) + pxs;
      gy = h * (0.7 + 0.2 * Math.cos(t * 0.09)) + pys;
      gr = m * 0.45;
      ctx.globalAlpha = 0.18;
      ctx.drawImage(slateS, gx - gr, gy - gr, gr * 2, gr * 2);

      gx = w * (0.5 + 0.3 * Math.cos(t * 0.07 + 0.6)) + pxs * 0.6;
      gy = h * (0.9 + 0.12 * Math.sin(t * 0.15 + 4)) + pys * 0.6;
      gr = m * 0.38;
      ctx.globalAlpha = 0.2;
      ctx.drawImage(tealS, gx - gr, gy - gr, gr * 2, gr * 2);

      // diagonal sweeps
      const ang = -0.42;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const diag = Math.sqrt(w * w + h * h);
      for (let i = 0; i < STREAKS; i++) {
        let p = sPhase[i] + dt * sSpeed[i];
        if (p > 1) p -= 1;
        sPhase[i] = p;
        const len = diag * 0.7;
        const cx = (p * 1.5 - 0.5) * w;
        const cy = h * (0.5 + sOff[i]) + (cx - w * 0.5) * (sinA / cosA);
        ctx.globalAlpha = 0.16 * Math.sin(p * Math.PI);
        ctx.setTransform(dpr * cosA, dpr * sinA, -dpr * sinA, dpr * cosA, dpr * cx, dpr * cy);
        ctx.drawImage(streakS, 0, -14, len, 28);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // flow-field dots
      const sp = 12;
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

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 0.7;
      const l2 = LINK_DIST * LINK_DIST;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const ddx = dx[i] - dx[j];
          const ddy = dy[i] - dy[j];
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < l2) {
            ctx.globalAlpha = (1 - d2 / l2) * 0.2;
            ctx.beginPath();
            ctx.moveTo(dx[i], dy[i]);
            ctx.lineTo(dx[j], dy[j]);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = "#475569";
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(dx[i], dy[i], rad[i], 0, TAU);
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
      const shouldRun = !reduced && !document.hidden;
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
      w = Math.max(1, window.innerWidth);
      h = Math.max(1, window.innerHeight);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const prev = count;
      count = w < 768 ? 24 : MAX_P;
      if (prev === 0) seed();
      if (!running) frame(0);
    };

    const onPointer = (e: PointerEvent) => {
      tmx = Math.max(-1, Math.min(1, (e.clientX / w) * 2 - 1));
      tmy = Math.max(-1, Math.min(1, (e.clientY / h) * 2 - 1));
    };

    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    if (finePointer && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    resize();
    if (reduced) frame(0.016 * 600);
    sync();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-ambient
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
