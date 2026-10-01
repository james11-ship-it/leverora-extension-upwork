import { describe, expect, it } from "vitest";
import { extractRoomId } from "../src/content/thread-detect";
import { threadKeyFromRoomId } from "../src/shared/hash";

describe("extractRoomId", () => {
  it("extracts the room id from a messages URL", () => {
    expect(extractRoomId("https://www.upwork.com/ab/messages/rooms/room_abc123")).toBe("room_abc123");
  });

  it("returns null outside a messages thread", () => {
    expect(extractRoomId("https://www.upwork.com/nx/jobs/search")).toBeNull();
  });
});

describe("threadKeyFromRoomId", () => {
  it("is deterministic and namespaced per plan §5", async () => {
    const a = await threadKeyFromRoomId("room_abc123");
    const b = await threadKeyFromRoomId("room_abc123");
    const c = await threadKeyFromRoomId("room_other");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
