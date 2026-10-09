import { useEffect, useState } from "react";
import { usePanelStore } from "../store";
import { ErrorNotice } from "./ErrorNotice";
import { Muted, PrimaryButton, ProgressBar, Section, Sheet } from "./ui";

type Mode = "new" | "update";

function ConfirmExecuteSheet({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const estimate = usePanelStore((s) => (mode === "update" ? s.estimates.execute_update : s.estimates.execute));
  const creditBalance = usePanelStore((s) => s.creditBalance);
  const executePlan = usePanelStore((s) => s.executePlan);
  const updateProject = usePanelStore((s) => s.updateProject);
  const insufficientCredits = creditBalance !== null && estimate !== undefined && creditBalance < estimate;
  const cost = estimate !== undefined ? ` ≈${estimate} credits` : " an estimated cost";

  return (
    <Sheet title={mode === "update" ? "Update project" : "Execute project"} onClose={onClose}>
      <Muted>
        {mode === "update"
          ? `Applies the plan changes to your existing project. Only the changed parts are generated, so it costs less than a new build — up to${cost}.`
          : `This runs automated code execution in a sandbox on the Leverora side for up to${cost}. This is the most expensive action — it can't be undone once started.`}
      </Muted>
      {insufficientCredits && <ErrorNotice message="insufficient_credits" />}
      <PrimaryButton
        onClick={() => {
          if (mode === "update") updateProject();
          else executePlan();
          onClose();
        }}
        disabled={insufficientCredits}
      >
        Confirm & run{estimate !== undefined ? ` · ≈${estimate} credits` : ""}
      </PrimaryButton>
    </Sheet>
  );
}

function DoneView({ onUpdate }: { onUpdate: () => void }) {
  const plan = usePanelStore((s) => s.plan);
  const builtPlanVersion = usePanelStore((s) => s.builtPlanVersion);
  const updateEstimate = usePanelStore((s) => s.estimates.execute_update);
  const requestEstimate = usePanelStore((s) => s.requestEstimate);
  const openProject = usePanelStore((s) => s.openProject);
  const executeError = usePanelStore((s) => s.executeError);
  const planIsNewer = !!plan && plan.version > (builtPlanVersion ?? plan.version);

  useEffect(() => {
    requestEstimate("execute_update");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Project is ready.</span>
        <PrimaryButton small onClick={openProject}>
          Open project
        </PrimaryButton>
      </div>
      {/* A failed update keeps the previous project; the error explains why the update didn't land. */}
      {executeError && <ErrorNotice message={executeError} />}
      {planIsNewer ? (
        <PrimaryButton onClick={onUpdate}>
          Update project to plan v{plan?.version}
          {updateEstimate !== undefined ? ` · ≈${updateEstimate} credits` : ""}
        </PrimaryButton>
      ) : (
        <Muted>Want changes? Revise the plan above, then update the project here — cheaper than a new build.</Muted>
      )}
    </div>
  );
}

export function ExecuteSection() {
  const [confirmMode, setConfirmMode] = useState<Mode | null>(null);
  const plan = usePanelStore((s) => s.plan);
  const job = usePanelStore((s) => s.job);
  const executeStatus = usePanelStore((s) => s.executeStatus);
  const executeError = usePanelStore((s) => s.executeError);
  const requestEstimate = usePanelStore((s) => s.requestEstimate);
  const estimate = usePanelStore((s) => s.estimates.execute);

  useEffect(() => {
    requestEstimate("execute");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!plan) return null;

  return (
    <Section>
      <div className="flex flex-col gap-2 px-3 py-2">
        {executeStatus === "done" && job ? (
          <DoneView onUpdate={() => setConfirmMode("update")} />
        ) : executeStatus === "starting" || executeStatus === "running" ? (
          <>
            <ProgressBar percent={job?.percent} />
            <Muted>{job?.message ?? (executeStatus === "starting" ? "Starting execution…" : "Working on it…")}</Muted>
          </>
        ) : (
          <>
            {executeStatus === "error" && <ErrorNotice message={executeError} />}
            <PrimaryButton onClick={() => setConfirmMode("new")}>
              Execute project{estimate !== undefined ? ` · ≈${estimate} credits` : ""}
            </PrimaryButton>
          </>
        )}
      </div>
      {confirmMode && <ConfirmExecuteSheet mode={confirmMode} onClose={() => setConfirmMode(null)} />}
    </Section>
  );
}
