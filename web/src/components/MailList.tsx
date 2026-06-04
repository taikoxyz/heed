import { useState } from "react";
import { useAccount } from "wagmi";
import type { MailEvent } from "@heed/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Button,
  Center,
  Group,
  Progress,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { MailCard } from "./MailCard";
import { ErrorBoundary } from "./ErrorBoundary";
import { errorMessage } from "../lib/format";
import { getEffectiveConfig } from "../lib/settings";
import { getFlags, setRead } from "../lib/db";

interface Props {
  mail: MailEvent[];
  direction: "received" | "sent";
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRefresh: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  loadProgress?: number;
  emptyText: string;
}

export function MailList({
  mail,
  direction,
  isLoading,
  isFetching,
  error,
  onRefresh,
  hasMore,
  onLoadMore,
  isLoadingMore,
  loadProgress,
  emptyText,
}: Props) {
  const [filter, setFilter] = useState("");

  const { address, chainId } = useAccount();
  const cfg = getEffectiveConfig(chainId);
  const account = address?.toLowerCase();
  const qc = useQueryClient();
  const flagsKey = ["flags", cfg.chainId, account];
  const { data: flags } = useQuery({
    queryKey: flagsKey,
    queryFn: () => getFlags(cfg.chainId, account!),
    enabled: !!address && direction === "received",
    staleTime: Infinity,
  });

  function markRead(txHash: string) {
    if (!account) return;
    qc.setQueryData(flagsKey, (prev: Record<string, boolean> | undefined) => ({
      ...(prev ?? {}),
      [txHash]: true,
    }));
    void setRead(cfg.chainId, account, txHash, true).catch(() => {});
  }

  const counterpartyOf = (m: MailEvent) =>
    direction === "sent" ? m.recipient : m.sender;

  const f = filter.trim().toLowerCase();
  const filtered = mail.filter(
    (m) =>
      !f ||
      counterpartyOf(m).toLowerCase().includes(f) ||
      m.contentRef.toLowerCase().includes(f),
  );

  return (
    <Stack gap="md">
      <Group gap="xs" wrap="nowrap">
        <TextInput
          flex={1}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          placeholder="Filter by address or ref…"
          aria-label="Filter mail"
        />
        <ActionIcon
          variant="default"
          size="lg"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label="Refresh"
        >
          <IconRefresh
            size={18}
            style={isFetching ? { animation: "spin 1s linear infinite" } : {}}
          />
        </ActionIcon>
      </Group>

      {isLoading ? (
        <Stack gap="xs" py="md">
          <Progress value={(loadProgress ?? 0) * 100} />
          <Text c="dimmed" ta="center" size="xs">
            Loading {direction} mail… {Math.round((loadProgress ?? 0) * 100)}%
          </Text>
        </Stack>
      ) : error ? (
        <Text c="red" size="sm">
          {errorMessage(error)}
        </Text>
      ) : filtered.length === 0 ? (
        <Text c="dimmed" size="sm">
          {mail.length > 0 ? "No matches." : emptyText}
        </Text>
      ) : (
        <>
          {filtered.map((m) => (
            <ErrorBoundary key={m.txHash}>
              <MailCard
                mail={m}
                direction={direction}
                read={
                  direction === "received" && flags
                    ? (flags[m.txHash] ?? false)
                    : undefined
                }
                onOpened={direction === "received" ? markRead : undefined}
              />
            </ErrorBoundary>
          ))}
          {hasMore && (
            <Center pt="xs">
              <Button
                variant="default"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </Center>
          )}
        </>
      )}
    </Stack>
  );
}
