"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

function readParticleConfig() {
  const style = getComputedStyle(document.documentElement);
  const raw = style.getPropertyValue("--c-particle").trim() || "0 0% 100%";
  const parts = raw.split(/\s+/);
  const baseAlpha = parseFloat(
    style.getPropertyValue("--c-particle-alpha").trim() || "0.3",
  );
  return { h: parts[0], s: parts[1], l: parts[2], baseAlpha };
}

export function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number = 0;
    let particles: Particle[] = [];
    const PARTICLE_COUNT = 60;
    const CONNECT_DIST = 150;

    let config = readParticleConfig();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const init = () => {
      resize();
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        opacity: 0.3 + Math.random() * 0.3,
      }));
    };

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let lastTime = 0;
    const FRAME_INTERVAL = 1000 / 30;

    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      const { h, s, l, baseAlpha } = config;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!prefersReducedMotion) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * baseAlpha * 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsl(${h} ${s} ${l} / ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${h} ${s} ${l} / ${p.opacity * baseAlpha})`;
        ctx.fill();
      }
    };

    init();
    if (prefersReducedMotion) {
      draw(FRAME_INTERVAL);
      cancelAnimationFrame(animId);
    } else {
      animId = requestAnimationFrame(draw);
    }
    window.addEventListener("resize", resize);

    // Watch for theme changes (dark class toggle on <html>)
    const observer = new MutationObserver(() => {
      config = readParticleConfig();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[-1] pointer-events-none"
      aria-hidden
    />
  );
}
