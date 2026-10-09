import type { CategorySlug } from "@shared/types";

const KEY_PREFIX = "leverora:thread-meta:";

export type ThreadMeta = {
  categorySlug: CategorySlug | null;
  briefNotes: string;
  planId: string | null;
  /** Last known plan version — restored on thread re-open so the panel shows the real version, not 1. */
  planVersion: number | null;
  jobId: string | null;
  /** Plan version jobId was built from; a newer plan version unlocks "Update project". */
  builtPlanVersion: number | null;
};

const DEFAULT_META: ThreadMeta = { categorySlug: null, briefNotes: "", planId: null, planVersion: null, jobId: null, builtPlanVersion: null };

/**
 * Category and brief notes must survive service worker restarts and SPA
 * thread switches — screen 3 in plan §4 requires the category choice to be
 * remembered per thread, not re-asked every time the content script
 * re-announces the thread.
 */
export async function getThreadMeta(threadKey: string): Promise<ThreadMeta> {
  const stored = await chrome.storage.local.get(KEY_PREFIX + threadKey);
  return { ...DEFAULT_META, ...(stored[KEY_PREFIX + threadKey] as Partial<ThreadMeta> | undefined) };
}

export async function saveThreadMeta(threadKey: string, patch: Partial<ThreadMeta>): Promise<ThreadMeta> {
  const current = await getThreadMeta(threadKey);
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY_PREFIX + threadKey]: next });
  return next;
}
