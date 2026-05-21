import { useInbox } from "../hooks/useInbox";
import { MailList } from "./MailList";

export function InboxList() {
  const query = useInbox();
  const mail = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <MailList
      mail={mail}
      direction="received"
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      error={query.error}
      onRefresh={() => query.refetch()}
      hasMore={!!query.hasNextPage}
      onLoadMore={() => query.fetchNextPage()}
      isLoadingMore={query.isFetchingNextPage}
      emptyText="No mail yet."
    />
  );
}
