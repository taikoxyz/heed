// GraphQL-based IndexerMailSource for subgraph-indexed mail event queries
// FEATURE: Mail source abstraction layer for RPC and indexer backends

import type { Address, Hash, Hex } from "viem";
import type { MailSource, MailPage } from "./types";
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

const FIELDS =
  "txHash blockNumber blockTimestamp sender recipient contentRef valueGwei";

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
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: vars }),
    });
    if (!r.ok) throw new Error(`indexer ${r.status}`);
    const { data, errors } = await r.json();
    if (errors) throw new Error(JSON.stringify(errors));
    return data;
  }

  async function page(
    field: "recipient" | "sender",
    addr: Address,
    sinceBlock?: bigint,
    limit = 100,
    before?: bigint,
  ): Promise<MailPage> {
    const beforeClause = before === undefined ? "" : `, blockNumber_lt:$before`;
    const beforeDecl = before === undefined ? "" : `, $before: BigInt!`;
    const d = await gql<{ mails: RawMail[] }>(
      `query($a: String!, $since: BigInt!, $n: Int!${beforeDecl}) { mails(where:{${field}:$a, blockNumber_gte:$since${beforeClause}}, orderBy:blockNumber, orderDirection:desc, first:$n) { ${FIELDS} } }`,
      {
        a: addr.toLowerCase(),
        since: (sinceBlock ?? 0n).toString(),
        n: limit,
        ...(before === undefined ? {} : { before: before.toString() }),
      },
    );
    const items = d.mails.map(fromRaw);
    if (items.length < limit) return { items };
    // Full page: the subgraph may have split the oldest block across the page
    // boundary. Drop that block and re-include it next page (nextCursor is
    // exclusive via blockNumber_lt) so its remaining events aren't skipped.
    const oldestBlock = items[items.length - 1]!.blockNumber;
    let cut = items.length;
    while (cut > 0 && items[cut - 1]!.blockNumber === oldestBlock) cut--;
    if (cut === 0) return { items, nextCursor: oldestBlock };
    return { items: items.slice(0, cut), nextCursor: oldestBlock + 1n };
  }

  return {
    async listInbox(addr, since, limit) {
      return (await page("recipient", addr, since, limit)).items;
    },
    async listOutbox(addr, since, limit) {
      return (await page("sender", addr, since, limit)).items;
    },
    listInboxPage(addr, o = {}) {
      return page("recipient", addr, o.sinceBlock, o.limit, o.before);
    },
    listOutboxPage(addr, o = {}) {
      return page("sender", addr, o.sinceBlock, o.limit, o.before);
    },
    async getInbox(_addr): Promise<InboxView> {
      throw new Error(
        "getInbox via indexer: prefer RPC reader for fresh fee/keys",
      );
    },
    subscribe(_addr, _on) {
      throw new Error(
        "subscribe via indexer requires WS endpoint; impl as poll fallback",
      );
    },
  };
}
