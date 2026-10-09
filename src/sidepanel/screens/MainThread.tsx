import { useEffect, useRef, useState } from "react";
import type { Attachment, PlanRef } from "@shared/types";
import { usePanelStore } from "../store";
import { AttachmentPicker } from "./AttachmentPicker";
import { ExecuteSection } from "./ExecuteSection";
import { ErrorNotice } from "./ErrorNotice";
import { CreditsBadge, Muted, PrimaryButton, Section, SectionHeader, Sheet, textareaClass, textareaStyle } from "./ui";

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

// Long drafts are clamped so a single suggestion can't push everything else
// off screen; "Show more" opens the full text.
const CLAMP_CHARS = 280;

function SuggestionCard({ label, text }: { label: string; text: string }) {
  const injectSuggestion = usePanelStore((s) => s.injectSuggestion);
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const long = text.length > CLAMP_CHARS;
  return (
    <div className="p-2" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <PrimaryButton small onClick={() => injectSuggestion(text)}>
          Insert
        </PrimaryButton>
      </div>
      <p className={`whitespace-pre-wrap break-words text-sm ${long && !expanded ? "line-clamp-5" : ""}`}>{text}</p>
      {long && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs underline" style={{ color: "var(--accent)" }}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ListCard({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <details className="p-2" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
      <summary className="cursor-pointer text-xs font-medium" style={{ color }}>
        {label} ({items.length})
      </summary>
      <ul className="mt-1 list-disc break-words pl-4 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

function SuggestionsSection() {
  const thread = usePanelStore((s) => s.thread);
  const messages = usePanelStore((s) => s.messages);
  const suggestion = usePanelStore((s) => s.suggestion);
  const status = usePanelStore((s) => s.suggestionStatus);
  const error = usePanelStore((s) => s.suggestionError);
  const plan = usePanelStore((s) => s.plan);
  const suggestionsOpen = usePanelStore((s) => s.suggestionsOpen);
  const setSuggestionsOpen = usePanelStore((s) => s.setSuggestionsOpen);
  const requestSuggestions = usePanelStore((s) => s.requestSuggestions);

  // Automatic until the user toggles it: open while drafting replies, folded
  // away once a plan exists so planning/execution sit at the top.
  const open = suggestionsOpen ?? (!plan || status === "loading");
  const canGenerate = messages.length > 0 && status !== "loading";

  return (
    <Section>
      <SectionHeader
        title="Suggestions"
        open={open}
        onToggle={() => setSuggestionsOpen(!open)}
        meta={!open && suggestion ? "drafts ready" : undefined}
        action={
          <PrimaryButton small onClick={requestSuggestions} disabled={!canGenerate}>
            {status === "loading" ? "Generating…" : "Generate suggestions"}
          </PrimaryButton>
        }
      />

      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {thread?.categorySlug === "legal-document-drafting" && (
            <p className="text-xs" style={{ color: "var(--warning)" }}>
              draft — not legal advice
            </p>
          )}

          {status === "error" && <ErrorNotice message={error} />}

          {!suggestion && status !== "error" && status !== "loading" && <Muted>Generate reply drafts for the latest client message.</Muted>}

          {suggestion && (
            <>
              <SuggestionCard label="Direct reply" text={suggestion.direct} />
              <SuggestionCard label="With questions" text={suggestion.withQuestions} />
              <ListCard label="Questions for the client" items={suggestion.suggestedQuestions} color="var(--text-muted)" />
              <ListCard label="Missing" items={suggestion.missingInfo} color="var(--warning)" />
            </>
          )}
        </div>
      )}
    </Section>
  );
}

function BriefNotes() {
  const briefNotes = usePanelStore((s) => s.thread?.briefNotes ?? "");
  const setBriefNotes = usePanelStore((s) => s.setBriefNotes);
  const [value, setValue] = useState(briefNotes);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  return (
    <Section>
      <SectionHeader
        title="Brief notes"
        open={open}
        onToggle={() => setOpen(!open)}
        meta={!open ? (value.trim() ? value.trim().split("\n")[0] : "optional") : undefined}
      />
      {open && (
        <div className="px-3 pb-3">
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
            className={textareaClass}
            style={textareaStyle}
          />
        </div>
      )}
    </Section>
  );
}

function CreatePlanSheet({ onClose }: { onClose: () => void }) {
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
    <Sheet title="Create plan" onClose={building ? undefined : onClose}>
      {planStatus === "ready" && plan ? (
        <>
          <Muted>Plan is ready (version {plan.version}).</Muted>
          <PrimaryButton
            onClick={() => {
              openPlan();
              onClose();
            }}
          >
            Open on Leverora
          </PrimaryButton>
        </>
      ) : building ? (
        <Muted>Building the plan… this can take a bit longer (full conversation).</Muted>
      ) : (
        <>
          <textarea
            value={attachment}
            onChange={(e) => setAttachment(e.target.value)}
            rows={3}
            placeholder="Additional attachment/requirements for the plan (optional)…"
            className={textareaClass}
            style={textareaStyle}
          />
          <AttachmentPicker files={files} onChange={setFiles} />
          {planStatus === "error" && <ErrorNotice message={planError} />}
          <PrimaryButton onClick={() => createPlan(attachment, files)}>
            Generate plan{estimate !== undefined ? ` · ≈${estimate} credits` : ""}
          </PrimaryButton>
        </>
      )}
    </Sheet>
  );
}

