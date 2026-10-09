import { create } from "zustand";
import type { Attachment, CategorySlug, JobProgress, Msg, PlanRef, Suggestion, Thread } from "@shared/types";
import type { BackgroundToPanelMsg, EditSession, EstimateAction, ExecuteStatus, FetchStatus, PanelToBackgroundMsg, PlanStatus } from "@shared/messaging";

type SuggestionStatus = "idle" | "loading" | "done" | "error";

type PanelState = {
  authenticated: boolean;
  thread: Thread | null;
  messages: Msg[];
  suggestion: Suggestion | null;
  suggestionStatus: SuggestionStatus;
  suggestionError: string | null;
  creditBalance: number | null;
  creditBalanceStatus: FetchStatus;
  estimates: Partial<Record<EstimateAction, number>>;
  estimateStatuses: Partial<Record<EstimateAction, FetchStatus>>;
  plan: PlanRef | null;
  planStatus: PlanStatus;
  planError: string | null;
  job: JobProgress | null;
  executeStatus: ExecuteStatus;
  executeError: string | null;
  builtPlanVersion: number | null;
  editSession: EditSession | null;
  /** null = automatic: open until a plan exists, so the panel isn't a long scroll once you move on to planning. */
  suggestionsOpen: boolean | null;
  loading: boolean;
  login: () => void;
  requestFullRead: () => void;
  setCategory: (categorySlug: CategorySlug | null) => void;
  setBriefNotes: (notes: string) => void;
  requestSuggestions: () => void;
  injectSuggestion: (text: string) => void;
  requestEstimate: (action: EstimateAction) => void;
  buyCredits: () => void;
  createPlan: (attachment: string, files: Attachment[]) => void;
  revisePlan: (note: string, files: Attachment[]) => void;
  openPlan: () => void;
  executePlan: () => void;
  updateProject: () => void;
  openProject: () => void;
  setSuggestionsOpen: (open: boolean | null) => void;
  editRevisePlan: (note: string, files: Attachment[]) => void;
  editUpdateProject: () => void;
  editOpenPlan: () => void;
  editOpenProject: () => void;
  closeEdit: () => void;
};

export const usePanelStore = create<PanelState>((_set, get) => ({
  authenticated: false,
  thread: null,
  messages: [],
  suggestion: null,
  suggestionStatus: "idle",
  suggestionError: null,
  creditBalance: null,
  creditBalanceStatus: "idle",
  estimates: {},
  estimateStatuses: {},
  plan: null,
  planStatus: "idle",
  planError: null,
  job: null,
  executeStatus: "idle",
  executeError: null,
  builtPlanVersion: null,
  editSession: null,
  suggestionsOpen: null,
  loading: true,
  login: () => send({ type: "login" }),
  requestFullRead: () => send({ type: "request_full_read" }),
  setCategory: (categorySlug) => {
    const threadKey = get().thread?.threadKey;
    if (!threadKey) return;
    usePanelStore.setState((s) => (s.thread ? { thread: { ...s.thread, categorySlug } } : s));
    send({ type: "set_category", threadKey, categorySlug });
  },
  setBriefNotes: (notes) => {
    const threadKey = get().thread?.threadKey;
    if (!threadKey) return;
    usePanelStore.setState((s) => (s.thread ? { thread: { ...s.thread, briefNotes: notes } } : s));
    send({ type: "set_brief_notes", threadKey, notes });
  },
  requestSuggestions: () => {
    usePanelStore.setState({ suggestionStatus: "loading", suggestionError: null, suggestionsOpen: true });
    send({ type: "request_suggestions" });
  },
  injectSuggestion: (text) => send({ type: "inject_suggestion", text }),
  requestEstimate: (action) => send({ type: "request_estimate", action }),
  buyCredits: () => send({ type: "buy_credits" }),
  createPlan: (attachment, files) => {
    usePanelStore.setState({ planStatus: "building", planError: null });
    send({ type: "create_plan", attachment, files });
  },
  revisePlan: (note, files) => {
    usePanelStore.setState({ planStatus: "revising", planError: null });
    send({ type: "revise_plan", note, files });
  },
  openPlan: () => send({ type: "open_plan" }),
  executePlan: () => {
    usePanelStore.setState({ executeStatus: "starting", executeError: null, job: null });
    send({ type: "execute_plan" });
  },
  updateProject: () => {
    usePanelStore.setState({ executeStatus: "starting", executeError: null, job: null });
    send({ type: "update_project" });
  },
  openProject: () => send({ type: "open_project" }),
  setSuggestionsOpen: (open) => usePanelStore.setState({ suggestionsOpen: open }),
  editRevisePlan: (note, files) => send({ type: "edit_revise_plan", note, files }),
  editUpdateProject: () => send({ type: "edit_update_project" }),
  editOpenPlan: () => send({ type: "edit_open_plan" }),
  editOpenProject: () => send({ type: "edit_open_project" }),
  closeEdit: () => send({ type: "close_edit" })
}));

