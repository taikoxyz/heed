import { useState } from "react";
import { useInbox } from "../hooks/useInbox";
import { MailList } from "./MailList";

export function InboxList() {
  const [limit, setLimit] = useState(50);
  const query = useInbox(limit);
  return (
    <MailList
      query={query}
      direction="received"
      limit={limit}
      onLoadMore={() => setLimit((l) => l + 50)}
      emptyText="No mail yet."
    />
  );
}
