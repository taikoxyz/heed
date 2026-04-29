import { useState } from "react";
import { WalletGate } from "./components/WalletGate";
import { InboxList } from "./components/InboxList";
import { SentList } from "./components/SentList";
import { Compose } from "./components/Compose";
import { Settings } from "./components/Settings";

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
      <nav className="flex gap-4 px-4 py-2 border-b text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={view === t.id ? "font-semibold" : "text-gray-500"}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {view === "inbox" && <InboxList />}
      {view === "sent" && <SentList />}
      {view === "compose" && <Compose />}
      {view === "settings" && <Settings />}
    </WalletGate>
  );
}
