async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function threadKeyFromRoomId(roomId: string): Promise<string> {
  return sha256Hex(`upwork:${roomId}`);
}

export async function messageId(author: string, timestamp: number, text: string): Promise<string> {
  return sha256Hex(`${author}|${timestamp}|${text.slice(0, 80)}`);
}
