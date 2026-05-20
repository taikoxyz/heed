import { useInbox } from "../hooks/useInbox";
import { MailCard } from "./MailCard";
import { Skeleton } from "@/components/ui/skeleton";

export function InboxList() {
  const { data, isLoading, error } = useInbox();
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
    return <div className="text-sm text-muted-foreground">No mail yet.</div>;
  return (
    <div className="space-y-3">
      {data.map((m) => (
        <MailCard key={m.txHash} mail={m} />
      ))}
    </div>
  );
}
