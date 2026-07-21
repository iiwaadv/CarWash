import Dexie, { type Table } from "dexie";

export interface AuthCacheRecord {
  branchId: number;
  pinHash: string; // client-side hash, used only to unlock the cached session offline
  token: string;
  employee: { id: number; name: string; role: string; branchId: number };
  cachedAt: number;
}

export interface CachedJob {
  localId: string; // clientUuid, stable local primary key
  branchId: number;
  serverId?: number; // filled in once the create-job outbox item syncs
  data: any; // full job order shape mirrored from the API / optimistic local shape
  updatedAt: number;
}

export type OutboxKind =
  | "create-job"
  | "update-job"
  | "quality-post-wash"
  | "quality-touch-up"
  | "upsell-accept"
  | "upsell-reject"
  | "feedback"
  | "shift-opening"
  | "shift-inventory"
  | "cleanliness-complete"
  | "maintenance";

export interface OutboxItem {
  id?: number;
  kind: OutboxKind;
  // May contain the literal placeholder "__JOBREF__" in place of a job id
  // segment (e.g. "/api/job-orders/__JOBREF__") when the target job hasn't
  // synced yet. Resolved against `jobRefUuid` right before sending.
  url: string;
  method: "POST" | "PATCH";
  // Plain JSON fields. A value of the shape { __jobRef: clientUuid } is resolved
  // to the real numeric job id once the referenced create-job item has synced.
  fields: Record<string, any>;
  // File fields keyed by form field name -> array of Blobs (multi-photo support).
  fileFields?: Record<string, { blob: Blob; filename: string }[]>;
  clientUuid?: string; // set on create-job items so dependents can reference them
  jobRefUuid?: string; // set when `url` contains the "__JOBREF__" placeholder
  createdAt: number;
  attempts: number;
  lastError?: string;
}

class CoeOfflineDb extends Dexie {
  authCache!: Table<AuthCacheRecord, number>;
  cachedJobs!: Table<CachedJob, string>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super("coe_offline");
    this.version(1).stores({
      authCache: "branchId",
      cachedJobs: "localId, branchId, serverId",
      outbox: "++id, kind, createdAt, clientUuid",
    });
  }
}

export const db = new CoeOfflineDb();

export async function clientHashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`coe-client:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newClientUuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
