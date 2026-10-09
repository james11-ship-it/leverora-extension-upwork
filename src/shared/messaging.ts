import type { Attachment, CategorySlug, Estimate, JobProgress, Msg, PlanRef, ReaderFailedEvent, Suggestion, Thread } from "./types";

export const CONTENT_PORT_NAME = "leverora-content";

export type FetchStatus = "idle" | "loading" | "loaded" | "error";
export type EstimateAction = Estimate["action"];
export type PlanStatus = "idle" | "building" | "ready" | "revising" | "error";
export type ExecuteStatus = "idle" | "starting" | "running" | "done" | "error";

/**
 * "Change project" opened from leverora.com/account/projects: the panel edits
 * an already-built project (revise its plan, then update the project) without
 * needing the Upwork thread it came from.
 */
export type EditSession = {
  title: string;
  categorySlug: CategorySlug | null;
  plan: PlanRef;
  planStatus: PlanStatus;
  planError: string | null;
  /** The project being changed — its files are the starting point of an update. */
  baseJobId: string;
  /** Plan version baseJobId was built from; an update is offered once the plan is newer. */
  builtVersion: number;
  job: JobProgress | null;
  executeStatus: ExecuteStatus;
  executeError: string | null;
  reviseEstimate: number | null;
  updateEstimate: number | null;
};

// Long-lived port messages: content script <-> background (streamed reads).
export type ContentToBackgroundMsg =
  | { type: "thread_detected"; thread: Thread }
  | { type: "thread_cleared" }
  | { type: "messages_batch"; threadKey: string; messages: Msg[] }
  | { type: "reader_failed"; event: ReaderFailedEvent };

export type BackgroundToContentMsg =
  | { type: "read_full_thread" }
  | { type: "inject_text"; text: string };

// One-shot messages: side panel <-> background.
export type PanelToBackgroundMsg =
  | { type: "get_state" }
  | { type: "login" }
  | { type: "set_category"; threadKey: string; categorySlug: CategorySlug | null }
  | { type: "set_brief_notes"; threadKey: string; notes: string }
  | { type: "request_full_read" }
  | { type: "request_suggestions" }
  | { type: "inject_suggestion"; text: string }
  | { type: "request_estimate"; action: EstimateAction }
  | { type: "buy_credits" }
  | { type: "create_plan"; attachment: string; files: Attachment[] }
  | { type: "revise_plan"; note: string; files: Attachment[] }
  | { type: "open_plan" }
  | { type: "execute_plan" }
  | { type: "update_project" }
  | { type: "open_project" }
  | { type: "edit_revise_plan"; note: string; files: Attachment[] }
  | { type: "edit_update_project" }
  | { type: "edit_open_plan" }
  | { type: "edit_open_project" }
  | { type: "close_edit" };

export type BackgroundToPanelMsg =
  | {
      type: "state";
      thread: Thread | null;
      messages: Msg[];
      authenticated: boolean;
      suggestion: Suggestion | null;
      suggestionStatus: "idle" | "loading" | "done" | "error";
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
      /** Plan version the current project was built from (null when nothing was built yet). */
      builtPlanVersion: number | null;
      editSession: EditSession | null;
    }
  | { type: "thread_updated"; thread: Thread; messages: Msg[] }
  | { type: "suggestions_update"; threadKey: string; suggestion: Suggestion; done: boolean }
  | { type: "suggestions_error"; threadKey: string; message: string }
  | { type: "balance_update"; balance: number }
  | { type: "balance_error"; message: string }
  | { type: "estimate_update"; action: EstimateAction; credits: number }
  | { type: "estimate_error"; action: EstimateAction; message: string }
  | { type: "plan_update"; threadKey: string; plan: PlanRef; status: PlanStatus }
  | { type: "plan_error"; threadKey: string; message: string }
  | { type: "job_update"; threadKey: string; job: JobProgress; status: ExecuteStatus }
  | { type: "job_error"; threadKey: string; message: string };
