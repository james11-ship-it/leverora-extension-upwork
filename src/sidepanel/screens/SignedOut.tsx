import { usePanelStore } from "../store";

export function SignedOut() {
  const login = usePanelStore((s) => s.login);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Leverora
      </div>
      <p style={{ color: "var(--text-muted)" }}>Sign in to see suggestions and plans for your conversations.</p>
      <button
        onClick={login}
        className="rounded-lg px-4 py-2 font-medium text-white"
        style={{ background: "var(--accent)", borderRadius: "var(--radius-btn)" }}
      >
        Sign in with Leverora
      </button>
    </div>
  );
}
