import type { Attachment, JobProgress, Msg, PlanRef, Suggestion, Thread } from "@shared/types";
import { BILLING_URL, planUrl, projectUrl } from "@shared/config";
import {
  CONTENT_PORT_NAME,
  type BackgroundToPanelMsg,
  type ContentToBackgroundMsg,
  type EstimateAction,
  type ExecuteStatus,
  type FetchStatus,
  type PanelToBackgroundMsg,
  type PlanStatus
} from "@shared/messaging";
import { exchangeCode, isAuthenticated, startLogin } from "./auth";
import { createPlan, executePlan, fetchBalance, fetchEstimate, fetchSelectorConfig, revisePlan, streamJobProgress, streamSuggestions } from "./api-client";
import { getThreadMeta, saveThreadMeta } from "./thread-store";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

// Lost on service worker restart by design — content script re-announces
// the thread on reconnect (plan §5). Category/notes/plan/job survive
// restarts via thread-store.ts; messages are cheap to re-harvest and aren't
// persisted.
let activeThread: Thread | null = null;
let activeMessages: Msg[] = [];
let activeSuggestion: Suggestion | null = null;
let suggestionStatus: "idle" | "loading" | "done" | "error" = "idle";
let suggestionError: string | null = null;
let contentPort: chrome.runtime.Port | null = null;

let creditBalance: number | null = null;
let creditBalanceStatus: FetchStatus = "idle";
let estimates: Partial<Record<EstimateAction, number>> = {};
let estimateStatuses: Partial<Record<EstimateAction, FetchStatus>> = {};

let activePlan: PlanRef | null = null;
let planStatus: PlanStatus = "idle";
let planError: string | null = null;

let activeJob: JobProgress | null = null;
let executeStatus: ExecuteStatus = "idle";
let executeError: string | null = null;

function panelState(authenticated: boolean): Extract<BackgroundToPanelMsg, { type: "state" }> {
  return {
    type: "state",
    thread: activeThread,
    messages: activeMessages,
    authenticated,
    suggestion: activeSuggestion,
    suggestionStatus,
    suggestionError,
    creditBalance,
    creditBalanceStatus,
    estimates,
    estimateStatuses,
    plan: activePlan,
    planStatus,
    planError,
    job: activeJob,
    executeStatus,
    executeError
  };
}

async function broadcastState() {
  const msg = panelState(await isAuthenticated());
  chrome.runtime.sendMessage(msg).catch(() => undefined);
}

function broadcast(msg: BackgroundToPanelMsg) {
  chrome.runtime.sendMessage(msg).catch(() => undefined);
}

function resetSuggestionState() {
  activeSuggestion = null;
  suggestionStatus = "idle";
  suggestionError = null;
}

function resetEstimates() {
  estimates = {};
  estimateStatuses = {};
}

/**
 * A previously-created plan's planId survives restarts via thread-store,
 * but there's no documented GET /api/plan/[id] (plan §6) to refetch its
 * version/status/pdfUrl — so a restored plan only knows its id. The "Open
 * on Leverora" link still works; version/status just aren't shown until the
 * user revises it again in this session.
 */
function restorePlanRef(planId: string | null): PlanRef | null {
  return planId ? { planId, version: 1, status: "ready", pdfUrl: null } : null;
}

function resetPlanState(planId: string | null) {
  activePlan = restorePlanRef(planId);
  planStatus = activePlan ? "ready" : "idle";
  planError = null;
}

function resetExecuteState() {
  activeJob = null;
  executeStatus = "idle";
  executeError = null;
}

/** Context length is a rough proxy (plan §6 doesn't pin down the exact unit): total characters across the thread plus brief notes. */
function currentContextLength(): number {
  const messagesLength = activeMessages.reduce((sum, m) => sum + m.text.length, 0);
  return messagesLength + (activeThread?.briefNotes.length ?? 0);
}

