import { useState } from "react";
import { WalletGate } from "./components/WalletGate";
import { InboxList } from "./components/InboxList";
import { SentList } from "./components/SentList";
import { Compose } from "./components/Compose";
import { Settings } from "./components/Settings";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type View = "inbox" | "sent" | "compose" | "settings";

const TABS: { id: View; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "compose", label: "Compose" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [view, setView] = useState<View>("inbox");

  return (
    <WalletGate>
      <main className="mx-auto w-full max-w-3xl px-4">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as View)}
          className="py-3"
        >
          <TabsList variant="line">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="pb-10">
          {view === "inbox" && <InboxList />}
          {view === "sent" && <SentList />}
          {view === "compose" && <Compose />}
          {view === "settings" && <Settings />}
        </div>
      </main>
      <Toaster />
    </WalletGate>
  );
}
