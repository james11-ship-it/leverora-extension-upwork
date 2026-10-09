import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlan, executePlan, fetchBalance, fetchEstimate, revisePlan, streamJobProgress, streamSuggestions } from "../src/background/api-client";

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined)
      }
    }
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
      controller.close();
    }
  });
  return new Response(body, { status: 200 });
}

describe("streamSuggestions", () => {
  it("parses SSE frames into incremental suggestion snapshots (see wire-format note in api-client.ts)", async () => {
    const frame1 = `data: ${JSON.stringify({ direct: "Hi", withQuestions: "", suggestedQuestions: [], missingInfo: [] })}\n\n`;
    const frame2 = `data: ${JSON.stringify({
      direct: "Hi there",
      withQuestions: "Hi, what's your budget?",
      suggestedQuestions: ["What's the budget?"],
      missingInfo: [],
      done: true
    })}\n\n`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([frame1, frame2])));

    const updates: Array<{ direct: string; done: boolean }> = [];
    const result = await streamSuggestions({ messages: [], categorySlug: "copywriting", briefNotes: "" }, (s, done) =>
      updates.push({ direct: s.direct, done })
    );

    expect(result.ok).toBe(true);
    expect(updates).toEqual([
      { direct: "Hi", done: false },
      { direct: "Hi there", done: true }
    ]);
  });

  it("reports failure when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const result = await streamSuggestions({ messages: [], categorySlug: "copywriting", briefNotes: "" }, () => undefined);

    expect(result).toEqual({ ok: false, message: "suggest_failed_500" });
  });
});

describe("fetchBalance", () => {
  it("returns the credit balance on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ credits: 42 }), { status: 200 })));
    expect(await fetchBalance()).toEqual({ ok: true, credits: 42 });
  });

  it("reports failure on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    expect(await fetchBalance()).toEqual({ ok: false, message: "balance_failed_403" });
  });
});

describe("fetchEstimate", () => {
  it("returns an Estimate tagged with the requested action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ credits: 13 }), { status: 200 })));
    expect(await fetchEstimate("suggest", 500)).toEqual({ ok: true, estimate: { action: "suggest", credits: 13 } });
  });
});

describe("createPlan", () => {
  it("fills in defaults when the server only sends plan_id (see response-shape note)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ plan_id: "plan_1" }), { status: 200 })));
    const result = await createPlan({ messages: [], categorySlug: "copywriting", briefNotes: "", attachment: "", attachments: [] });
    expect(result).toEqual({ ok: true, plan: { planId: "plan_1", version: 1, status: "ready", pdfUrl: null } });
  });

  it("uses server-provided version/status/pdf_url when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ plan_id: "plan_1", version: 2, status: "revising", pdf_url: "https://x/plan.pdf" }), { status: 200 }))
    );
    const result = await createPlan({ messages: [], categorySlug: "copywriting", briefNotes: "", attachment: "", attachments: [] });
    expect(result).toEqual({ ok: true, plan: { planId: "plan_1", version: 2, status: "revising", pdfUrl: "https://x/plan.pdf" } });
  });
});

describe("revisePlan", () => {
  it("reports failure on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect(await revisePlan("plan_1", "add pricing tiers", [])).toEqual({ ok: false, message: "plan_revise_failed_404" });
  });
});

describe("executePlan", () => {
  it("returns the job id on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ job_id: "job_1" }), { status: 200 })));
    expect(await executePlan("plan_1")).toEqual({ ok: true, jobId: "job_1" });
  });

  it("reports failure on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 402 })));
    expect(await executePlan("plan_1")).toEqual({ ok: false, message: "insufficient_credits" });
  });
});

describe("streamJobProgress", () => {
  it("parses SSE frames and infers done from a terminal status", async () => {
    const frame1 = `data: ${JSON.stringify({ status: "running", message: "Reading plan…", percent: 10 })}\n\n`;
    const frame2 = `data: ${JSON.stringify({ status: "done", message: "Finished", percent: 100 })}\n\n`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([frame1, frame2])));

    const updates: Array<{ status: string; done: boolean }> = [];
    const result = await streamJobProgress("job_1", (progress, done) => updates.push({ status: progress.status, done }));

    expect(result.ok).toBe(true);
    expect(updates).toEqual([
      { status: "running", done: false },
      { status: "done", done: true }
    ]);
  });

  it("reports failure when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const result = await streamJobProgress("job_1", () => undefined);
    expect(result).toEqual({ ok: false, message: "job_stream_failed_404" });
  });
});
