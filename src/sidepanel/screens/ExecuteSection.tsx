import { useEffect, useState } from "react";
import { usePanelStore } from "../store";

function ConfirmExecuteModal({ onClose }: { onClose: () => void }) {
  const estimate = usePanelStore((s) => s.estimates.execute);
  const creditBalance = usePanelStore((s) => s.creditBalance);
  const executePlan = usePanelStore((s) => s.executePlan);
  const insufficientCredits = creditBalance !== null && estimate !== undefined && creditBalance < estimate;

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center p-3" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="flex w-full flex-col gap-3 rounded-lg border p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">Execute project</span>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          This runs automated code execution in a sandbox (Claude Agent SDK, on the Leverora side) for
          {estimate !== undefined ? ` ≈${estimate} credits` : " an estimated cost"}. This is the most expensive action — it can't be undone once started.
        </p>
        {insufficientCredits && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            Not enough credits for this.
          </p>
        )}
        <button
          onClick={() => {
            executePlan();
            onClose();
          }}
          disabled={insufficientCredits}
          className="rounded-lg px-4 py-2 text-center font-medium text-white disabled:opacity-40"
          style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
        >
          Confirm & run{estimate !== undefined ? ` · ≈${estimate} credits` : ""}
        </button>
      </div>
    </div>
  );
}

function JobProgressView() {
  const job = usePanelStore((s) => s.job);
  const executeStatus = usePanelStore((s) => s.executeStatus);
  const executeError = usePanelStore((s) => s.executeError);
  const openProject = usePanelStore((s) => s.openProject);

  if (executeStatus === "done" && job) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Project is ready.
        </p>
        <button
          onClick={openProject}
          className="w-full rounded-lg px-4 py-2 text-center font-medium text-white"
          style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
        >
          Open project on Leverora
        </button>
      </div>
    );
  }

  if (executeStatus === "error") {
    return (
      <p className="text-xs" style={{ color: "var(--danger)" }}>
        Failed: {executeError}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-elevated)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            background: "var(--accent)",
            width: job?.percent !== null && job?.percent !== undefined ? `${job.percent}%` : "35%"
          }}
        />
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {job?.message ?? (executeStatus === "starting" ? "Starting execution…" : "Working on it…")}
      </p>
    </div>
  );
}

export function ExecuteSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const plan = usePanelStore((s) => s.plan);
  const executeStatus = usePanelStore((s) => s.executeStatus);
  const requestEstimate = usePanelStore((s) => s.requestEstimate);
  const estimate = usePanelStore((s) => s.estimates.execute);

  useEffect(() => {
    requestEstimate("execute");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!plan) return null;

  const isActive = executeStatus !== "idle";

  return (
    <div className="border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
      {isActive ? (
        <JobProgressView />
      ) : (
        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full rounded-lg px-4 py-2 text-center font-medium text-white"
          style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
        >
          Execute project{estimate !== undefined ? ` · ≈${estimate} credits` : ""}
        </button>
      )}
      {confirmOpen && <ConfirmExecuteModal onClose={() => setConfirmOpen(false)} />}
    </div>
  );
}
