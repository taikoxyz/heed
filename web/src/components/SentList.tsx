import { useOutbox } from "../hooks/useOutbox";
import { MailCard } from "./MailCard";

export function SentList() {
  const { data, isLoading, error } = useOutbox();
  if (isLoading) return <div className="p-4">Loading…</div>;
  if (error)
    return <div className="p-4 text-red-600">{String(error)}</div>;
  if (!data?.length)
    return <div className="p-4 text-gray-500">No sent mail yet.</div>;
  return (
    <ul className="divide-y">
      {data.map((m) => (
        <MailCard key={m.txHash} mail={m} direction="sent" />
      ))}
    </ul>
  );
}
