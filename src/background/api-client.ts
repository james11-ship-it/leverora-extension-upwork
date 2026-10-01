import { getAccessToken, refreshAccessToken } from "./auth";
import { API_BASE } from "@shared/config";
import type { Attachment, CategorySlug, Estimate, JobProgress, Msg, PlanRef, SelectorConfig, Suggestion } from "@shared/types";

/**
 * The only place in the extension that touches tokens or calls the Leverora
 * API. Content scripts and the side panel go through background messages —
 * see plan §4. Endpoints themselves already exist server-side (plan §6);
 * this just calls them per the documented contract.
 */
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json"
      }
    });

  let response = await doFetch();
  if (response.status === 401) {
    token = await refreshAccessToken();
    response = await doFetch();
  }
  return response;
}

export async function fetchSelectorConfig(platform: "upwork"): Promise<SelectorConfig | null> {
  try {
    const response = await authedFetch(`/api/selectors?platform=${platform}`);
    if (!response.ok) return null;
    return (await response.json()) as SelectorConfig;
  } catch {
    return null;
  }
}

export type BalanceResult = { ok: true; credits: number } | { ok: false; message: string };

// Not in plan §6's endpoint table — the auth sequence diagram (plan §6) has
// the service worker hand the panel "balance and profile" right after
// exchange, implying a profile/balance call, but doesn't name it. Confirm
// the real path and response shape with Leverora before shipping.
const BALANCE_PATH = "/api/me";

export async function fetchBalance(): Promise<BalanceResult> {
  try {
    const response = await authedFetch(BALANCE_PATH);
    if (!response.ok) return { ok: false, message: `balance_failed_${response.status}` };
    const payload = (await response.json()) as { credits: number };
    return { ok: true, credits: payload.credits };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }
}

export type EstimateResult = { ok: true; estimate: Estimate } | { ok: false; message: string };

export async function fetchEstimate(action: Estimate["action"], contextLength: number): Promise<EstimateResult> {
  try {
    const response = await authedFetch("/api/estimate", {
      method: "POST",
      body: JSON.stringify({ action, contextLength })
    });
    if (!response.ok) return { ok: false, message: `estimate_failed_${response.status}` };
    const payload = (await response.json()) as { credits: number };
    return { ok: true, estimate: { action, credits: payload.credits } };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }
}

export type StreamSuggestionsParams = {
  messages: Msg[];
  categorySlug: CategorySlug;
  briefNotes: string;
};

export type StreamResult = { ok: true } | { ok: false; message: string };

/** Shared SSE frame reader: calls `onFrame` with each `data:` line's raw text. */
async function consumeSSE(response: Response, onFrame: (data: string) => void): Promise<StreamResult> {
  if (!response.body) return { ok: false, message: "no_response_body" };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        onFrame(dataLine.slice("data:".length).trim());
      }
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "stream_error" };
  }

  return { ok: true };
}

// Wire format assumption (plan §6 specifies "SSE stream" but not the exact
// frame shape): each `data:` line is a JSON snapshot of the whole Suggestion
// so far, `done: true` marks the final frame. Confirm against the real
// /api/suggest implementation before relying on this in production.
type SuggestFrame = Suggestion & { done?: boolean };

export async function streamSuggestions(params: StreamSuggestionsParams, onUpdate: (suggestion: Suggestion, done: boolean) => void): Promise<StreamResult> {
  let response: Response;
  try {
    response = await authedFetch("/api/suggest", {
      method: "POST",
      body: JSON.stringify(params)
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }

  if (!response.ok) return { ok: false, message: `suggest_failed_${response.status}` };

  return consumeSSE(response, (data) => {
    const payload = JSON.parse(data) as SuggestFrame;
    onUpdate(payload, payload.done ?? false);
  });
}

export type PlanResult = { ok: true; plan: PlanRef } | { ok: false; message: string };

export type CreatePlanParams = {
  messages: Msg[];
  categorySlug: CategorySlug;
  briefNotes: string;
  attachment: string;
  attachments: Attachment[];
};

// Response shape assumption (plan §6 only says the output is a plan_id):
// we take plan_id and default version/status/pdfUrl when the server doesn't
// send them yet. Confirm the real /api/plan response shape with Leverora.
type PlanResponse = { plan_id: string; version?: number; status?: PlanRef["status"]; pdf_url?: string | null };

function planFromResponse(payload: PlanResponse): PlanRef {
  return {
    planId: payload.plan_id,
    version: payload.version ?? 1,
    status: payload.status ?? "ready",
    pdfUrl: payload.pdf_url ?? null
  };
}

export async function createPlan(params: CreatePlanParams): Promise<PlanResult> {
  try {
    const response = await authedFetch("/api/plan", {
      method: "POST",
      body: JSON.stringify(params)
    });
    if (!response.ok) return { ok: false, message: `plan_failed_${response.status}` };
    return { ok: true, plan: planFromResponse((await response.json()) as PlanResponse) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }
}

export async function revisePlan(planId: string, note: string, attachments: Attachment[]): Promise<PlanResult> {
  try {
    const response = await authedFetch(`/api/plan/${planId}/revise`, {
      method: "POST",
      body: JSON.stringify({ note, attachments })
    });
    if (!response.ok) return { ok: false, message: `plan_revise_failed_${response.status}` };
    return { ok: true, plan: planFromResponse((await response.json()) as PlanResponse) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }
}

export type ExecuteResult = { ok: true; jobId: string } | { ok: false; message: string };

// Response shape assumption (plan §6 only names the output "job_id").
type ExecuteResponse = { job_id: string };

export async function executePlan(planId: string): Promise<ExecuteResult> {
  try {
    const response = await authedFetch("/api/execute", {
      method: "POST",
      body: JSON.stringify({ plan_id: planId })
    });
    if (!response.ok) return { ok: false, message: `execute_failed_${response.status}` };
    const payload = (await response.json()) as ExecuteResponse;
    return { ok: true, jobId: payload.job_id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }
}

// Wire format assumption, same caveat as SuggestFrame above: each `data:`
// line is a snapshot of job progress so far. `done` is inferred from
// `status` when the server doesn't send it explicitly. Confirm the real
// /api/jobs/[id]/stream frame shape with Leverora — plan §7 lists the
// mandatory guardrails (maxTurns cap, sandbox teardown) that live entirely
// server-side and produce whatever this stream actually reports.
type JobFrame = Partial<JobProgress> & { done?: boolean };

export async function streamJobProgress(jobId: string, onUpdate: (progress: JobProgress, done: boolean) => void): Promise<StreamResult> {
  let response: Response;
  try {
    response = await authedFetch(`/api/jobs/${jobId}/stream`);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network_error" };
  }

  if (!response.ok) return { ok: false, message: `job_stream_failed_${response.status}` };

  return consumeSSE(response, (data) => {
    const frame = JSON.parse(data) as JobFrame;
    const status = frame.status ?? "running";
    const progress: JobProgress = { jobId, status, message: frame.message ?? null, percent: frame.percent ?? null };
    onUpdate(progress, frame.done ?? (status === "done" || status === "error"));
  });
}
