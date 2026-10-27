"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./style.module.scss";

export default function Landing() {
  const containerRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: "power4.out" },
        delay: 0.2,
      });

      // Masked title line reveal
      tl.fromTo(
        `.${styles.lineInner}`,
        { yPercent: 115, rotateZ: 1.5 },
        {
          yPercent: 0,
          rotateZ: 0,
          duration: 1.1,
          stagger: 0.08,
        }
      )
        // Subtle fade for monospace HUD details & CTA
        .fromTo(
          `.${styles.meta}`,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.06,
            ease: "power2.out",
          },
          "-=0.7"
        );
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className={styles.landing}>
      {/* Top / Side Micro HUD — frames the ASCII canvas */}
      <div className={styles.topRow}>
        <span className={styles.meta}>[SYS // ASCII_VIEWPORT]</span>
        <span className={styles.meta}>MESH_01 : CARCHARODON</span>
      </div>

      {/* Center is intentionally empty for the 3D ASCII model */}
      <div className={styles.canvasSpacer} />

      {/* Bottom Perimeter: Headline Left, Minimal Action Right */}
      <div className={styles.bottomRow}>
        <div className={styles.heroText}>
          <p className={`${styles.kicker} ${styles.meta}`}>
            <span className={styles.dot} /> REALTIME SHADER EXPERIMENT
          </p>
          <h1 className={styles.title}>
            <span className={styles.lineMask}>
              <span className={styles.lineInner}>Form in raw</span>
            </span>
            <span className={styles.lineMask}>
              <span className={styles.lineInner}>characters.</span>
            </span>
          </h1>
        </div>

        <div className={`${styles.bottomRight} ${styles.meta}`}>
          <p className={styles.description}>
            Interactive WebGL &amp; ASCII studies exploring low-fi rasterization
            and spatial motion.
          </p>
          <div className={styles.actions}>
            <a href="#work" className={styles.cta}>
              <span>Explore Index</span>
              <span className={styles.arrow}>↘</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}