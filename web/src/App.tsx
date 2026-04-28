import { useState } from "react";
import { WalletGate } from "./components/WalletGate";
import { InboxList } from "./components/InboxList";
import { Settings } from "./components/Settings";

type View = "inbox" | "settings";

export default function App() {
  const [view, setView] = useState<View>("inbox");

  return (
    <WalletGate>
      <nav className="flex gap-4 px-4 py-2 border-b text-sm">
        <button
          onClick={() => setView("inbox")}
          className={view === "inbox" ? "font-semibold" : "text-gray-500"}
        >
          Inbox
        </button>
        <button
          onClick={() => setView("settings")}
          className={view === "settings" ? "font-semibold" : "text-gray-500"}
        >
          Settings
        </button>
      </nav>
      {view === "inbox" ? <InboxList /> : <Settings />}
    </WalletGate>
  );
}
