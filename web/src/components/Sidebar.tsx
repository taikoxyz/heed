import { useAccount, useDisconnect } from "wagmi";
import { clearKeys } from "../lib/keys";
import { HeedWordmark } from "./HeedWordmark";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type View = "inbox" | "sent" | "compose" | "account" | "settings";

const NAV: { id: View; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "compose", label: "Compose" },
  { id: "account", label: "Account" },
  { id: "settings", label: "Settings" },
];

export function Sidebar({
  view,
  onSelect,
}: {
  view: View;
  onSelect: (v: View) => void;
}) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  function onDisconnect() {
    clearKeys();
    disconnect();
  }

  return (
    <aside className="flex shrink-0 flex-col border-b border-border bg-background md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="p-6">
        <span className="eyebrow mb-5">
          <span className="dot" />
          Encrypted · onchain
        </span>
        <HeedWordmark className="h-7 w-auto text-foreground" />
      </div>

      <Tabs
        value={view}
        onValueChange={(v) => onSelect(v as View)}
        orientation="vertical"
        className="px-3"
      >
        <TabsList variant="line" className="w-full gap-1">
          {NAV.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="justify-start px-3 py-2.5 text-xs hover:bg-foreground/[0.03] data-active:bg-foreground/[0.05]"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-auto space-y-3 border-t border-border p-4">
        <div className="font-mono text-[0.7rem] leading-relaxed tracking-[0.06em] break-all text-muted-foreground uppercase">
          {address}
        </div>
        <div className="flex items-center gap-2">
          <NetworkSwitcher />
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      </div>
    </aside>
  );
}
