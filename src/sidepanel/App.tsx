import { useEffect } from "react";
import { initPanelStore, usePanelStore } from "./store";
import { SignedOut } from "./screens/SignedOut";
import { NoThread } from "./screens/NoThread";
import { CategoryPicker } from "./screens/CategoryPicker";
import { NoCredits } from "./screens/NoCredits";
import { MainThread } from "./screens/MainThread";

export function App() {
  useEffect(() => {
    initPanelStore();
  }, []);

  const loading = usePanelStore((s) => s.loading);
  const authenticated = usePanelStore((s) => s.authenticated);
  const thread = usePanelStore((s) => s.thread);
  const creditBalance = usePanelStore((s) => s.creditBalance);
  const suggestEstimate = usePanelStore((s) => s.estimates.suggest);

  if (loading) return null;
  if (!authenticated) return <SignedOut />;
  if (!thread) return <NoThread />;
  if (!thread.categorySlug) return <CategoryPicker />;
  if (creditBalance !== null && suggestEstimate !== undefined && creditBalance < suggestEstimate) return <NoCredits />;
  return <MainThread />;
}
