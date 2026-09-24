import { useState } from "react";
import { motion } from "framer-motion";

const COLORS = ["#f0cf6a", "#e1b965", "#7bc5a8", "#e37b9a", "#8fa8e8", "#ffffff"];

interface Piece {
  id: number;
  left: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  swing: number;
  rotateDir: number;
  shape: "rect" | "circle";
  repeatDelay: number;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 6 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: 2.6 + Math.random() * 2.2,
    delay: Math.random() * 3.5,
    swing: 20 + Math.random() * 40,
    rotateDir: Math.random() > 0.5 ? 1 : -1,
    shape: Math.random() > 0.35 ? "rect" : "circle",
    repeatDelay: Math.random() * 1.5,
  }));
}

export function ConfettiField({ count = 90 }: { count?: number }) {
  const [pieces] = useState(() => makePieces(count));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            top: -30,
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === "rect" ? p.size * 0.4 : p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 2,
          }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: ["-30px", "115vh"],
            x: [0, p.swing, -p.swing, 0],
            rotate: [0, 360 * p.rotateDir, 720 * p.rotateDir],
            opacity: [1, 1, 0.9, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: p.repeatDelay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
