import type { Address, Hash, Hex } from "viem";
import type { DecodedPayload, MailEvent } from "@heed/core";
import type { ComposeDraft } from "./composeDraft";
import {
  EMPTY_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings";

// Local persistence for the mail client. A single IndexedDB database is the
// canonical cache so the inbox renders instantly and already-read mail
// re-opens without re-fetching from IPFS or re-signing with the wallet.
//
// Bump DB_VERSION on any store/index change; onUpgrade must stay additive.
export const DB_NAME = "heed";
export const DB_VERSION = 1;

const MESSAGES = "messages";
const DECODED = "decoded";
const FLAGS = "flags";
const DRAFTS = "drafts";

export type Direction = "received" | "sent";

// MailEvent carries bigints (blockNumber, blockTimestamp); store them as
// decimal strings so records are plain JSON (also lets export be a raw dump).
export interface MailEventJson {
  txHash: string;
  blockNumber: string;
  blockTimestamp: string;
  sender: string;
  recipient: string;
  contentRef: string;
  valueGwei: number;
}

interface MessageRecord {
  id: string;
  scope: string;
  chainId: number;
  account: string;
  direction: Direction;
  event: MailEventJson;
}

interface DecodedRecord {
  contentRef: string;
  payload: Exclude<DecodedPayload, { kind: "unknown" }>;
  decodedAt: number;
}

interface FlagRecord {
  id: string;
  chainId: number;
  account: string;
  txHash: string;
  read: boolean;
  readAt?: number;
}

interface DraftRecord {
  id: string;
  chainId: number;
  account: string;
  draft: ComposeDraft;
  savedAt: number;
}

export function encodeMailEvent(e: MailEvent): MailEventJson {
  return {
    txHash: e.txHash,
    blockNumber: e.blockNumber.toString(),
    blockTimestamp: e.blockTimestamp.toString(),
    sender: e.sender,
    recipient: e.recipient,
    contentRef: e.contentRef,
    valueGwei: e.valueGwei,
  };
}

export function decodeMailEvent(j: MailEventJson): MailEvent {
  return {
    txHash: j.txHash as Hash,
    blockNumber: BigInt(j.blockNumber),
    blockTimestamp: BigInt(j.blockTimestamp),
    sender: j.sender as Address,
    recipient: j.recipient as Address,
    contentRef: j.contentRef as Hex,
    valueGwei: j.valueGwei,
  };
}

const acct = (a: string) => a.toLowerCase();
const scopeKey = (chainId: number, account: string, direction: Direction) =>
  `${chainId}:${acct(account)}:${direction}`;
const msgId = (
  chainId: number,
  account: string,
  direction: Direction,
  txHash: string,
) => `${scopeKey(chainId, account, direction)}:${txHash}`;
const flagId = (chainId: number, account: string, txHash: string) =>
  `${chainId}:${acct(account)}:${txHash}`;
const draftId = (chainId: number, account: string) =>
  `${chainId}:${acct(account)}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(MESSAGES)) {
    const s = db.createObjectStore(MESSAGES, { keyPath: "id" });
    s.createIndex("byScope", "scope", { unique: false });
  }
  if (!db.objectStoreNames.contains(DECODED)) {
    db.createObjectStore(DECODED, { keyPath: "contentRef" });
  }
  if (!db.objectStoreNames.contains(FLAGS)) {
    db.createObjectStore(FLAGS, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(DRAFTS)) {
    db.createObjectStore(DRAFTS, { keyPath: "id" });
  }
}

function reqDone<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return reqDone<T[]>(
    db.transaction(store, "readonly").objectStore(store).getAll(),
  );
}

// --- messages -------------------------------------------------------------

export async function getMessages(
  chainId: number,
  account: string,
  direction: Direction,
): Promise<MailEvent[]> {
  const db = await openDb();
  const idx = db
    .transaction(MESSAGES, "readonly")
    .objectStore(MESSAGES)
    .index("byScope");
  const records = await reqDone<MessageRecord[]>(
    idx.getAll(IDBKeyRange.only(scopeKey(chainId, account, direction))),
  );
  return records
    .map((r) => decodeMailEvent(r.event))
    .sort((a, b) => Number(b.blockNumber - a.blockNumber));
}

export async function putMessages(
  chainId: number,
  account: string,
  direction: Direction,
  events: MailEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(MESSAGES, "readwrite");
  const store = tx.objectStore(MESSAGES);
  for (const e of events) {
    store.put({
      id: msgId(chainId, account, direction, e.txHash),
      scope: scopeKey(chainId, account, direction),
      chainId,
      account: acct(account),
      direction,
      event: encodeMailEvent(e),
    } satisfies MessageRecord);
  }
  await txDone(tx);
}

// --- decoded content ------------------------------------------------------

export async function getDecoded(
  contentRef: string,
): Promise<DecodedPayload | undefined> {
  const db = await openDb();
  const rec = await reqDone<DecodedRecord | undefined>(
    db.transaction(DECODED, "readonly").objectStore(DECODED).get(contentRef),
  );
  return rec?.payload;
}

export async function putDecoded(
  contentRef: string,
  payload: DecodedPayload,
): Promise<void> {
  if (payload.kind === "unknown") return;
  const db = await openDb();
  const tx = db.transaction(DECODED, "readwrite");
  tx.objectStore(DECODED).put({
    contentRef,
    payload,
    decodedAt: Date.now(),
  } satisfies DecodedRecord);
  await txDone(tx);
}

// --- read/unread flags ----------------------------------------------------

export async function getFlags(
  chainId: number,
  account: string,
): Promise<Record<string, boolean>> {
  const all = await getAll<FlagRecord>(FLAGS);
  const a = acct(account);
  const out: Record<string, boolean> = {};
  for (const r of all) {
    if (r.chainId === chainId && r.account === a) out[r.txHash] = r.read;
  }
  return out;
}

export async function setRead(
  chainId: number,
  account: string,
  txHash: string,
  read: boolean,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FLAGS, "readwrite");
  tx.objectStore(FLAGS).put({
    id: flagId(chainId, account, txHash),
    chainId,
    account: acct(account),
    txHash,
    read,
    readAt: read ? Date.now() : undefined,
  } satisfies FlagRecord);
  await txDone(tx);
}

// --- drafts ---------------------------------------------------------------

export async function getDraft(
  chainId: number,
  account: string,
): Promise<ComposeDraft | null> {
  const db = await openDb();
  const rec = await reqDone<DraftRecord | undefined>(
    db
      .transaction(DRAFTS, "readonly")
      .objectStore(DRAFTS)
      .get(draftId(chainId, account)),
  );
  return rec?.draft ?? null;
}

export async function saveDraft(
  chainId: number,
  account: string,
  draft: ComposeDraft,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(DRAFTS, "readwrite");
  tx.objectStore(DRAFTS).put({
    id: draftId(chainId, account),
    chainId,
    account: acct(account),
    draft,
    savedAt: Date.now(),
  } satisfies DraftRecord);
  await txDone(tx);
}

export async function clearDraft(
  chainId: number,
  account: string,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(DRAFTS, "readwrite");
  tx.objectStore(DRAFTS).delete(draftId(chainId, account));
  await txDone(tx);
}

// --- export / import ------------------------------------------------------

export interface HeedExport {
  app: "heed";
  schemaVersion: number;
  enc: false;
  exportedAt: string;
  settings: Settings;
  stores: {
    messages: MessageRecord[];
    decoded: DecodedRecord[];
    flags: FlagRecord[];
    drafts: DraftRecord[];
  };
}

export function serializeExport(
  stores: HeedExport["stores"],
  settings: Settings,
): HeedExport {
  return {
    app: "heed",
    schemaVersion: DB_VERSION,
    enc: false,
    exportedAt: new Date().toISOString(),
    settings,
    stores,
  };
}

export function parseImport(json: string): HeedExport {
  const data = JSON.parse(json) as Partial<HeedExport>;
  if (!data || data.app !== "heed") {
    throw new Error("Not a Heed backup file.");
  }
  if (
    typeof data.schemaVersion !== "number" ||
    data.schemaVersion > DB_VERSION
  ) {
    throw new Error(
      `Unsupported backup version ${String(data.schemaVersion)} (this app supports up to ${DB_VERSION}).`,
    );
  }
  const stores = data.stores ?? {
    messages: [],
    decoded: [],
    flags: [],
    drafts: [],
  };
  return {
    app: "heed",
    schemaVersion: data.schemaVersion,
    enc: false,
    exportedAt: data.exportedAt ?? "",
    settings: data.settings ?? EMPTY_SETTINGS,
    stores: {
      messages: stores.messages ?? [],
      decoded: stores.decoded ?? [],
      flags: stores.flags ?? [],
      drafts: stores.drafts ?? [],
    },
  };
}

export async function exportAll(): Promise<HeedExport> {
  const [messages, decoded, flags, drafts] = await Promise.all([
    getAll<MessageRecord>(MESSAGES),
    getAll<DecodedRecord>(DECODED),
    getAll<FlagRecord>(FLAGS),
    getAll<DraftRecord>(DRAFTS),
  ]);
  return serializeExport({ messages, decoded, flags, drafts }, loadSettings());
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([MESSAGES, DECODED, FLAGS, DRAFTS], "readwrite");
  tx.objectStore(MESSAGES).clear();
  tx.objectStore(DECODED).clear();
  tx.objectStore(FLAGS).clear();
  tx.objectStore(DRAFTS).clear();
  await txDone(tx);
}

export async function importAll(
  data: HeedExport,
  mode: "merge" | "replace",
): Promise<void> {
  if (mode === "replace") await clearAll();
  const db = await openDb();
  const tx = db.transaction([MESSAGES, DECODED, FLAGS, DRAFTS], "readwrite");
  for (const r of data.stores.messages) tx.objectStore(MESSAGES).put(r);
  for (const r of data.stores.decoded) tx.objectStore(DECODED).put(r);
  for (const r of data.stores.flags) tx.objectStore(FLAGS).put(r);
  for (const r of data.stores.drafts) tx.objectStore(DRAFTS).put(r);
  await txDone(tx);
  saveSettings(data.settings);
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
