"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./style.module.scss";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const NAV_ITEMS = [
  { id: "work", label: "Work", href: "#work" },
  { id: "about", label: "About", href: "#about" },
  { id: "notes", label: "Notes", href: "#notes" },
  { id: "contact", label: "Contact", href: "#contact" },
];

export default function Header() {
  const containerRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const linksRef = useRef<(HTMLAnchorElement | null)[]>([]);

  const [activeTab, setActiveTab] = useState<string>("work");

  useGSAP(
    () => {
      const nav = navRef.current;
      const links = linksRef.current.filter(Boolean);

      if (!nav) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        nav,
        { y: -24, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, delay: 0.1 }
      ).fromTo(
        links,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, stagger: 0.04, duration: 0.4 },
        "-=0.5"
      );

      ScrollTrigger.create({
        start: "top -20",
        end: 99999,
        toggleClass: {
          className: styles.scrolled,
          targets: nav,
        },
      });

      const activeEl = linksRef.current.find((el) => el?.dataset.id === activeTab);
      if (activeEl && indicatorRef.current) {
        gsap.set(indicatorRef.current, {
          x: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          opacity: 1,
        });
      }
    },
    { scope: containerRef }
  );

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!indicatorRef.current) return;
    gsap.to(indicatorRef.current, {
      x: e.currentTarget.offsetLeft,
      width: e.currentTarget.offsetWidth,
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeave = () => {
    const activeEl = linksRef.current.find((el) => el?.dataset.id === activeTab);
    if (!indicatorRef.current || !activeEl) return;

    gsap.to(indicatorRef.current, {
      x: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  return (
    <header ref={containerRef} className={styles.header}>
      <nav ref={navRef} className={styles.navBar} onMouseLeave={handleMouseLeave}>
        <span ref={indicatorRef} className={styles.indicator} />
        
        {NAV_ITEMS.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            data-id={item.id}
            ref={(el) => {
              linksRef.current[index] = el;
            }}
            onMouseEnter={handleMouseEnter}
            onClick={() => setActiveTab(item.id)}
            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}