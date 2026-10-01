import { threadKeyFromRoomId } from "@shared/hash";

const ROOM_ID_PATTERN = /\/ab\/messages\/rooms\/([a-zA-Z0-9_-]+)/;

export function extractRoomId(url: string): string | null {
  const match = ROOM_ID_PATTERN.exec(url);
  return match ? match[1] : null;
}

export type ThreadChangeHandler = (threadKey: string | null, roomId: string | null) => void;

/**
 * Upwork is a SPA: switching threads doesn't reload the page. Combines a
 * pushState/replaceState/popstate hook with a fallback poll, since some
 * client-side routers mutate history without dispatching either event.
 */
export function watchThreadChanges(onChange: ThreadChangeHandler): () => void {
  let lastRoomId: string | null = null;

  const check = async () => {
    const roomId = extractRoomId(location.href);
    if (roomId === lastRoomId) return;
    lastRoomId = roomId;
    const threadKey = roomId ? await threadKeyFromRoomId(roomId) : null;
    onChange(threadKey, roomId);
  };

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    void check();
  };
  history.replaceState = (...args) => {
    originalReplaceState(...args);
    void check();
  };

  const onPopState = () => void check();
  window.addEventListener("popstate", onPopState);

  // Fallback: some SPA route changes never touch history at all.
  const pollId = window.setInterval(() => void check(), 1500);

  void check();

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
    window.clearInterval(pollId);
  };
}
