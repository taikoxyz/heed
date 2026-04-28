import { useInbox } from "../hooks/useInbox";
import { MailCard } from "./MailCard";

export function InboxList() {
  const { data, isLoading, error } = useInbox();
  if (isLoading) return <div className="p-4">Loading…</div>;
  if (error)
    return <div className="p-4 text-red-600">{String(error)}</div>;
  if (!data?.length)
    return <div className="p-4 text-gray-500">No mail yet.</div>;
  return (
    <ul className="divide-y">
      {data.map((m) => (
        <MailCard key={m.txHash} mail={m} />
      ))}
    </ul>
  );
}
