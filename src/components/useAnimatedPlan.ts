import { useEffect, useRef, useState } from "react";
import type { FloorPlan } from "../types/floorPlan";
import { blendPlans, PLAN_TWEEN_MS, sameTopology } from "./blendPlan";

/**
 * The editor plan snaps the moment an action commits. The scene shows this
 * copy instead, so a ridge raise or a room resize eases across a second and a
 * half rather than popping. Rebuilds skip the tween — construction playback
 * already walks those in.
 */
export function useAnimatedPlan(target: FloorPlan): FloorPlan {
  const visual = useRef(target);
  const [displayed, setDisplayed] = useState(target);

  useEffect(() => {
    const from = visual.current;
    if (from === target) {
      return;
    }

    if (prefersReducedMotion() || !sameTopology(from, target)) {
      visual.current = target;
      setDisplayed(target);
      return;
    }

    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / PLAN_TWEEN_MS);
      const next = blendPlans(from, target, t);
      visual.current = t >= 1 ? target : next;
      setDisplayed(visual.current);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return displayed;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
