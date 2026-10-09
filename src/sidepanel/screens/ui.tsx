import type { ReactNode } from "react";
import { usePanelStore } from "../store";

/**
 * Shared building blocks for the compact panel layout: every section can
 * fold down to a single header row, so the panel stays short instead of
 * stacking suggestions, notes, plan and messages into one long scroll.
 */
export function SectionHeader({
  title,
  open,
  onToggle,
  meta,
  action
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-2">
      <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span
          aria-hidden
          className="inline-block shrink-0 text-[9px] transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "none" }}
        >
          ▶
        </span>
        <span className="shrink-0 text-sm font-medium">{title}</span>
        {meta && (
          <span className="min-w-0 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {meta}
          </span>
        )}
      </button>
      {action}
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return (
    <section className="border-b" style={{ borderColor: "var(--border)" }}>
      {children}
    </section>
  );
}

/** Bottom sheet over the whole panel; scrolls on its own when the panel is short. */
export function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center p-2" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="flex max-h-[90vh] w-full flex-col gap-3 overflow-y-auto border p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{title}</span>
          {onClose && (
            <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  small
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${small ? "px-3 py-1 text-xs" : "w-full px-4 py-2 text-sm"} shrink-0 text-center font-medium text-white disabled:opacity-40`}
      style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
    >
      {children}
    </button>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

export function ProgressBar({ percent }: { percent: number | null | undefined }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ background: "var(--accent)", width: percent !== null && percent !== undefined ? `${percent}%` : "35%" }}
      />
    </div>
  );
}

export function CreditsBadge() {
  const creditBalance = usePanelStore((s) => s.creditBalance);
  const creditBalanceStatus = usePanelStore((s) => s.creditBalanceStatus);
  // Plan §10: the header turns yellow once the balance drops below the cost
  // of one execution — that's by far the most expensive action. Falls back
  // to the suggest estimate if execute's isn't loaded yet (e.g. no plan/
  // category chosen so it was never fetched).
  const executeEstimate = usePanelStore((s) => s.estimates.execute);
  const suggestEstimate = usePanelStore((s) => s.estimates.suggest);
  const estimate = executeEstimate ?? suggestEstimate;
  const isLow = creditBalance !== null && estimate !== undefined && creditBalance < estimate;

  if (creditBalanceStatus === "loading" && creditBalance === null) {
    return (
      <span className="mono shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
        …
      </span>
    );
  }

  return (
    <span className="mono shrink-0 text-xs" style={{ color: isLow ? "var(--warning)" : "var(--accent)" }}>
      {creditBalance ?? "—"} credits
    </span>
  );
}

export const textareaClass = "w-full resize-none rounded-lg border p-2 text-sm outline-none";
export const textareaStyle = { background: "var(--bg-elevated)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" };
