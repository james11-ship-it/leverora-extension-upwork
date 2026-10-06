import type { Thread } from "@shared/types";
import { CONTENT_PORT_NAME, type BackgroundToContentMsg, type ContentToBackgroundMsg } from "@shared/messaging";
import { watchThreadChanges } from "./thread-detect";
import { getSelectorConfig, findMessageContainer, findConversationHeader } from "./selectors";
import { readFullThread, watchIncrementalMessages } from "./reader";
import { injectText } from "./injector";

let stopIncremental: (() => void) | null = null;
let currentThreadKey: string | null = null;
let port: chrome.runtime.Port | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;

function send(msg: ContentToBackgroundMsg) {
  try {
    port?.postMessage(msg);
  } catch {
    // Port is closed (service worker went to sleep). The disconnect handler
    // reconnects and re-announces the thread, which re-sends everything.
  }
}

function reportFailure(reason: string) {
  send({
    type: "reader_failed",
    event: { type: "reader_failed", reason, threadKey: currentThreadKey, timestamp: Date.now() }
  });
}

async function attachToThread(threadKey: string) {
  const config = await getSelectorConfig();
  const container = findMessageContainer(config);
  if (!container) {
    reportFailure("message_container_not_found");
    return;
  }

  stopIncremental?.();
  stopIncremental = watchIncrementalMessages(container, config, (messages) => {
    send({ type: "messages_batch", threadKey, messages });
  });
}

async function onThreadChange(threadKey: string | null) {
  stopIncremental?.();
  stopIncremental = null;
  currentThreadKey = threadKey;

  if (!threadKey) {
    send({ type: "thread_cleared" });
    return;
  }

  const config = await getSelectorConfig();
  const thread: Thread = {
    threadKey,
    clientName: findConversationHeader(config) ?? "",
    categorySlug: null,
    briefNotes: "",
    lastMessageId: null,
    messageCount: 0,
    planId: null
  };
  send({ type: "thread_detected", thread });
  await attachToThread(threadKey);
}

function handleBackgroundMessage(msg: BackgroundToContentMsg) {
  if (msg.type === "read_full_thread") {
    void (async () => {
      const config = await getSelectorConfig();
      const container = findMessageContainer(config);
      if (!container) {
        reportFailure("message_container_not_found");
        return;
      }
      const result = await readFullThread(container, config);
      if (result.status === "failed") {
        reportFailure(result.reason);
        return;
      }
      if (currentThreadKey) {
        send({ type: "messages_batch", threadKey: currentThreadKey, messages: result.messages });
      }
    })();
  } else if (msg.type === "inject_text") {
    void (async () => {
      const config = await getSelectorConfig();
      const ok = injectText(config, msg.text);
      if (!ok) reportFailure("compose_field_not_found");
    })();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  reconnectAttempts += 1;
  setTimeout(() => {
    connectPort();
    if (port) {
      reconnectAttempts = 0;
      // The restarted service worker lost its in-memory state, so announce
      // the current thread again and re-read its messages.
      if (currentThreadKey) void onThreadChange(currentThreadKey);
    } else {
      scheduleReconnect();
    }
  }, 500);
}

function connectPort() {
  try {
    port = chrome.runtime.connect({ name: CONTENT_PORT_NAME });
  } catch {
    // Extension was reloaded or updated: this content script is orphaned.
    port = null;
    return;
  }
  const thisPort = port;
  thisPort.onMessage.addListener(handleBackgroundMessage);
  thisPort.onDisconnect.addListener(() => {
    if (port === thisPort) port = null;
    scheduleReconnect();
  });
}

connectPort();
watchThreadChanges((threadKey) => void onThreadChange(threadKey));
