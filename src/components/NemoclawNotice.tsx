import { motion } from "motion/react";
import type { EditNotice } from "../agent/editReview";
import { TRAY } from "./motionTokens";

interface NemoclawNoticeProps {
  notice: EditNotice;
  busy?: boolean;
  onAccept: () => void;
  onFit: () => void;
  onCancel: () => void;
}

/**
 * The background check, shown before a deforming edit reaches the model. It sits
 * in the transcript where the answer belongs, and nothing is applied until one
 * of the three buttons is pressed.
 */
export function NemoclawNotice({
  notice,
  busy = false,
  onAccept,
  onFit,
  onCancel,
}: NemoclawNoticeProps) {
  return (
    <motion.section
      className="nemo-card"
      aria-label="Nemoclaw check"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRAY}
    >
      <header className="nemo-head">
        <NemoclawMark />
        <span className="nemo-brand">
          Supercharged by <strong>Nemoclaw</strong>
        </span>
        <span className={`nemo-tag is-${notice.severity}`}>
          {notice.severity === "overhangs" ? "Overflow" : "Footprint"}
        </span>
      </header>
      <p className="nemo-title">{notice.title}</p>
      <p className="nemo-detail">{notice.detail}</p>
      <p className="nemo-ask">Do you want to continue?</p>
      <div className="nemo-actions">
        <button
          type="button"
          className="nemo-btn is-accept"
          onClick={onAccept}
          disabled={busy}
        >
          Accept
        </button>
        {/* Only offered when the change was phrased as an area, so there is a
            size to fall back to. */}
        {notice.fitLabel ? (
          <button type="button" className="nemo-btn is-fit" onClick={onFit} disabled={busy}>
            {notice.fitLabel}
          </button>
        ) : null}
        <button type="button" className="nemo-btn" onClick={onCancel} disabled={busy}>
          Decline
        </button>
      </div>
    </motion.section>
  );
}

/**
 * Three talons. Drawn inline in currentColor so it stays legible when the panel
 * goes dark; public/nemoclaw.svg is the same mark as a standalone file.
 */
export function NemoclawMark({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="nemo-mark"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.6 5.2C7 8.2 10 12.6 11.4 18.6" />
      <path d="M8.8 3.8C12.2 6.8 15.2 11.2 16.6 17.2" />
      <path d="M14 5.2C17.1 7.9 19.4 11.8 20.6 17" />
    </svg>
  );
}
