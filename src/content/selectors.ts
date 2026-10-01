import type { SelectorConfig } from "@shared/types";

const CACHE_KEY = "leverora:selectors:upwork";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Ground-truth defaults, used until the remote config loads (or if it never
// does). The `up-*`/`story-*`/`is-user-profile-and-account` classes are
// real Upwork markup, confirmed live against an actual message thread
// (Sep 2026) — the data-testid/ARIA entries alongside them are speculative
// fallbacks in case Upwork adds those attributes later, not currently
// present. Priority inside each field: confirmed real class > speculative
// data-testid/ARIA > structural heuristic.
const FALLBACK_CONFIG: SelectorConfig = {
  version: "fallback-1",
  platform: "upwork",
  messageContainer: [".story-list", '[data-testid="messages-list"]', '[role="log"]'],
  messageItem: [".story-section", '[data-testid="message-item"]', '[role="listitem"]'],
  authorName: [".user-name", '[data-testid="message-author"]'],
  messageTimestamp: [".story-timestamp", '[data-testid="message-timestamp"]', "time"],
  messageText: [".up-d-message", '[data-testid="message-text"]'],
  composeField: [".ProseMirror[contenteditable=\"true\"]", '[data-testid="message-compose-input"]', '[role="textbox"]', "textarea"],
  ownProfileName: [".is-user-profile-and-account strong", '[data-testid="own-profile-name"]'],
  conversationHeader: [".room-title-wrapper h4", '[data-testid="conversation-header"]', "header h1", "header h2"]
};

type CachedSelectors = { fetchedAt: number; config: SelectorConfig };

async function readCache(): Promise<CachedSelectors | null> {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cached = stored[CACHE_KEY] as CachedSelectors | undefined;
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
  return cached;
}

async function writeCache(config: SelectorConfig): Promise<void> {
  const entry: CachedSelectors = { fetchedAt: Date.now(), config };
  await chrome.storage.local.set({ [CACHE_KEY]: entry });
}

/**
 * Selector config is fetched via the background worker (it owns the
 * Leverora API client) and cached locally for 24h. Falls back to the
 * baked-in defaults if the fetch fails or the cache is stale with no network.
 */
export async function getSelectorConfig(): Promise<SelectorConfig> {
  const cached = await readCache();
  if (cached) return cached.config;

  try {
    const response = await chrome.runtime.sendMessage({ type: "fetch_selectors" });
    if (response?.config) {
      await writeCache(response.config);
      return response.config as SelectorConfig;
    }
  } catch {
    // background unreachable or request failed — fall through to defaults
  }
  return FALLBACK_CONFIG;
}

function firstMatch<T extends Element>(root: ParentNode, selectors: string[]): T | null {
  for (const selector of selectors) {
    const found = root.querySelector<T>(selector);
    if (found) return found;
  }
  return null;
}

function allMatches<T extends Element>(root: ParentNode, selectors: string[]): T[] {
  for (const selector of selectors) {
    const found = root.querySelectorAll<T>(selector);
    if (found.length > 0) return Array.from(found);
  }
  return [];
}

/**
 * Structural heuristic, used when every configured selector misses: the
 * largest scrollable element whose children share a repeated tag/class shape.
 */
export function findContainerHeuristically(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("div, section, main, ul"));
  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const el of candidates) {
    const isScrollable = el.scrollHeight > el.clientHeight + 40;
    if (!isScrollable || el.children.length < 3) continue;

    const tagCounts = new Map<string, number>();
    for (const child of Array.from(el.children)) {
      const key = `${child.tagName}.${child.className}`;
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    }
    const repeatCount = Math.max(...tagCounts.values());
    const score = repeatCount * el.children.length;
    if (repeatCount >= 3 && score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

export function findMessageContainer(config: SelectorConfig): HTMLElement | null {
  return firstMatch<HTMLElement>(document, config.messageContainer) ?? findContainerHeuristically();
}

export function findMessageItems(container: HTMLElement, config: SelectorConfig): HTMLElement[] {
  const matched = allMatches<HTMLElement>(container, config.messageItem);
  if (matched.length > 0) return matched;
  // Structural fallback: direct children with the most common shape.
  return Array.from(container.children) as HTMLElement[];
}

export function findAuthor(item: HTMLElement, config: SelectorConfig): string | null {
  return firstMatch<HTMLElement>(item, config.authorName)?.textContent?.trim() ?? null;
}

export function findTimestamp(item: HTMLElement, config: SelectorConfig): number | null {
  const el = firstMatch<HTMLElement>(item, config.messageTimestamp);
  if (!el) return null;
  // Upwork's .story-timestamp shows only a relative time ("11:51 PM") as
  // textContent — the full date lives in its `title` attribute
  // ("July 13, 2026 at 11:51 PM"). datetime is checked first in case a
  // future/alternate element uses the more standard <time datetime> pattern.
  const value = el.getAttribute("datetime") ?? el.getAttribute("title") ?? el.textContent;
  // Chrome's Date.parse rejects the literal word "at" in that format
  // (confirmed live: "July 13, 2026 at 11:51 PM" -> NaN) — stripping it
  // down to a plain space parses correctly and matches the displayed time.
  const normalized = value?.replace(" at ", " ") ?? null;
  const parsed = normalized ? Date.parse(normalized) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

export function findMessageText(item: HTMLElement, config: SelectorConfig): string | null {
  return firstMatch<HTMLElement>(item, config.messageText)?.textContent?.trim() ?? item.textContent?.trim() ?? null;
}

export function findComposeField(config: SelectorConfig): HTMLElement | null {
  return firstMatch<HTMLElement>(document, config.composeField);
}

/** The logged-in freelancer's own name, read from the account/nav area (not the thread). */
export function findOwnProfileName(config: SelectorConfig): string | null {
  return firstMatch<HTMLElement>(document, config.ownProfileName)?.textContent?.trim() ?? null;
}

export function findConversationHeader(config: SelectorConfig): string | null {
  return firstMatch<HTMLElement>(document, config.conversationHeader)?.textContent?.trim() ?? null;
}
