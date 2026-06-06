import { useCallback, useMemo, useState, type ComponentType } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  InboxIcon,
  KeyRoundIcon,
  PenLineIcon,
  SendIcon,
  SettingsIcon,
  LogOutIcon,
  BookOpenIcon,
} from "lucide-react";
import { WalletGate } from "./components/WalletGate";
import { DocsPage } from "./components/DocsPage";
import { InboxList } from "./components/InboxList";
import { SentList } from "./components/SentList";
import { Compose } from "./components/Compose";
import { Account } from "./components/Account";
import { Settings } from "./components/Settings";
import { NetworkGuard } from "./components/NetworkGuard";
import { NetworkSwitcher } from "./components/NetworkSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";
import { HeedWordmark } from "./components/HeedWordmark";
import { clearKeys } from "./lib/keys";
import { cn } from "./lib/utils";
import {
  ComposeContext,
  type ComposeApi,
  type ComposeDraft,
} from "./lib/composeDraft";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

type View = "inbox" | "sent" | "compose" | "account" | "settings";

const NAV: {
  id: View;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: SendIcon },
  { id: "compose", label: "Compose", icon: PenLineIcon },
  { id: "account", label: "Account", icon: KeyRoundIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function Shell() {
  const [view, setView] = useState<View>("inbox");
  const [draft, setDraft] = useState<ComposeDraft | null>(null);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  const openCompose = useCallback((d: Partial<ComposeDraft>) => {
    setDraft({ to: "", cc: "", subject: "", body: "", ...d });
    setView("compose");
  }, []);
  const clearDraft = useCallback(() => setDraft(null), []);
  const composeApi = useMemo<ComposeApi>(
    () => ({ draft, openCompose, clearDraft }),
    [draft, openCompose, clearDraft],
  );

  function onDisconnect() {
    clearKeys();
    disconnect();
  }

  return (
    <ComposeContext.Provider value={composeApi}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <HeedWordmark className="h-6 w-auto shrink-0 text-foreground" />
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <span className="hidden truncate font-mono text-xs tracking-tight text-muted-foreground sm:block">
              {address}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <a href="/docs">
                <BookOpenIcon className="size-4" />
                <span className="hidden sm:inline">Docs</span>
              </a>
            </Button>
            <NetworkSwitcher />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="gap-1.5"
            >
              <LogOutIcon className="size-4" />
              <span className="hidden sm:inline">Disconnect</span>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col md:flex-row">
          <aside className="flex shrink-0 flex-col border-b border-border md:sticky md:top-[60px] md:h-[calc(100vh-60px)] md:w-60 md:border-b-0 md:border-r">
            <nav
              role="tablist"
              aria-label="Primary"
              aria-orientation="vertical"
              className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3"
            >
              {NAV.map((item) => {
                const active = view === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(item.id)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-1.5 left-0 hidden w-[3px] rounded-full bg-signal md:block"
                        aria-hidden
                      />
                    )}
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto hidden p-4 md:block">
              <span className="eyebrow text-[0.6rem]">
                <span className="dot" />
                Signal up
              </span>
            </div>
          </aside>

          <main className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8">
            <NetworkGuard />
            <div className="mx-auto w-full max-w-3xl">
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
    </ComposeContext.Provider>
  );
}

export default function App() {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/docs")
  ) {
    return <DocsPage />;
  }
  return (
    <WalletGate>
      <Shell />
    </WalletGate>
  );
}
