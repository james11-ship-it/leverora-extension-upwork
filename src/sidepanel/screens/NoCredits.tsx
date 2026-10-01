import { usePanelStore } from "../store";

export function NoCredits() {
  const estimate = usePanelStore((s) => s.estimates.suggest);
  const creditBalance = usePanelStore((s) => s.creditBalance);
  const buyCredits = usePanelStore((s) => s.buyCredits);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-medium">Not enough credits</p>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Needed: <span className="mono">≈{estimate ?? "—"}</span> · Balance: <span className="mono">{creditBalance ?? "—"}</span>
      </p>
      <button
        onClick={buyCredits}
        className="rounded-lg px-4 py-2 font-medium text-white"
        style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
      >
        Buy credits
      </button>
    </div>
  );
}
