import { useCallback, useMemo, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  ActionIcon,
  AppShell,
  Burger,
  Code,
  Group,
  Tabs,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLogout } from "@tabler/icons-react";
import { WalletGate } from "./components/WalletGate";
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
import {
  ComposeContext,
  type ComposeApi,
  type ComposeDraft,
} from "./lib/composeDraft";

type View = "inbox" | "sent" | "compose" | "account" | "settings";

const TABS: { id: View; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "compose", label: "Compose" },
  { id: "account", label: "Account" },
  { id: "settings", label: "Settings" },
];

function Shell() {
  const [view, setView] = useState<View>("inbox");
  const [draft, setDraft] = useState<ComposeDraft | null>(null);
  const [mobileOpen, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure(false);
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
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 240,
          breakpoint: "sm",
          collapsed: { mobile: !mobileOpen },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" miw={0}>
              <Burger
                opened={mobileOpen}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
              />
              <HeedWordmark height={22} />
              {address && (
                <Code
                  fz="xs"
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {address}
                </Code>
              )}
            </Group>
            <Group gap="xs" wrap="nowrap">
              <NetworkSwitcher />
              <ThemeToggle />
              <Tooltip label="Disconnect">
                <ActionIcon
                  variant="default"
                  size="lg"
                  aria-label="Disconnect"
                  onClick={onDisconnect}
                >
                  <IconLogout size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm">
          <Tabs
            value={view}
            onChange={(v) => {
              if (v) {
                setView(v as View);
                closeMobile();
              }
            }}
            orientation="vertical"
            variant="pills"
            radius="md"
          >
            <Tabs.List w="100%" style={{ gap: 4 }}>
              {TABS.map((t) => (
                <Tabs.Tab
                  key={t.id}
                  value={t.id}
                  style={{ justifyContent: "flex-start" }}
                >
                  {t.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </AppShell.Navbar>

        <AppShell.Main>
          <NetworkGuard />
          {view === "inbox" && <InboxList />}
          {view === "sent" && <SentList />}
          {view === "compose" && <Compose />}
          {view === "account" && <Account />}
          {view === "settings" && <Settings />}
        </AppShell.Main>
      </AppShell>
    </ComposeContext.Provider>
  );
}

export default function App() {
  return (
    <WalletGate>
      <Shell />
    </WalletGate>
  );
}
