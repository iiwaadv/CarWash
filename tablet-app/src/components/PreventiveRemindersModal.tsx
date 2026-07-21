import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface Schedule {
  id: number;
  equipmentName: string;
  intervalDays: number;
  nextDueAt: string;
  isOverdue: boolean;
  daysUntilDue: number;
  notes: string | null;
}

export default function PreventiveRemindersModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  async function load() {
    if (!token) return;
    try {
      const data = await apiFetch("/api/maintenance-schedules", token);
      // أظهر المتأخرة والمستحقة خلال 7 أيام فقط
      setSchedules(
        data.filter((s: Schedule) => s.isOverdue || s.daysUntilDue <= 7)
      );
    } catch {
      setSchedules([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function markDone(id: number) {
    setBusyId(id);
    try {
      await apiFetch(`/api/maintenance-schedules/${id}/complete`, token, { method: "POST" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 560 }}>
        <div className="modal-title">{t("pmReminders.title")}</div>
        <div style={{ color: "var(--muted)", marginBottom: 16, fontSize: 14 }}>
          {t("pmReminders.subtitle")}
        </div>

        {schedules.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>
            {t("pmReminders.empty")}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                background: s.isOverdue ? "rgba(178, 58, 46, 0.08)" : "var(--card)",
              }}
            >
              <div style={{ fontWeight: 800 }}>{s.equipmentName}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                {s.isOverdue
                  ? t("pmReminders.overdueBy", { n: Math.abs(s.daysUntilDue) })
                  : t("pmReminders.dueIn", { n: s.daysUntilDue })}
                {" · "}
                {new Date(s.nextDueAt).toLocaleDateString(locale)}
              </div>
              {s.notes && <div style={{ fontSize: 13, marginTop: 4 }}>{s.notes}</div>}
              <button
                className="big-btn success"
                style={{ padding: "8px 14px", fontSize: 14, marginTop: 10 }}
                disabled={busyId === s.id}
                onClick={() => markDone(s.id)}
              >
                {busyId === s.id ? t("common.saving") : t("pmReminders.markDone")}
              </button>
            </div>
          ))}
        </div>

        <button className="big-btn secondary" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
