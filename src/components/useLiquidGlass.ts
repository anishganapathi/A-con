import { useEffect } from "react";

const GLASS_SELECTOR = ".left-rail, .chat-panel, .sheet-block, .construction-hud";

/**
 * Moves the specular highlight on every glass surface to follow the pointer, so
 * the material catches light instead of wearing a painted-on gloss.
 *
 * One listener on the document rather than per-surface handlers: the panels are
 * layered over a WebGL canvas and re-render often, and the highlight is written
 * straight to CSS custom properties so no React state is involved.
 */
export function useLiquidGlass(): void {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frame = 0;
    let pending: PointerEvent | null = null;

    const paint = () => {
      frame = 0;
      const event = pending;
      pending = null;
      if (!event) {
        return;
      }
      for (const element of document.querySelectorAll<HTMLElement>(GLASS_SELECTOR)) {
        const box = element.getBoundingClientRect();
        // Track past the edges so a highlight can approach and leave, but stop
        // far enough out that off-screen panels are not doing work.
        const x = ((event.clientX - box.left) / box.width) * 100;
        const y = ((event.clientY - box.top) / box.height) * 100;
        if (x < -40 || x > 140 || y < -40 || y > 140) {
          element.style.removeProperty("--gx");
          element.style.removeProperty("--gy");
          continue;
        }
        element.style.setProperty("--gx", `${x.toFixed(1)}%`);
        element.style.setProperty("--gy", `${y.toFixed(1)}%`);
      }
    };

    const onMove = (event: PointerEvent) => {
      pending = event;
      frame ||= requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);
}
