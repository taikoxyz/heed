import { useState } from "react";
import { InboxIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { useAccount } from "wagmi";
import type { MailEvent } from "@heed/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCard } from "./MailCard";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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

  const title = direction === "sent" ? "Sent" : "Inbox";
  const unread =
    direction === "received" && flags
      ? mail.filter((m) => flags[m.txHash] === false || !(m.txHash in flags))
          .length
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">
            <span className="dot" />
            {direction === "sent" ? "Outbound" : "Encrypted"}
          </span>
          <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight">
            {title}
            {unread > 0 && (
              <span className="ml-2 align-middle font-mono text-sm font-normal text-signal">
                {unread} new
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              aria-label="Filter mail"
              className="h-9 w-44 pl-8 font-mono text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            className="size-9"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label="Refresh"
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Progress value={(loadProgress ?? 0) * 100} />
            <div className="text-center font-mono text-xs text-muted-foreground">
              Loading {direction} mail… {Math.round((loadProgress ?? 0) * 100)}%
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage(error)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <InboxIcon className="size-7 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {mail.length > 0 ? "No matches." : emptyText}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
