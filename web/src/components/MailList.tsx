import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useAccount } from "wagmi";
import type { MailEvent } from "@heed/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCard } from "./MailCard";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by address or ref…"
          aria-label="Filter mail"
          className="h-8"
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label="Refresh"
        >
          <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 py-6">
          <Progress value={(loadProgress ?? 0) * 100} />
          <div className="text-center text-xs text-muted-foreground">
            Loading… {Math.round((loadProgress ?? 0) * 100)}%
          </div>
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{errorMessage(error)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {mail.length > 0 ? "No matches." : emptyText}
        </div>
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
            <div className="flex justify-center pt-1">
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
        </>
      )}
    </div>
  );
}
