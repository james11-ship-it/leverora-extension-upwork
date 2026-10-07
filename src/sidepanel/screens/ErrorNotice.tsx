import { usePanelStore } from "../store";

/**
 * Red error line. "insufficient_credits" (HTTP 402 from the server, or the
 * local balance check) becomes a friendly message with a Buy credits button.
 */
export function ErrorNotice({ message }: { message: string | null }) {
  const buyCredits = usePanelStore((s) => s.buyCredits);
  if (!message) return null;

  if (message === "insufficient_credits") {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-lg p-2"
        style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}
      >
        <span className="text-xs" style={{ color: "var(--danger)" }}>
          Not enough credits.
        </span>
        <button
          onClick={buyCredits}
          className="rounded px-3 py-1 text-xs font-medium text-white"
          style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
        >
          Buy credits
        </button>
      </div>
    );
  }

  return (
    <p className="text-xs" style={{ color: "var(--danger)" }}>
      Failed: {message}
    </p>
  );
}
