// GraphQL-based IndexerMailSource for subgraph-indexed mail event queries
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import type { Address, Hash, Hex } from "viem";
import type { MailSource } from "./types";
import type { MailEvent, InboxView } from "../types";

interface RawMail {
  txHash: string;
  blockNumber: string;
  blockTimestamp: string;
  sender: string;
  recipient: string;
  contentRef: string;
  valueGwei: string;
}

const FIELDS = "txHash blockNumber blockTimestamp sender recipient contentRef valueGwei";

function fromRaw(r: RawMail): MailEvent {
  return {
    txHash: r.txHash as Hash,
    blockNumber: BigInt(r.blockNumber),
    blockTimestamp: BigInt(r.blockTimestamp),
    sender: r.sender as Address,
    recipient: r.recipient as Address,
    contentRef: r.contentRef as Hex,
    valueGwei: Number(r.valueGwei),
  };
}

export function createIndexerMailSource(endpoint: string): MailSource {
  async function gql<T>(query: string, vars: object): Promise<T> {
    const r = await fetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: vars }),
    });
    if (!r.ok) throw new Error(`indexer ${r.status}`);
    const { data, errors } = await r.json();
    if (errors) throw new Error(JSON.stringify(errors));
    return data;
  }

  return {
    async listInbox(addr, since, limit) {
      const d = await gql<{ mails: RawMail[] }>(
        `query($r: String!, $since: BigInt!, $n: Int!) { mails(where:{recipient:$r, blockNumber_gte:$since}, orderBy:blockNumber, orderDirection:desc, first:$n) { ${FIELDS} } }`,
        { r: addr.toLowerCase(), since: (since ?? 0n).toString(), n: limit ?? 100 }
      );
      return d.mails.map(fromRaw);
    },
    async listOutbox(addr, since, limit) {
      const d = await gql<{ mails: RawMail[] }>(
        `query($s: String!, $since: BigInt!, $n: Int!) { mails(where:{sender:$s, blockNumber_gte:$since}, orderBy:blockNumber, orderDirection:desc, first:$n) { ${FIELDS} } }`,
        { s: addr.toLowerCase(), since: (since ?? 0n).toString(), n: limit ?? 100 }
      );
      return d.mails.map(fromRaw);
    },
    async getInbox(_addr): Promise<InboxView> {
      throw new Error("getInbox via indexer: prefer RPC reader for fresh fee/keys");
    },
    subscribe(_addr, _on) { throw new Error("subscribe via indexer requires WS endpoint; impl as poll fallback"); },
  };
}
