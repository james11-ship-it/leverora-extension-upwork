import { messageId } from "@shared/hash";
import type { Msg, ReaderFailedEvent, SelectorConfig } from "@shared/types";
import { findAuthor, findMessageItems, findMessageText, findOwnProfileName, findTimestamp } from "./selectors";

const MAX_MESSAGES = 500;
const READ_DEADLINE_MS = 60_000;
const IDLE_ROUNDS_LIMIT = 3;
const SCROLL_SETTLE_MS = 400;

export type ReaderFailedHandler = (event: ReaderFailedEvent) => void;

function waitForMutationOr(container: HTMLElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    });
    observer.observe(container, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeoutMs);
  });
}

/**
 * Reads whatever message elements are currently in the DOM into `collected`,
 * keyed by hash(author + timestamp + first80Chars). Safe to call repeatedly
 * mid-scroll: Upwork virtualizes the list, so elements come and go.
 *
 * `ownName` is the logged-in freelancer's own display name (findOwnProfileName)
 * — Upwork's message markup carries no own/other class, so isOwn is decided
 * by comparing each message's author name against it. A null/unresolved
 * ownName means every message is treated as not-own (the previous
 * hardcoded behavior) rather than guessing.
 */
export async function harvest(
  container: HTMLElement,
  config: SelectorConfig,
  collected: Map<string, Msg>,
  ownName: string | null
): Promise<void> {
  const items = findMessageItems(container, config);
  for (const item of items) {
    const author = findAuthor(item, config);
    const timestamp = findTimestamp(item, config);
    const text = findMessageText(item, config);
    if (!author || !text || timestamp === null) continue;

    const id = await messageId(author, timestamp, text);
    if (!collected.has(id)) {
      collected.set(id, { id, author, timestamp, text, isOwn: ownName !== null && author === ownName });
    }
  }
}

export function byTimestamp(a: Msg, b: Msg): number {
  return a.timestamp - b.timestamp;
}

export type ReadResult =
  | { status: "ok"; messages: Msg[] }
  | { status: "truncated"; messages: Msg[]; reason: "message_limit" | "deadline" }
  | { status: "failed"; reason: string };

/**
 * Scrolls the thread to the top, harvesting as it goes, until three
 * consecutive rounds add nothing new (or a hard limit is hit). Mirrors the
 * algorithm in section 5 of the extension plan.
 */
export async function readFullThread(container: HTMLElement, config: SelectorConfig): Promise<ReadResult> {
  const collected = new Map<string, Msg>();
  const ownName = findOwnProfileName(config);
  let idleRounds = 0;
  const deadline = Date.now() + READ_DEADLINE_MS;

  try {
    while (idleRounds < IDLE_ROUNDS_LIMIT && Date.now() < deadline && collected.size < MAX_MESSAGES) {
      const before = collected.size;
      await harvest(container, config, collected, ownName);
      container.scrollTop = 0;
      await waitForMutationOr(container, SCROLL_SETTLE_MS);
      await harvest(container, config, collected, ownName);
      idleRounds = collected.size === before ? idleRounds + 1 : 0;
    }
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  }

  const messages = [...collected.values()].sort(byTimestamp);
  if (collected.size >= MAX_MESSAGES) return { status: "truncated", messages, reason: "message_limit" };
  if (Date.now() >= deadline) return { status: "truncated", messages, reason: "deadline" };
  return { status: "ok", messages };
}

/**
 * Cheap incremental reader for the steady state: a MutationObserver on the
 * container that re-harvests and reports only messages newer than
 * `lastMessageId` was seen. Caller tracks lastMessageId across calls.
 */
export function watchIncrementalMessages(
  container: HTMLElement,
  config: SelectorConfig,
  onNewMessages: (messages: Msg[]) => void
): () => void {
  const seen = new Map<string, Msg>();
  const ownName = findOwnProfileName(config);

  const flush = async () => {
    const before = new Set(seen.keys());
    await harvest(container, config, seen, ownName);
    const added = [...seen.values()].filter((m) => !before.has(m.id));
    if (added.length > 0) onNewMessages(added.sort(byTimestamp));
  };

  const observer = new MutationObserver(() => void flush());
  observer.observe(container, { childList: true, subtree: true });
  void flush();

  return () => observer.disconnect();
}
