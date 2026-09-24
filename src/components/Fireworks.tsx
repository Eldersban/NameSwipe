import { useState } from "react";
import { motion } from "framer-motion";

const COLORS = ["#f0cf6a", "#e37b9a", "#7bc5a8", "#8fa8e8", "#ffffff", "#e1b965"];

interface BurstParticle {
  angle: number;
  distance: number;
  color: string;
  size: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  delay: number;
  color: string;
  particles: BurstParticle[];
}

function makeBursts(count: number): Burst[] {
  return Array.from({ length: count }, (_, i) => {
    const particleCount = 12 + Math.floor(Math.random() * 6);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      id: i,
      x: 15 + Math.random() * 70,
      y: 12 + Math.random() * 45,
      delay: i * 0.55 + Math.random() * 0.3,
      color,
      particles: Array.from({ length: particleCount }, (_, j) => ({
        angle: (360 / particleCount) * j + (Math.random() * 20 - 10),
        distance: 55 + Math.random() * 55,
        color: Math.random() > 0.3 ? color : COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 4,
      })),
    };
  });
}

function BurstEffect({ burst }: { burst: Burst }) {
  return (
    <div style={{ position: "absolute", left: `${burst.x}%`, top: `${burst.y}%` }}>
      <motion.div
        style={{
          position: "absolute",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: burst.color,
          boxShadow: `0 0 20px 6px ${burst.color}`,
          left: -5,
          top: -5,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 2, 0], opacity: [1, 1, 0] }}
        transition={{ duration: 0.5, delay: burst.delay, repeat: Infinity, repeatDelay: 3 }}
      />
      {burst.particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.distance;
        const dy = Math.sin(rad) * p.distance;
        return (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: p.color,
              boxShadow: `0 0 6px 1px ${p.color}`,
              left: 0,
              top: 0,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
            animate={{
              x: [0, dx],
              y: [0, dy, dy + 40],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 0.7],
            }}
            transition={{
              duration: 1.1,
              delay: burst.delay,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

export function FireworksField({ count = 6 }: { count?: number }) {
  const [bursts] = useState(() => makeBursts(count));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bursts.map((b) => (
        <BurstEffect key={b.id} burst={b} />
      ))}
    </div>
  );
}
