import type { Thread } from "@shared/types";
import { CONTENT_PORT_NAME, type BackgroundToContentMsg, type ContentToBackgroundMsg } from "@shared/messaging";
import { watchThreadChanges } from "./thread-detect";
import { getSelectorConfig, findMessageContainer, findConversationHeader } from "./selectors";
import { readFullThread, watchIncrementalMessages } from "./reader";
import { injectText } from "./injector";

let stopIncremental: (() => void) | null = null;
let currentThreadKey: string | null = null;

const port = chrome.runtime.connect({ name: CONTENT_PORT_NAME });

function send(msg: ContentToBackgroundMsg) {
  port.postMessage(msg);
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

port.onMessage.addListener((msg: BackgroundToContentMsg) => {
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
});

watchThreadChanges((threadKey) => void onThreadChange(threadKey));
