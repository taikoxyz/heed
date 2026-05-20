import { useOutbox } from "../hooks/useOutbox";
import { MailCard } from "./MailCard";
import { Skeleton } from "@/components/ui/skeleton";

export function SentList() {
  const { data, isLoading, error } = useOutbox();
  if (isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  if (error)
    return <div className="text-sm text-destructive">{String(error)}</div>;
  if (!data?.length)
    return (
      <div className="text-sm text-muted-foreground">No sent mail yet.</div>
    );
  return (
    <div className="space-y-3">
      {data.map((m) => (
        <MailCard key={m.txHash} mail={m} direction="sent" />
      ))}
    </div>
  );
}
