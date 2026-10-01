import { API_BASE, AUTH_URL } from "@shared/config";

const REFRESH_TOKEN_KEY = "leverora:refresh_token";

type TokenState = { accessToken: string; expiresAt: number } | null;

// In-memory only: the service worker is killed when idle, so this is
// expected to be lost and rebuilt from the refresh token (plan §6).
let tokenState: TokenState = null;

async function getStoredRefreshToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(REFRESH_TOKEN_KEY);
  return (stored[REFRESH_TOKEN_KEY] as string | undefined) ?? null;
}

async function storeRefreshToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [REFRESH_TOKEN_KEY]: token });
}

async function clearRefreshToken(): Promise<void> {
  await chrome.storage.local.remove(REFRESH_TOKEN_KEY);
}

type ExchangeResponse = { access_token: string; refresh_token: string; expires_in: number };

function applyTokens(payload: ExchangeResponse): void {
  tokenState = { accessToken: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };
  void storeRefreshToken(payload.refresh_token);
}

export function startLogin(): void {
  chrome.tabs.create({ url: `${AUTH_URL}?extensionId=${chrome.runtime.id}` });
}

/** Called from the externally_connectable listener when Leverora hands back the short-lived code. */
export async function exchangeCode(code: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    if (!response.ok) return false;
    applyTokens((await response.json()) as ExchangeResponse);
    return true;
  } catch {
    return false;
  }
}

// Not in plan §6's endpoint table (only /api/auth/exchange is listed), but
// rotation requires a refresh call — confirm the exact path with Leverora.
const REFRESH_PATH = "/api/auth/refresh";

// Refresh tokens rotate on every use, so two concurrent refreshes racing on
// the same stored token isn't safe: whichever request loses treats the
// winner's brand-new (rotated) token as invalid and wipes it, logging the
// user out right after a successful refresh. This is the common case, not
// an edge case — the service worker is routinely woken by several messages
// in quick succession, each independently deciding the token is stale.
// De-duping in-flight refreshes into a single shared call fixes it.
let refreshInFlight: Promise<string | null> | null = null;

/** Refresh tokens rotate on every use — the old one is invalid after this call. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}${REFRESH_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) {
      await clearRefreshToken();
      tokenState = null;
      return null;
    }
    const payload = (await response.json()) as ExchangeResponse;
    applyTokens(payload);
    return payload.access_token;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (tokenState && tokenState.expiresAt > Date.now() + 5_000) {
    return tokenState.accessToken;
  }
  return refreshAccessToken();
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

export async function logout(): Promise<void> {
  tokenState = null;
  await clearRefreshToken();
}