function send(msg: PanelToBackgroundMsg) {
  chrome.runtime.sendMessage(msg).catch(() => undefined);
}

function applyState(msg: BackgroundToPanelMsg) {
  if (msg.type === "state") {
    // A different thread gets a fresh, automatic suggestions toggle.
    const threadChanged = usePanelStore.getState().thread?.threadKey !== msg.thread?.threadKey;
    usePanelStore.setState({
      authenticated: msg.authenticated,
      thread: msg.thread,
      messages: msg.messages,
      suggestion: msg.suggestion,
      suggestionStatus: msg.suggestionStatus,
      suggestionError: msg.suggestionError,
      creditBalance: msg.creditBalance,
      creditBalanceStatus: msg.creditBalanceStatus,
      estimates: msg.estimates,
      estimateStatuses: msg.estimateStatuses,
      plan: msg.plan,
      planStatus: msg.planStatus,
      planError: msg.planError,
      job: msg.job,
      executeStatus: msg.executeStatus,
      executeError: msg.executeError,
      builtPlanVersion: msg.builtPlanVersion,
      editSession: msg.editSession,
      ...(threadChanged ? { suggestionsOpen: null } : {}),
      loading: false
    });
  } else if (msg.type === "thread_updated") {
    usePanelStore.setState({ thread: msg.thread, messages: msg.messages });
  } else if (msg.type === "suggestions_update") {
    if (usePanelStore.getState().thread?.threadKey !== msg.threadKey) return;
    usePanelStore.setState({ suggestion: msg.suggestion, suggestionStatus: msg.done ? "done" : "loading" });
  } else if (msg.type === "suggestions_error") {
    if (usePanelStore.getState().thread?.threadKey !== msg.threadKey) return;
    usePanelStore.setState({ suggestionStatus: "error", suggestionError: msg.message });
  } else if (msg.type === "balance_update") {
    usePanelStore.setState({ creditBalance: msg.balance, creditBalanceStatus: "loaded" });
  } else if (msg.type === "balance_error") {
    usePanelStore.setState({ creditBalanceStatus: "error" });
  } else if (msg.type === "estimate_update") {
    usePanelStore.setState((s) => ({
      estimates: { ...s.estimates, [msg.action]: msg.credits },
      estimateStatuses: { ...s.estimateStatuses, [msg.action]: "loaded" }
    }));
  } else if (msg.type === "estimate_error") {
    usePanelStore.setState((s) => ({ estimateStatuses: { ...s.estimateStatuses, [msg.action]: "error" } }));
  } else if (msg.type === "plan_update") {
    if (usePanelStore.getState().thread?.threadKey !== msg.threadKey) return;
    usePanelStore.setState({ plan: msg.plan, planStatus: msg.status, planError: null });
  } else if (msg.type === "plan_error") {
    if (usePanelStore.getState().thread?.threadKey !== msg.threadKey) return;
    usePanelStore.setState({ planStatus: "error", planError: msg.message });
  } else if (msg.type === "job_update") {
    if (usePanelStore.getState().thread?.threadKey !== msg.threadKey) return;
    usePanelStore.setState({ job: msg.job, executeStatus: msg.status, executeError: null });
  } else if (msg.type === "job_error") {
    if (usePanelStore.getState().thread?.threadKey !== msg.threadKey) return;
    usePanelStore.setState({ executeStatus: "error", executeError: msg.message });
  }
}

export function initPanelStore() {
  chrome.runtime.onMessage.addListener((msg: BackgroundToPanelMsg) => {
    applyState(msg);
  });
  chrome.runtime
    .sendMessage({ type: "get_state" } satisfies PanelToBackgroundMsg)
    .then((response) => response && applyState(response as BackgroundToPanelMsg))
    .catch(() => usePanelStore.setState({ loading: false }));
}
