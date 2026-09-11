import tapAwareness from "../assets/tap-awareness.svg";
export default function ConservationNote({
  compact = false,
  title = "Close the tap. Keep the habit.",
  children,
}) {
  return (
    <aside
      className={`conservation-note ${compact ? "compact" : ""}`}
      aria-label="Water conservation reminder"
    >
      <img
        src={tapAwareness}
        width="320"
        height="240"
        alt="Brass tap at a tiled campus wash point, with a water drop and a green leaf"
      />
      <div>
        <span className="eyebrow">EVERY DROP COUNTS</span>
        <h2>{title}</h2>
        <p>
          {children ||
            "Check taps after use and report persistent drips to your campus maintenance team."}
        </p>
      </div>
    </aside>
  );
}
