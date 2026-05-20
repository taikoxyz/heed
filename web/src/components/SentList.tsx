import { useState } from "react";
import { useOutbox } from "../hooks/useOutbox";
import { MailList } from "./MailList";

export function SentList() {
  const [limit, setLimit] = useState(50);
  const query = useOutbox(limit);
  return (
    <MailList
      query={query}
      direction="sent"
      limit={limit}
      onLoadMore={() => setLimit((l) => l + 50)}
      emptyText="No sent mail yet."
    />
  );
}
