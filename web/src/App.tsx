import { useCallback, useMemo, useState } from "react";
import { WalletGate } from "./components/WalletGate";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type View = "inbox" | "sent" | "compose" | "account" | "settings";

const TABS: { id: View; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "compose", label: "Compose" },
  { id: "account", label: "Account" },
  { id: "settings", label: "Settings" },
];

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
        <div className="relative">
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
          <main className="relative mx-auto w-full max-w-4xl px-6">
            <Tabs
              value={view}
              onValueChange={(v) => setView(v as View)}
              className="pt-8 pb-6"
            >
              <TabsList variant="line">
                {TABS.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

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
        <Toaster />
      </WalletGate>
    </ComposeContext.Provider>
  );
}
