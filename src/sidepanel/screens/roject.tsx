import { useState } from "react";
import type { Attachment } from "@shared/types";
import type { EditSession } from "@shared/messaging";
import { usePanelStore } from "../store";
import { AttachmentPicker } from "./AttachmentPicker";
import { ErrorNotice } from "./ErrorNotice";
import { CreditsBadge, Muted, PrimaryButton, ProgressBar, Section, textareaClass, textareaStyle } from "./ui";

/**
 * Opened from "Change project" on leverora.com/account/projects: revise the
 * plan of an already-built project, then update the project from it. Works
 * on any tab — it doesn't need the Upwork thread the project came from.
 */
export function EditProject({ session }: { session: EditSession }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [confirming, setConfirming] = useState(false);
  const creditBalance = usePanelStore((s) => s.creditBalance);
  const editRevisePlan = usePanelStore((s) => s.editRevisePlan);
  const editUpdateProject = usePanelStore((s) => s.editUpdateProject);
  const editOpenPlan = usePanelStore((s) => s.editOpenPlan);
  const editOpenProject = usePanelStore((s) => s.editOpenProject);
  const closeEdit = usePanelStore((s) => s.closeEdit);

  const revising = session.planStatus === "revising";
  const running = session.executeStatus === "starting" || session.executeStatus === "running";
  const planIsNewer = session.plan.version > session.builtVersion;
  const updateCost = session.updateEstimate;
  const notEnoughForUpdate = creditBalance !== null && updateCost !== null && creditBalance < updateCost;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="min-w-0">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Change project
          </div>
          <div className="truncate font-medium">{session.title || "Untitled project"}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <CreditsBadge />
          <button onClick={closeEdit} className="text-sm" style={{ color: "var(--text-muted)" }} aria-label="Close" disabled={running}>
            ✕
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section>
          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">1 · Plan · version {session.plan.version}</span>
              <button onClick={editOpenPlan} className="shrink-0 text-xs underline" style={{ color: "var(--accent)" }}>
                Open plan
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What should change? e.g. add a pricing section, switch to a dark theme…"
              className={textareaClass}
              style={textareaStyle}
              disabled={revising || running}
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <AttachmentPicker files={files} onChange={setFiles} />
              <PrimaryButton
                small
                onClick={() => {
                  editRevisePlan(note, files);
                  setNote("");
                  setFiles([]);
                }}
                disabled={!note.trim() || revising || running}
              >
                {revising
                  ? "Building new version…"
                  : `Revise plan${session.reviseEstimate !== null ? ` · ≈${session.reviseEstimate} credits` : ""}`}
              </PrimaryButton>
            </div>
            {session.planStatus === "error" && <ErrorNotice message={session.planError} />}
          </div>
        </Section>

        <Section>
          <div className="flex flex-col gap-2 px-3 py-2">
            <span className="text-sm font-medium">2 · Project</span>

            {running ? (
              <>
                <ProgressBar percent={session.job?.percent} />
                <Muted>{session.job?.message ?? "Updating the project…"}</Muted>
              </>
            ) : (
              <>
                {session.executeStatus === "error" && <ErrorNotice message={session.executeError} />}
                {session.executeStatus === "done" && <Muted>The updated project is ready.</Muted>}

                {planIsNewer ? (
                  confirming ? (
                    <div className="flex flex-col gap-2 p-2" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
                      <Muted>
                        Only the parts the new plan changes are generated, so this costs less than a new build
                        {updateCost !== null ? ` — up to ≈${updateCost} credits` : ""}.
                      </Muted>
                      {notEnoughForUpdate && <ErrorNotice message="insufficient_credits" />}
                      <div className="flex gap-2">
                        <PrimaryButton
                          onClick={() => {
                            editUpdateProject();
                            setConfirming(false);
                          }}
                          disabled={notEnoughForUpdate}
                        >
                          Confirm & update
                        </PrimaryButton>
                        <button
                          onClick={() => setConfirming(false)}
                          className="shrink-0 px-3 text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PrimaryButton onClick={() => setConfirming(true)}>
                      Update project to plan v{session.plan.version}
                      {updateCost !== null ? ` · ≈${updateCost} credits` : ""}
                    </PrimaryButton>
                  )
                ) : (
                  <Muted>Describe the change above and revise the plan first — then update the project here.</Muted>
                )}

                <button onClick={editOpenProject} className="self-start text-xs underline" style={{ color: "var(--accent)" }}>
                  Open {session.executeStatus === "done" ? "updated" : "current"} project
                </button>
              </>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
