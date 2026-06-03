import { useOutbox } from "../hooks/useOutbox";
import { MailList } from "./MailList";

export function SentList() {
  const query = useOutbox();
  const mail = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <MailList
      mail={mail}
      direction="sent"
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      error={query.error}
      onRefresh={() => query.refetch()}
      hasMore={!!query.hasNextPage}
      onLoadMore={() => query.fetchNextPage()}
      isLoadingMore={query.isFetchingNextPage}
      loadProgress={query.progress}
      emptyText="No sent mail yet."
    />
  );
}
