// GraphQL-based IndexerMailSource for subgraph-indexed mail event queries
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import type { Address } from "viem";
import type { MailSource } from "./types";
import type { MailEvent, InboxView } from "../types";

export function createIndexerMailSource(endpoint: string): MailSource {
  async function gql<T>(query: string, vars: object): Promise<T> {
    const r = await fetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: vars }),
    });
    const { data, errors } = await r.json();
    if (errors) throw new Error(JSON.stringify(errors));
    return data;
  }

  return {
    async listInbox(addr, _since, limit) {
      const d = await gql<{ mails: MailEvent[] }>(
        `query($r: String!, $n: Int!) { mails(where:{recipient:$r}, orderBy:blockNumber, orderDirection:desc, first:$n) { txHash blockNumber blockTimestamp sender recipient contentRef valueGwei } }`,
        { r: (addr as string).toLowerCase(), n: limit ?? 100 }
      );
      return d.mails;
    },
    async listOutbox(addr, _since, limit) {
      const d = await gql<{ mails: MailEvent[] }>(
        `query($s: String!, $n: Int!) { mails(where:{sender:$s}, orderBy:blockNumber, orderDirection:desc, first:$n) { txHash blockNumber blockTimestamp sender recipient contentRef valueGwei } }`,
        { s: (addr as string).toLowerCase(), n: limit ?? 100 }
      );
      return d.mails;
    },
    async getInbox(_addr): Promise<InboxView> {
      throw new Error("getInbox via indexer: prefer RPC reader for fresh fee/keys");
    },
    subscribe(_addr, _on) { throw new Error("subscribe via indexer requires WS endpoint; impl as poll fallback"); },
  };
}