async function refreshBalance() {
  creditBalanceStatus = "loading";
  void broadcastState();
  const result = await fetchBalance();
  if (result.ok) {
    creditBalance = result.credits;
    creditBalanceStatus = "loaded";
    broadcast({ type: "balance_update", balance: result.credits });
  } else {
    creditBalanceStatus = "error";
    broadcast({ type: "balance_error", message: result.message });
  }
}

async function refreshEstimate(action: EstimateAction) {
  if (!activeThread) return;
  const threadKey = activeThread.threadKey;
  estimateStatuses = { ...estimateStatuses, [action]: "loading" };
  void broadcastState();
  const result = await fetchEstimate(action, currentContextLength());
  if (activeThread?.threadKey !== threadKey) return; // thread switched mid-request
  if (result.ok) {
    estimates = { ...estimates, [action]: result.estimate.credits };
    estimateStatuses = { ...estimateStatuses, [action]: "loaded" };
    broadcast({ type: "estimate_update", action, credits: result.estimate.credits });
  } else {
    estimateStatuses = { ...estimateStatuses, [action]: "error" };
    broadcast({ type: "estimate_error", action, message: result.message });
  }
}

/** Attaches to a job's SSE progress stream — used both right after starting a new job and when resuming one across a service worker restart. */
function watchJob(jobId: string, threadKey: string) {
  void streamJobProgress(jobId, (progress) => {
    if (activeThread?.threadKey !== threadKey) return; // user switched threads mid-stream
    activeJob = progress;
    executeStatus = progress.status === "done" ? "done" : progress.status === "error" ? "error" : "running";
    broadcast({ type: "job_update", threadKey, job: progress, status: executeStatus });
    if (progress.status === "done") void refreshBalance(); // execution charges actual usage server-side (plan §6)
  }).then((result) => {
    if (activeThread?.threadKey !== threadKey) return;
    if (!result.ok) {
      executeStatus = "error";
      executeError = result.message;
      broadcast({ type: "job_error", threadKey, message: result.message });
    }
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CONTENT_PORT_NAME) return;
  contentPort = port;

  port.onMessage.addListener((msg: ContentToBackgroundMsg) => {
    switch (msg.type) {
      case "thread_detected":
        void getThreadMeta(msg.thread.threadKey).then((meta) => {
          activeThread = { ...msg.thread, ...meta };
          activeMessages = [];
          resetSuggestionState();
          resetEstimates();
          resetPlanState(meta.planId);
          resetExecuteState();
          if (meta.jobId) {
            // Job may already be finished server-side; the stream should
            // still report its final status when we re-subscribe.
            activeJob = { jobId: meta.jobId, status: "running", message: null, percent: null };
            executeStatus = "running";
            watchJob(meta.jobId, msg.thread.threadKey);
          }
          void broadcastState();
          if (activeThread.categorySlug) {
            void refreshEstimate("suggest");
            void refreshEstimate("execute");
          }
        });
        break;
      case "thread_cleared":
        activeThread = null;
        activeMessages = [];
        resetSuggestionState();
        resetEstimates();
        resetPlanState(null);
        resetExecuteState();
        void broadcastState();
        break;
      case "messages_batch": {
        if (activeThread?.threadKey !== msg.threadKey) break;
        const byId = new Map(activeMessages.map((m) => [m.id, m]));
        for (const m of msg.messages) byId.set(m.id, m);
        activeMessages = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
        activeThread = {
          ...activeThread,
          messageCount: activeMessages.length,
          lastMessageId: activeMessages.at(-1)?.id ?? null
        };
        void broadcastState();
        // thread_detected fires the first estimate before any real messages
        // have arrived (activeMessages is []), so it's computed on ~empty
        // context — refresh now that real content is in, and again on every
        // later batch so the badge (and the credit gate that reads the same
        // number) tracks what will actually be sent.
        if (activeThread.categorySlug) {
          void refreshEstimate("suggest");
          void refreshEstimate("execute");
        }
        break;
      }
      case "reader_failed":
        console.warn("[leverora] reader_failed", msg.event);
        // TODO: forward to Leverora telemetry endpoint once available.
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (contentPort === port) contentPort = null;
  });
});

function hasEnoughCredits(action: EstimateAction): boolean {
  const cost = estimates[action];
  return !(creditBalance !== null && cost !== undefined && creditBalance < cost);
}

function handleRequestSuggestions() {
  if (!activeThread?.categorySlug || activeMessages.length === 0) return;
  if (!hasEnoughCredits("suggest")) {
    broadcast({ type: "suggestions_error", threadKey: activeThread.threadKey, message: "insufficient_credits" });
    return;
  }

  const threadKey = activeThread.threadKey;
  const categorySlug = activeThread.categorySlug;
  const briefNotes = activeThread.briefNotes;

  suggestionStatus = "loading";
  suggestionError = null;
  void broadcastState();

  void streamSuggestions({ messages: activeMessages.slice(-30), categorySlug, briefNotes }, (suggestion, done) => {
    if (activeThread?.threadKey !== threadKey) return; // user switched threads mid-stream
    activeSuggestion = suggestion;
    suggestionStatus = done ? "done" : "loading";
    broadcast({ type: "suggestions_update", threadKey, suggestion, done });
  }).then((result) => {
    if (activeThread?.threadKey !== threadKey) return;
    if (!result.ok) {
      suggestionStatus = "error";
      suggestionError = result.message;
      broadcast({ type: "suggestions_error", threadKey, message: result.message });
    } else {
      void refreshBalance(); // the endpoint charges actual usage server-side (plan §6) — pull the new balance
    }
  });
}

function handleCreatePlan(attachment: string, files: Attachment[]) {
  if (!activeThread?.categorySlug || activeMessages.length === 0) return;
  if (!hasEnoughCredits("plan")) {
    planStatus = "error";
    planError = "insufficient_credits";
    broadcast({ type: "plan_error", threadKey: activeThread.threadKey, message: "insufficient_credits" });
    return;
  }

  const threadKey = activeThread.threadKey;
  const categorySlug = activeThread.categorySlug;
  const briefNotes = activeThread.briefNotes;

  planStatus = "building";
  planError = null;
  void broadcastState();

  void createPlan({ messages: activeMessages, categorySlug, briefNotes, attachment, attachments: files }).then((result) => {
    if (activeThread?.threadKey !== threadKey) return;
    if (result.ok) {
      activePlan = result.plan;
      planStatus = "ready";
      void saveThreadMeta(threadKey, { planId: result.plan.planId });
      broadcast({ type: "plan_update", threadKey, plan: result.plan, status: "ready" });
      void refreshBalance();
    } else {
      planStatus = "error";
      planError = result.message;
      broadcast({ type: "plan_error", threadKey, message: result.message });
    }
  });
}

function handleRevisePlan(note: string, files: Attachment[]) {
  if (!activeThread || !activePlan) return;
  if (!hasEnoughCredits("plan_revise")) {
    planStatus = "error";
    planError = "insufficient_credits";
    broadcast({ type: "plan_error", threadKey: activeThread.threadKey, message: "insufficient_credits" });
    return;
  }

  const threadKey = activeThread.threadKey;
  const planId = activePlan.planId;

  planStatus = "revising";
  planError = null;
  void broadcastState();

  void revisePlan(planId, note, files).then((result) => {
    if (activeThread?.threadKey !== threadKey) return;
    if (result.ok) {
      activePlan = result.plan;
      planStatus = "ready";
      broadcast({ type: "plan_update", threadKey, plan: result.plan, status: "ready" });
      void refreshBalance();
    } else {
      planStatus = "error";
      planError = result.message;
      broadcast({ type: "plan_error", threadKey, message: result.message });
    }
  });
}

function handleExecutePlan() {
  if (!activeThread || !activePlan) return;
  if (!hasEnoughCredits("execute")) {
    executeStatus = "error";
    executeError = "insufficient_credits";
    broadcast({ type: "job_error", threadKey: activeThread.threadKey, message: "insufficient_credits" });
    return;
  }

  const threadKey = activeThread.threadKey;
  const planId = activePlan.planId;

  executeStatus = "starting";
  executeError = null;
  activeJob = null;
  void broadcastState();

  void executePlan(planId).then((result) => {
    if (activeThread?.threadKey !== threadKey) return;
    if (!result.ok) {
      executeStatus = "error";
      executeError = result.message;
      broadcast({ type: "job_error", threadKey, message: result.message });
      return;
    }
    activeJob = { jobId: result.jobId, status: "queued", message: null, percent: null };
    executeStatus = "running";
    void saveThreadMeta(threadKey, { jobId: result.jobId });
    broadcast({ type: "job_update", threadKey, job: activeJob, status: "running" });
    watchJob(result.jobId, threadKey);
  });
}

chrome.runtime.onMessage.addListener((message: PanelToBackgroundMsg | { type: "fetch_selectors" }, _sender, sendResponse) => {
  if (message.type === "fetch_selectors") {
    void fetchSelectorConfig("upwork").then((config) => sendResponse({ config }));
    return true;
  }

  switch (message.type) {
    case "get_state":
      void isAuthenticated().then(async (authenticated) => {
        if (authenticated && creditBalanceStatus === "idle") void refreshBalance();
        sendResponse(panelState(authenticated));
      });
      return true;
    case "login":
      startLogin();
      return false;
    case "request_full_read":
      contentPort?.postMessage({ type: "read_full_thread" });
      return false;
    case "set_category":
      void saveThreadMeta(message.threadKey, { categorySlug: message.categorySlug }).then(() => {
        if (activeThread?.threadKey === message.threadKey) {
          activeThread = { ...activeThread, categorySlug: message.categorySlug };
          resetSuggestionState();
          void broadcastState();
          if (message.categorySlug) {
            void refreshEstimate("suggest");
            void refreshEstimate("execute");
          }
        }
      });
      return false;
    case "set_brief_notes":
      void saveThreadMeta(message.threadKey, { briefNotes: message.notes }).then(() => {
        if (activeThread?.threadKey === message.threadKey) {
          activeThread = { ...activeThread, briefNotes: message.notes };
        }
      });
      return false;
    case "request_suggestions":
      handleRequestSuggestions();
      return false;
    case "inject_suggestion":
      contentPort?.postMessage({ type: "inject_text", text: message.text });
      return false;
    case "request_estimate":
      void refreshEstimate(message.action);
      return false;
    case "buy_credits":
      chrome.tabs.create({ url: BILLING_URL });
      return false;
    case "create_plan":
      handleCreatePlan(message.attachment, message.files);
      return false;
    case "revise_plan":
      handleRevisePlan(message.note, message.files);
      return false;
    case "open_plan":
      if (activePlan) chrome.tabs.create({ url: planUrl(activePlan.planId) });
      return false;
    case "execute_plan":
      handleExecutePlan();
      return false;
    case "open_project":
      if (activeJob) chrome.tabs.create({ url: projectUrl(activeJob.jobId) });
      return false;
    default:
      return false;
  }
});

// Leverora web app hands back the short-lived auth code, and later pushes
// credit-balance updates after a purchase, through externally_connectable
// (plan §6). Exact "credits_updated" message shape is assumed — refetch the
// balance from the server rather than trusting a pushed number.
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === "auth_code") {
    void exchangeCode(message.code).then((ok) => {
      if (ok) {
        void broadcastState();
        void refreshBalance();
      }
      sendResponse({ ok });
    });
    return true;
  }
  if (message?.type === "credits_updated") {
    void refreshBalance();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