function ReviseSection({ plan }: { plan: PlanRef }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const planStatus = usePanelStore((s) => s.planStatus);
  const planError = usePanelStore((s) => s.planError);
  const executeStatus = usePanelStore((s) => s.executeStatus);
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
    <Section>
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Plan · version {plan.version}</span>
          <button onClick={openPlan} className="shrink-0 text-xs underline" style={{ color: "var(--accent)" }}>
            Open on Leverora
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={executeStatus === "done" ? "What should change in the project?" : "What should change in the plan?"}
          className={textareaClass}
          style={textareaStyle}
        />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <AttachmentPicker files={files} onChange={setFiles} />
          <PrimaryButton
            small
            onClick={() => {
              revisePlan(note, files);
              setNote("");
              setFiles([]);
            }}
            disabled={!note.trim() || revising}
          >
            {revising ? "Building new version…" : `Revise plan${estimate !== undefined ? ` · ≈${estimate} credits` : ""}`}
          </PrimaryButton>
        </div>
        {planStatus === "error" && <ErrorNotice message={planError} />}
      </div>
    </Section>
  );
}

function PlanSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const plan = usePanelStore((s) => s.plan);
  const messages = usePanelStore((s) => s.messages);
  const setSuggestionsOpen = usePanelStore((s) => s.setSuggestionsOpen);

  if (plan) return <ReviseSection plan={plan} />;

  return (
    <Section>
      <div className="px-3 py-2">
        <PrimaryButton
          onClick={() => {
            // Suggestions are done by the time you plan — fold them away.
            setSuggestionsOpen(false);
            setSheetOpen(true);
          }}
          disabled={messages.length === 0}
        >
          Create plan
        </PrimaryButton>
      </div>
      {sheetOpen && <CreatePlanSheet onClose={() => setSheetOpen(false)} />}
    </Section>
  );
}

function MessagesSection() {
  const messages = usePanelStore((s) => s.messages);
  const requestFullRead = usePanelStore((s) => s.requestFullRead);
  const [open, setOpen] = useState(false);

  return (
    <Section>
      <SectionHeader
        title={`${messages.length} messages read`}
        open={open}
        onToggle={() => setOpen(!open)}
        action={
          <button onClick={requestFullRead} className="shrink-0 text-xs underline" style={{ color: "var(--accent)" }}>
            Read full conversation
          </button>
        }
      />
      {open && (
        <div className="px-3 pb-3">
          {messages.length === 0 && <Muted>No messages read in this thread yet.</Muted>}
          <ul className="flex flex-col gap-2">
            {messages.map((m) => (
              <li key={m.id} className="p-2 text-sm" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-card)" }}>
                <div className="flex flex-wrap justify-between gap-x-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="truncate">{m.author}</span>
                  <span className="mono">{new Date(m.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

export function MainThread() {
  const thread = usePanelStore((s) => s.thread);
  const setCategory = usePanelStore((s) => s.setCategory);
  if (!thread) return null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div className="min-w-0">
          <div className="truncate font-medium">{thread.clientName || "Client"}</div>
          <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {thread.categorySlug ? CATEGORY_LABELS[thread.categorySlug] : "no category"}
            {" · "}
            <button onClick={() => setCategory(null)} className="underline">
              change
            </button>
          </div>
        </div>
        <CreditsBadge />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SuggestionsSection />
        <BriefNotes />
        <PlanSection />
        <ExecuteSection />
        <MessagesSection />
      </div>
    </div>
  );
}
