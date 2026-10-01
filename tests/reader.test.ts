import { describe, expect, it } from "vitest";
import { harvest, readFullThread } from "../src/content/reader";
import type { SelectorConfig } from "../src/shared/types";

const config: SelectorConfig = {
  version: "test",
  platform: "upwork",
  messageContainer: ['[data-testid="messages-list"]'],
  messageItem: ['[data-testid="message-item"]'],
  authorName: ['[data-testid="message-author"]'],
  messageTimestamp: ["time"],
  messageText: ['[data-testid="message-text"]'],
  composeField: ['[data-testid="message-compose-input"]'],
  ownProfileName: ['[data-testid="own-profile-name"]'],
  conversationHeader: ['[data-testid="conversation-header"]']
};

function buildContainer(items: Array<{ author: string; iso: string; text: string }>): HTMLElement {
  const container = document.createElement("div");
  container.setAttribute("data-testid", "messages-list");
  for (const item of items) {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "message-item");
    el.innerHTML = `
      <div data-testid="message-author">${item.author}</div>
      <time datetime="${item.iso}"></time>
      <div data-testid="message-text">${item.text}</div>
    `;
    container.appendChild(el);
  }
  document.body.appendChild(container);
  return container;
}

describe("harvest", () => {
  it("dedupes messages already collected across repeated calls", async () => {
    const container = buildContainer([
      { author: "Client", iso: "2026-01-01T10:00:00Z", text: "Hello there" },
      { author: "Me", iso: "2026-01-01T10:01:00Z", text: "Hi, thanks for reaching out" }
    ]);
    const collected = new Map();

    await harvest(container, config, collected, null);
    expect(collected.size).toBe(2);

    await harvest(container, config, collected, null);
    expect(collected.size).toBe(2);
  });

  it("skips items missing author, timestamp, or text", async () => {
    const container = document.createElement("div");
    const incomplete = document.createElement("div");
    incomplete.setAttribute("data-testid", "message-item");
    incomplete.innerHTML = `<div data-testid="message-text">No author or time</div>`;
    container.appendChild(incomplete);

    const collected = new Map();
    await harvest(container, config, collected, null);
    expect(collected.size).toBe(0);
  });

  it("marks a message isOwn only when its author matches ownName", async () => {
    const container = buildContainer([
      { author: "Me", iso: "2026-01-01T10:00:00Z", text: "My reply" },
      { author: "Client", iso: "2026-01-01T10:01:00Z", text: "Their message" }
    ]);
    const collected = new Map();

    await harvest(container, config, collected, "Me");

    const messages = [...collected.values()];
    expect(messages.find((m) => m.author === "Me")?.isOwn).toBe(true);
    expect(messages.find((m) => m.author === "Client")?.isOwn).toBe(false);
  });

  it("treats every message as not-own when ownName is unresolved", async () => {
    const container = buildContainer([{ author: "Me", iso: "2026-01-01T10:00:00Z", text: "My reply" }]);
    const collected = new Map();

    await harvest(container, config, collected, null);

    expect([...collected.values()][0].isOwn).toBe(false);
  });
});

describe("readFullThread", () => {
  it("returns messages sorted by timestamp once the container stops changing", async () => {
    const container = buildContainer([
      { author: "Client", iso: "2026-01-01T10:05:00Z", text: "Second message" },
      { author: "Client", iso: "2026-01-01T10:00:00Z", text: "First message" }
    ]);

    const result = await readFullThread(container, config);

    expect(result.status).toBe("ok");
    if (result.status !== "failed") {
      expect(result.messages.map((m) => m.text)).toEqual(["First message", "Second message"]);
    }
  }, 10_000);
});
