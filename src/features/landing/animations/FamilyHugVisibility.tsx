"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./FamilyHug.module.css";

export function FamilyHugVisibility({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || motion.matches || !("IntersectionObserver" in window)) return;

    // Hold the original first frame until the illustration itself is visible.
    // A small threshold also works when enlarged text makes the section very tall.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.15)) {
          return;
        }
        element.dataset.motion = "playing";
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    element.dataset.motion = "waiting";
    observer.observe(element);

    // Switching to reduced motion settles the pose permanently for this mount.
    const settle = () => {
      if (!motion.matches) return;
      observer.disconnect();
      delete element.dataset.motion;
    };
    motion.addEventListener("change", settle);

    return () => {
      observer.disconnect();
      motion.removeEventListener("change", settle);
      delete element.dataset.motion;
    };
  }, []);

  return (
    <div ref={ref} className={styles.family} aria-hidden="true">
      {children}
    </div>
  );
}
