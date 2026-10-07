import { useEffect, useRef, useState } from "react";
import type { Attachment, PlanRef } from "@shared/types";
import { usePanelStore } from "../store";
import { ExecuteSection } from "./ExecuteSection";
import { ErrorNotice } from "./ErrorNotice";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB — keeps base64 payloads reasonable over the messaging pipeline

function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type || "application/octet-stream", dataUrl: reader.result as string });
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

function AttachmentPicker({ files, onChange }: { files: Attachment[]; onChange: (files: Attachment[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    setError(null);
    const picked = Array.from(fileList);
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is too large (max 8MB).`);
      // Reset here too — Chrome fires no `change` event for re-selecting the
      // same file while the input still holds it, so without this the error
      // sits there with no way to retry until the user picks a different file.
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    try {
      const read = await Promise.all(picked.map(readFileAsAttachment));
      onChange([...files, ...read]);
    } catch {
      setError("Could not read one of the files.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {files.map((f, i) => (
          <span
            key={`${f.name}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            {f.name}
            <button
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              style={{ color: "var(--text-muted)" }}
              aria-label={`Remove ${f.name}`}
            >
              ✕
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full px-2.5 py-1 text-xs"
          style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
        >
          + Attach files
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt"
        className="hidden"
        onChange={(e) => void onFilesSelected(e.target.files)}
      />
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  copywriting: "Copywriting",
  "seo-content-writing": "SEO Content Writing",
  "web-development": "Web Development",
  "ai-agent-chatbot-dev": "AI Agent & Chatbot Dev",
  "data-analysis-bi": "Data Analysis & BI",
  "seo-audit-strategy": "SEO Audit & Strategy",
  "translation-localization": "Translation & Localization",
  "technical-documentation": "Technical Documentation",
  "business-plans-modeling": "Business Plans & Modeling",
  "legal-document-drafting": "Legal Document Drafting"
};

function SuggestionCard({ label, text }: { label: string; text: string }) {
  const injectSuggestion = usePanelStore((s) => s.injectSuggestion);
  if (!text) return null;
  return (
    <div className="rounded-lg p-2" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <button
          onClick={() => injectSuggestion(text)}
          className="rounded px-2 py-0.5 text-xs font-medium text-white"
          style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
        >
          Insert
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

function SuggestionsSection() {
  const thread = usePanelStore((s) => s.thread);
  const messages = usePanelStore((s) => s.messages);
  const suggestion = usePanelStore((s) => s.suggestion);
  const status = usePanelStore((s) => s.suggestionStatus);
  const error = usePanelStore((s) => s.suggestionError);
  const requestSuggestions = usePanelStore((s) => s.requestSuggestions);

  const canGenerate = messages.length > 0 && status !== "loading";
  return (
    <div className="flex flex-col gap-2 border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Suggestions</span>
        <button
          onClick={requestSuggestions}
          disabled={!canGenerate}
          className="rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
        >
          {status === "loading" ? "Generating…" : "Generate suggestions"}
        </button>
      </div>

      {thread?.categorySlug === "legal-document-drafting" && (
        <p className="text-xs" style={{ color: "var(--warning)" }}>
          draft — not legal advice
        </p>
      )}

      {status === "error" && <ErrorNotice message={error} />}

      {suggestion && (
        <div className="flex flex-col gap-2">
          <SuggestionCard label="Direct reply" text={suggestion.direct} />
          <SuggestionCard label="With questions" text={suggestion.withQuestions} />

          {suggestion.suggestedQuestions.length > 0 && (
            <div className="rounded-lg p-2" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Questions for the client
              </span>
              <ul className="mt-1 list-disc pl-4 text-sm">
                {suggestion.suggestedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestion.missingInfo.length > 0 && (
            <div className="rounded-lg p-2" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--warning)" }}>
                Missing
              </span>
              <ul className="mt-1 list-disc pl-4 text-sm">
                {suggestion.missingInfo.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BriefNotes() {
  const briefNotes = usePanelStore((s) => s.thread?.briefNotes ?? "");
  const setBriefNotes = usePanelStore((s) => s.setBriefNotes);
  const [value, setValue] = useState(briefNotes);
  const debounceRef = useRef<number | null>(null);

  return (
    <div className="border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Brief Notes
      </label>
      <textarea
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => setBriefNotes(next), 500);
        }}
        rows={3}
        placeholder="Context the AI should know about this client…"
        className="w-full resize-none rounded-lg border p-2 text-sm outline-none"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
      />
    </div>
  );
}

function CreatePlanModal({ onClose }: { onClose: () => void }) {
  const [attachment, setAttachment] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const planStatus = usePanelStore((s) => s.planStatus);
  const planError = usePanelStore((s) => s.planError);
  const plan = usePanelStore((s) => s.plan);
  const estimate = usePanelStore((s) => s.estimates.plan);
  const requestEstimate = usePanelStore((s) => s.requestEstimate);
  const createPlan = usePanelStore((s) => s.createPlan);
  const openPlan = usePanelStore((s) => s.openPlan);
  const building = planStatus === "building";

  useEffect(() => {
    requestEstimate("plan");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center p-3" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="flex w-full flex-col gap-3 rounded-lg border p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">Create plan</span>
          {!building && (
            <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
              ✕
            </button>
          )}
        </div>

        {planStatus === "ready" && plan ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Plan is ready (version {plan.version}).
            </p>
            <button
              onClick={() => {
                openPlan();
                onClose();
              }}
              className="rounded-lg px-4 py-2 text-center font-medium text-white"
              style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
            >
              Open on Leverora
            </button>
          </div>
        ) : building ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Building the plan… this can take a bit longer (Opus 5, full conversation).
          </p>
        ) : (
          <>
            <textarea
              value={attachment}
              onChange={(e) => setAttachment(e.target.value)}
              rows={3}
              placeholder="Additional attachment/requirements for the plan (optional)…"
              className="w-full resize-none rounded-lg border p-2 text-sm outline-none"
              style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
            />
            <AttachmentPicker files={files} onChange={setFiles} />
            {planStatus === "error" && <ErrorNotice message={planError} />}
            <button
              onClick={() => createPlan(attachment, files)}
              disabled={building}
              className="rounded-lg px-4 py-2 text-center font-medium text-white disabled:opacity-50"
              style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
            >
              Generate plan{estimate !== undefined ? ` · ≈${estimate} credits` : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReviseSection({ plan }: { plan: PlanRef }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const planStatus = usePanelStore((s) => s.planStatus);
  const planError = usePanelStore((s) => s.planError);
  const estimate = usePanelStore((s) => s.estimates.plan_revise);
  const requestEstimate = usePanelStore((s) => s.requestEstimate);
  const revisePlan = usePanelStore((s) => s.revisePlan);
  const openPlan = usePanelStore((s) => s.openPlan);
  const revising = planStatus === "revising";

  useEffect(() => {
    requestEstimate("plan_revise");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Plan · version {plan.version}</span>
        <button onClick={openPlan} className="underline text-xs" style={{ color: "var(--accent)" }}>
          Open on Leverora
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Note for a new plan version…"
        className="w-full resize-none rounded-lg border p-2 text-sm outline-none"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", borderRadius: "var(--radius-card)" }}
      />
      <AttachmentPicker files={files} onChange={setFiles} />
      {planStatus === "error" && <ErrorNotice message={planError} />}
      <button
        onClick={() => revisePlan(note, files)}
        disabled={!note.trim() || revising}
        className="rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
      >
        {revising ? "Building new version…" : `Revise plan${estimate !== undefined ? ` · ≈${estimate} credits` : ""}`}
      </button>
    </div>
  );
}

function PlanSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const plan = usePanelStore((s) => s.plan);
  const messages = usePanelStore((s) => s.messages);

  if (plan) return <ReviseSection plan={plan} />;

  return (
    <div className="border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setModalOpen(true)}
        disabled={messages.length === 0}
        className="w-full rounded-lg px-4 py-2 text-center font-medium text-white disabled:opacity-40"
        style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
      >
        Create plan
      </button>
      {modalOpen && <CreatePlanModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function CreditsBadge() {
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
      <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>
        …
      </span>
    );
  }

  return (
    <span className="mono text-xs" style={{ color: isLow ? "var(--warning)" : "var(--accent)" }}>
      {creditBalance ?? "—"} credits
    </span>
  );
}

export function MainThread() {
  const thread = usePanelStore((s) => s.thread);
  const messages = usePanelStore((s) => s.messages);
  const requestFullRead = usePanelStore((s) => s.requestFullRead);
  const setCategory = usePanelStore((s) => s.setCategory);
  if (!thread) return null;

  return (
    <div className="relative flex h-full flex-col">
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div>
          <div className="font-medium">{thread.clientName || "Client"}</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {thread.categorySlug ? CATEGORY_LABELS[thread.categorySlug] : "no category"}
            {" · "}
            <button onClick={() => setCategory(null)} className="underline">
              change
            </button>
          </div>
        </div>
        <CreditsBadge />
      </header>

      <SuggestionsSection />
      <BriefNotes />
      <PlanSection />
      <ExecuteSection />

      <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{messages.length} messages read</span>
        <button onClick={requestFullRead} className="underline" style={{ color: "var(--accent)" }}>
          Read full conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {messages.length === 0 && (
          <p className="pt-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No messages read in this thread yet.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg p-2 text-sm"
              style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}
            >
              <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{m.author}</span>
                <span className="mono">{new Date(m.timestamp).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
