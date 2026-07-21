import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, API_BASE } from "../lib/api";
import { enqueue } from "../lib/sync";
import PhotoCaptureGrid from "./PhotoCaptureGrid";

interface CleanlinessStatus {
  id: number;
  branchId: number;
  dueAt: string;
  isOverdue: boolean;
  isLocked: boolean;
}

const CACHE_KEY = "coe_cleanliness_status";

export default function CleanlinessGate() {
  const { token, employee } = useAuth();
  const { t } = useTranslation();
  const [status, setStatus] = useState<CleanlinessStatus | null>(
    JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null")
  );
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridKey, setGridKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  async function refresh() {
    if (!token) return;
    try {
      const data = await apiFetch("/api/cleanliness/status", token);
      setStatus(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // offline: keep cached status
    }
  }

  useEffect(() => {
    if (!employee) return;
    refresh();
    timerRef.current = setInterval(refresh, 30_000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  if (!employee || employee.role === "manager" || !status) return null;

  // اعتمد إشارة السيرفر أولاً؛ الحساب المحلي احتياطي للكاش القديم
  const localOverdueLock = new Date(status.dueAt).getTime() < Date.now() - 15 * 60 * 1000;
  const isLocked = status.isLocked === true || (status.isLocked !== false && localOverdueLock);
  if (!isLocked) return null;

  async function submit() {
    const current = status;
    if (photos.length === 0 || !current) return;
    setSubmitting(true);
    setError(null);
    try {
      if (navigator.onLine) {
        const form = new FormData();
        photos.forEach((p, i) => form.append("photos", p, `cleanliness-${i}.jpg`));
        const res = await fetch(`${API_BASE}/api/cleanliness/${current.id}/complete`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body?.error ?? t("cleanliness.submitFailed"));
          return;
        }
        const nextStatus: CleanlinessStatus = {
          id: body.id,
          branchId: body.branchId ?? current.branchId,
          dueAt: body.dueAt,
          isOverdue: false,
          isLocked: false,
        };
        setStatus(nextStatus);
        localStorage.setItem(CACHE_KEY, JSON.stringify(nextStatus));
        setPhotos([]);
        setGridKey((k) => k + 1);
        // تأكيد الحالة من السيرفر بعد الإكمال
        await refresh();
      } else {
        await enqueue({
          kind: "cleanliness-complete",
          url: `/api/cleanliness/${current.id}/complete`,
          method: "POST",
          fields: {},
          fileFields: { photos: photos.map((p, i) => ({ blob: p, filename: `cleanliness-${i}.jpg` })) },
        });
        const optimisticNext: CleanlinessStatus = {
          id: current.id,
          branchId: current.branchId,
          dueAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
          isOverdue: false,
          isLocked: false,
        };
        setStatus(optimisticNext);
        localStorage.setItem(CACHE_KEY, JSON.stringify(optimisticNext));
        setPhotos([]);
        setGridKey((k) => k + 1);
      }
    } catch (err: any) {
      setError(err?.message ?? t("cleanliness.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overlay-lock">
      <div style={{ fontSize: 44 }}>🧴</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{t("cleanliness.overdueTitle")}</div>
      <div style={{ color: "var(--muted)", maxWidth: 480 }}>{t("cleanliness.overdueBody")}</div>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <PhotoCaptureGrid key={gridKey} count={4} onChange={setPhotos} label={t("cleanliness.photoLabel")} />
      </div>
      {error && <div style={{ color: "var(--danger)", maxWidth: 480 }}>{error}</div>}
      <button className="big-btn success" disabled={photos.length === 0 || submitting} onClick={submit}>
        {submitting ? t("common.saving") : t("cleanliness.submitBtn")}
      </button>
    </div>
  );
}
