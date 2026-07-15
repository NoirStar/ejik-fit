"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

type RectMap = Map<string, DOMRect>;

function reducedMotionRequested() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function useDemandLayoutAnimation(
  containerRef: RefObject<HTMLOListElement | null>,
  layoutKey: string,
) {
  const previousRects = useRef<RectMap>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rows = Array.from(
      container.querySelectorAll<HTMLElement>("[data-skill-row]"),
    );
    const nextRects: RectMap = new Map();
    const reduceMotion = reducedMotionRequested();

    rows.forEach((row) => {
      const id = row.dataset.skillRow;
      if (!id) return;
      const nextRect = row.getBoundingClientRect();
      const previousRect = previousRects.current.get(id);
      nextRects.set(id, nextRect);

      if (reduceMotion || typeof row.animate !== "function") return;

      if (!previousRect) {
        row.animate(
          [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 190, easing: "ease-out" },
        );
        return;
      }

      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaY) < 1) return;
      row.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 380, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    });

    previousRects.current = nextRects;
  }, [containerRef, layoutKey]);
}
