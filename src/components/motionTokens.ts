import type { Transition } from "motion/react";

/**
 * One curve for the whole interface, so a folding panel, a folding tray and the
 * mode switch all decelerate the same way. It matches the cubic the CSS already
 * uses when a control swells under a press.
 */
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** A panel leaving toward its own edge, or arriving from it. */
export const SWEEP: Transition = { duration: 0.32, ease: EASE };

/** A tray folding open or shut inside the rail. */
export const TRAY: Transition = { duration: 0.22, ease: EASE };

/** A handle appearing where a panel just was. */
export const POP: Transition = { duration: 0.18, ease: EASE };

/** Plan against experience: a dissolve, because the whole scene is replaced. */
export const DISSOLVE: Transition = { duration: 0.26, ease: "easeInOut" };

/** The pill travelling between the two mode tabs. */
export const PILL: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};
