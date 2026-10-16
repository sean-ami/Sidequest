import { useEffect, useRef } from "react";

/** Smoothed pointer position in -1..1 across the viewport, stored in a ref so it never re-renders. */
export function usePointer(ease = 0.08) {
  const pos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 30));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    };
    let raf = 0;
    const tick = () => {
      pos.current.x += (target.x - pos.current.x) * ease;
      pos.current.y += (target.y - pos.current.y) * ease;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
      cancelAnimationFrame(raf);
    };
  }, [ease]);
  return pos;
}
