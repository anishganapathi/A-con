const TITLE = "Acon";
const TITLE_BAR_LOGO = "/logo.png";

export function TitleBar() {
  return (
    <header className="title-bar">
      <img
        alt="Dell"
        className="title-bar-sponsor dell"
        decoding="async"
        draggable={false}
        src="/dell.svg"
      />
      <div className="title-bar-brand">
        <img
          alt=""
          className="title-bar-logo"
          decoding="async"
          draggable={false}
          src={TITLE_BAR_LOGO}
        />
        <span className="title-bar-name">{TITLE}</span>
      </div>
      <img
        alt="NVIDIA"
        className="title-bar-sponsor nvidia"
        decoding="async"
        draggable={false}
        src="/nvidia.svg"
      />
      <button type="button" className="title-bar-help" aria-label="Help">
        <HelpIcon />
      </button>
    </header>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 17h.01"
      />
    </svg>
  );
}
