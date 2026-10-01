// import.meta.env.DEV only reflects `vite dev` vs `vite build` (the command),
// NOT the --mode flag — a `vite build --mode development` unpacked build
// still has DEV === false. Check MODE instead so `npm run build:dev`
// (mode "development") points at localhost while the real `npm run build`
// (mode "production") points at the live domain. See manifest.config.ts for
// the matching host_permissions/externally_connectable.
const isDev = import.meta.env.MODE !== "production";
export const API_BASE = isDev ? "http://localhost:3000" : "https://api.leverora.com";
// leverora.com (bare) 308-redirects to www.leverora.com — pointing straight
// at the canonical host avoids that hop and, more importantly, matches what
// manifest.config.ts whitelists in externally_connectable (the page that
// calls chrome.runtime.sendMessage must be served from a listed origin;
// after a redirect it'd be www, not the bare domain).
export const WEB_BASE = isDev ? "http://localhost:3000" : "https://www.leverora.com";
export const AUTH_URL = `${WEB_BASE}/extension/auth`;
export const BILLING_URL = `${WEB_BASE}/account/credits`;

export function planUrl(planId: string): string {
  return `${WEB_BASE}/app/plans/${planId}`;
}

// Assumption: plan §6 lists /app/projects/[id] but never says what [id] is —
// job_id is the only identifier /api/execute hands back, so that's what we
// link with. Confirm with Leverora whether projects get a separate id.
export function projectUrl(jobId: string): string {
  return `${WEB_BASE}/app/projects/${jobId}`;
}
