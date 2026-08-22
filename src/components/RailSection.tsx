import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TRAY } from "./motionTokens";

interface RailSectionProps {
  label: string;
  /** Read at a glance while the section is folded away. */
  value?: ReactNode;
  defaultOpen?: boolean;
  /**
   * Reopens the section whenever it changes. A fresh selection should not stay
   * hidden because the tray happened to be closed.
   */
  openKey?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * One tray of the left rail. A button and an animated region rather than
 * <details>, because a native disclosure snaps open and cannot be persuaded to
 * ease its height.
 */
export function RailSection({
  label,
  value,
  defaultOpen = true,
  openKey,
  className,
  children,
}: RailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const section = useRef<HTMLDivElement>(null);
  const bodyId = useId();

  // Clicking something in the model is a long way from the rail, and the tray may
  // be folded or below the fold, so it opens itself and scrolls into view. Keyed
  // on what is selected rather than on every edit, so dragging a slider does not
  // scroll the rail out from under the pointer.
  useEffect(() => {
    if (openKey == null) {
      return;
    }
    setOpen(true);
    section.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [openKey]);

  return (
    <div
      ref={section}
      className={className ? `rail-section ${className}` : "rail-section"}
      data-open={open}
    >
      <button
        type="button"
        className="rail-section-summary"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
      >
        <motion.svg
          className="rail-chevron"
          viewBox="0 0 12 12"
          width="11"
          height="11"
          aria-hidden
          animate={{ rotate: open ? 90 : 0 }}
          transition={TRAY}
        >
          <path
            d="M4.5 2.5 8 6l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
        <span className="rail-section-label">{label}</span>
        {value ? <span className="rail-section-value">{value}</span> : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            id={bodyId}
            className="rail-section-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRAY}
          >
            <div className="rail-section-body">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
