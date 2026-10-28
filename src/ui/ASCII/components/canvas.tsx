"use client";

import { useEffect, useRef } from "react";
import { OceanEngine, type GoldfishSpec } from "../engine/world";

export interface AsciiCanvasProps {
  className?: string;
  goldfish?: GoldfishSpec[];
}

/**
 * Minimal full-viewport ASCII Goldfish background canvas.
 */
export function AsciiCanvas({ className, goldfish }: AsciiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new OceanEngine(canvas, goldfish);
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        display: "block",
        zIndex: 1,
        fontFamily: 'var(--font-geist-mono), "Geist Mono", ui-monospace, Menlo, monospace',
      }}
    />
  );
}

export default AsciiCanvas;