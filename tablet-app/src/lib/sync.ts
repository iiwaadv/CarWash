import { API_BASE } from "./api";
import { db, type OutboxItem } from "./db";

type Listener = (state: SyncState) => void;

export interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
}

const state: SyncState = {
  isOnline: navigator.onLine,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false,
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(state));
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

// clientUuid -> resolved server job id, kept in memory + rebuilt from cachedJobs on boot.
const resolvedJobIds = new Map<string, number>();

function resolveRefs(fields: Record<string, any>): { fields: Record<string, any>; blocked: boolean } {
  let blocked = false;
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value && typeof value === "object" && "__jobRef" in value) {
      const id = resolvedJobIds.get(value.__jobRef);
      if (id === undefined) {
        blocked = true;
        resolved[key] = value;
      } else {
        resolved[key] = id;
      }
    } else {
      resolved[key] = value;
    }
  }
  return { fields: resolved, blocked };
}

async function sendItem(item: OutboxItem, token: string): Promise<any> {
  const { fields, blocked } = resolveRefs(item.fields);
  if (blocked) throw new Error("__blocked_on_dependency__");

  let url = item.url;
  if (url.includes("__JOBREF__")) {
    if (!item.jobRefUuid) throw new Error("Missing jobRefUuid for templated URL");
    const resolvedId = resolvedJobIds.get(item.jobRefUuid);
    if (resolvedId === undefined) throw new Error("__blocked_on_dependency__");
    url = url.replace("__JOBREF__", String(resolvedId));
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  for (const [field, files] of Object.entries(item.fileFields ?? {})) {
    for (const f of files) form.append(field, f.blob, f.filename);
  }

  const hasFiles = Boolean(item.fileFields && Object.keys(item.fileFields).length > 0);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (!hasFiles) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${url}`, {
    method: item.method,
    headers,
    body: hasFiles ? form : JSON.stringify(fields),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

let flushing = false;

export async function flushOutbox(token: string | null) {
  if (!token || flushing || !navigator.onLine) return;
  flushing = true;
  state.syncing = true;
  emit();

  try {
    const items = await db.outbox.orderBy("createdAt").toArray();
    state.pendingCount = items.length;
    emit();

    for (const item of items) {
      try {
        const result = await sendItem(item, token);
        if (item.kind === "create-job" && item.clientUuid) {
          const serverId = result?.id ?? result?.job?.id;
          if (serverId) {
            resolvedJobIds.set(item.clientUuid, serverId);
            const cached = await db.cachedJobs.get(item.clientUuid);
            if (cached) {
              await db.cachedJobs.put({ ...cached, serverId, data: { ...cached.data, ...result } });
            }
          }
        }
        await db.outbox.delete(item.id!);
        state.lastError = null;
      } catch (err: any) {
        if (err?.message === "__blocked_on_dependency__") continue; // retry later, in order
        await db.outbox.update(item.id!, {
          attempts: item.attempts + 1,
          lastError: String(err?.message ?? err),
        });
        state.lastError = String(err?.message ?? err);
      }
    }

    state.pendingCount = await db.outbox.count();
    state.lastSyncAt = Date.now();
  } finally {
    flushing = false;
    state.syncing = false;
    emit();
  }
}

async function rehydrateResolvedJobIds() {
  const jobs = await db.cachedJobs.toArray();
  for (const j of jobs) {
    if (j.serverId) resolvedJobIds.set(j.localId, j.serverId);
  }
}

export function initSyncEngine(getToken: () => string | null) {
  void rehydrateResolvedJobIds();

  const onOnline = () => {
    state.isOnline = true;
    emit();
    flushOutbox(getToken());
  };
  const onOffline = () => {
    state.isOnline = false;
    emit();
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  const interval = setInterval(() => {
    db.outbox.count().then((c) => {
      state.pendingCount = c;
      emit();
    });
    if (navigator.onLine) flushOutbox(getToken());
  }, 10_000);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    clearInterval(interval);
  };
}

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt" | "attempts">) {
  await db.outbox.add({ ...item, createdAt: Date.now(), attempts: 0 });
  state.pendingCount = await db.outbox.count();
  emit();
}

// Shared helper for any PATCH /api/job-orders/:id call, transparently handling
// jobs that are numeric (already synced) vs. still-pending clientUuids.
export async function queueJobPatch(jobId: number | string, fields: Record<string, any>, token: string | null) {
  await enqueue({
    kind: "update-job",
    url: typeof jobId === "number" ? `/api/job-orders/${jobId}` : "/api/job-orders/__JOBREF__",
    method: "PATCH",
    fields,
    jobRefUuid: typeof jobId === "number" ? undefined : jobId,
  });
  if (navigator.onLine) void flushOutbox(token);
}
