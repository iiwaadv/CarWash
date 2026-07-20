export const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";

export async function apiFetch(path: string, token: string | null, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Bypass-Tunnel-Reminder": "true",
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiFetchJson(path: string, token: string | null, method: string, data: any) {
  return apiFetch(path, token, {
    method,
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}
