import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// Mirrors the isDev check in src/shared/config.ts: `npm run build:dev` runs
// Vite with mode "development", the real `npm run build` with "production".
// http://localhost:3000/* must only ship in the dev build — a published,
// production build carrying it would let any page or local process on
// localhost:3000 on an end user's machine message the extension via
// externally_connectable as if it were a legitimate Leverora origin.
export default defineManifest(({ mode }) => {
  const isDev = mode !== "production";

  return {
    manifest_version: 3,
    name: "Leverora for Upwork",
    version: pkg.version,
    minimum_chrome_version: "114",
    permissions: ["sidePanel", "storage", "activeTab", "scripting"],
    host_permissions: [
      "https://www.upwork.com/*",
      "https://api.leverora.com/*",
      ...(isDev ? ["http://localhost:3000/*"] : [])
    ],
    background: {
      service_worker: "src/background/index.ts",
      type: "module"
    },
    side_panel: {
      default_path: "src/sidepanel/index.html"
    },
    content_scripts: [
      {
        matches: ["https://www.upwork.com/*"],
        js: ["src/content/index.ts"],
        run_at: "document_idle"
      }
    ],
    externally_connectable: {
      // leverora.com (bare) 308-redirects to www.leverora.com — the page
      // that actually calls chrome.runtime.sendMessage ends up served from
      // www, so both must be listed or the bare-domain entry never matches
      // anything in practice.
      matches: ["https://leverora.com/*", "https://www.leverora.com/*", ...(isDev ? ["http://localhost:3000/*"] : [])]
    },
    action: {
      default_title: "Leverora"
    }
  };
});
