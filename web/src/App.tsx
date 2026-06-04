import { useCallback, useMemo, useState } from "react";
import { WalletGate } from "./components/WalletGate";
import { Sidebar, type View } from "./components/Sidebar";
import { InboxList } from "./components/InboxList";
import { SentList } from "./components/SentList";
import { Compose } from "./components/Compose";
import { Account } from "./components/Account";
import { Settings } from "./components/Settings";
import { NetworkGuard } from "./components/NetworkGuard";
import {
  ComposeContext,
  type ComposeApi,
  type ComposeDraft,
} from "./lib/composeDraft";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const [view, setView] = useState<View>("inbox");
  const [draft, setDraft] = useState<ComposeDraft | null>(null);

  const openCompose = useCallback((d: Partial<ComposeDraft>) => {
    setDraft({ to: "", cc: "", subject: "", body: "", ...d });
    setView("compose");
  }, []);
  const clearDraft = useCallback(() => setDraft(null), []);
  const composeApi = useMemo<ComposeApi>(
    () => ({ draft, openCompose, clearDraft }),
    [draft, openCompose, clearDraft],
  );

  return (
    <ComposeContext.Provider value={composeApi}>
      <WalletGate>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar view={view} onSelect={setView} />
          <div className="relative min-w-0 flex-1">
            <div
              className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
              style={{
                background:
                  "radial-gradient(ellipse 70% 70% at 50% 0%, transparent 30%, var(--background) 100%)",
              }}
              aria-hidden
            />
            <main className="relative mx-auto w-full max-w-4xl px-6 py-8">
              <NetworkGuard />

              <div className="pb-16">
                {view === "inbox" && <InboxList />}
                {view === "sent" && <SentList />}
                {view === "compose" && <Compose />}
                {view === "account" && <Account />}
                {view === "settings" && <Settings />}
              </div>
            </main>
          </div>
        </div>
        <Toaster />
      </WalletGate>
    </ComposeContext.Provider>
  );
}
