import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useAccount } from "wagmi";
import type { MailEvent } from "@heed/core";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { MailCard } from "./MailCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "../lib/format";
import { getEffectiveConfig } from "../lib/settings";
import { getFlags, setRead } from "../lib/db";

interface Props {
  query: UseQueryResult<MailEvent[]>;
  direction: "received" | "sent";
  limit: number;
  onLoadMore: () => void;
  emptyText: string;
}

export function MailList({
  query,
  direction,
  limit,
  onLoadMore,
  emptyText,
}: Props) {
  const { data, isLoading, isFetching, error, refetch } = query;
  const [filter, setFilter] = useState("");

  const { address } = useAccount();
  const cfg = getEffectiveConfig();
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
  const filtered = (data ?? []).filter(
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
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh"
        >
          <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{errorMessage(error)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {data && data.length > 0 ? "No matches." : emptyText}
        </div>
      ) : (
        <>
          {filtered.map((m) => (
            <MailCard
              key={m.txHash}
              mail={m}
              direction={direction}
              read={
                direction === "received" && flags
                  ? (flags[m.txHash] ?? false)
                  : undefined
              }
              onOpened={direction === "received" ? markRead : undefined}
            />
          ))}
          {data && data.length >= limit && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isFetching}
              >
                {isFetching ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
