import { useOutbox } from "../hooks/useOutbox";
import { MailCard } from "./MailCard";
import { ErrorBoundary } from "./ErrorBoundary";

export function SentList() {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useOutbox();
  if (isLoading) return <div className="p-4">Loading…</div>;
  if (error)
    return <div className="p-4 text-red-600">{String(error)}</div>;
  const mail = data?.pages.flatMap((p) => p.items) ?? [];
  if (!mail.length)
    return <div className="p-4 text-gray-500">No sent mail yet.</div>;
  return (
    <div>
      <ul className="divide-y">
        {mail.map((m) => (
          <ErrorBoundary key={m.txHash}>
            <MailCard mail={m} direction="sent" />
          </ErrorBoundary>
        ))}
      </ul>
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full p-4 text-sm underline disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
