import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}

interface ScheduleRow {
  id: number;
  branchId: number;
  equipmentName: string;
  intervalDays: number;
  notes: string | null;
  lastPerformedAt: string | null;
  nextDueAt: string;
  isOverdue: boolean;
  daysUntilDue: number;
  branch: { name: string };
}

export default function PreventiveMaintenance() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [equipmentName, setEquipmentName] = useState("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [intervalDays, setIntervalDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const [b, s] = await Promise.all([
      apiFetch("/api/branches", token),
      apiFetch("/api/maintenance-schedules", token),
    ]);
    setBranches(b);
    setSchedules(s);
    if (b.length && branchId === null) setBranchId(b[0].id);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetchJson("/api/maintenance-schedules", token, "POST", {
        branchId,
        equipmentName,
        intervalDays,
        notes: notes || undefined,
      });
      setEquipmentName("");
      setNotes("");
      setIntervalDays(30);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function markDone(id: number) {
    setBusyId(id);
    try {
      await apiFetch(`/api/maintenance-schedules/${id}/complete`, token, { method: "POST" });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeSchedule(id: number) {
    setBusyId(id);
    try {
      await apiFetch(`/api/maintenance-schedules/${id}`, token, { method: "DELETE" });
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  const overdueCount = schedules.filter((s) => s.isOverdue).length;
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  return (
    <div>
      <div className="page-title">{t("maintenance.title")}</div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="value" style={{ color: overdueCount > 0 ? "var(--danger)" : "inherit" }}>
            {overdueCount}
          </div>
          <div className="label">{t("maintenance.overdueCount")}</div>
        </div>
        <div className="kpi-card">
          <div className="value">{schedules.length}</div>
          <div className="label">{t("maintenance.totalCount")}</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">{t("maintenance.addTitle")}</div>
        <form onSubmit={createSchedule}>
          <div className="form-row">
            <input
              placeholder={t("maintenance.equipmentNamePlaceholder")}
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
              required
            />
            <select value={branchId ?? ""} onChange={(e) => setBranchId(Number(e.target.value))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              placeholder={t("maintenance.intervalPlaceholder")}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              required
              style={{ width: 100 }}
            />
            <input placeholder={t("maintenance.notesPlaceholder")} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn">{t("common.add")}</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">{t("maintenance.scheduleTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("maintenance.colEquipment")}</th>
              <th>{t("maintenance.colBranch")}</th>
              <th>{t("maintenance.colCycle")}</th>
              <th>{t("maintenance.colLastDone")}</th>
              <th>{t("maintenance.colNextDue")}</th>
              <th>{t("maintenance.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.equipmentName}
                  {s.notes && <div style={{ color: "var(--muted)", fontSize: 12 }}>{s.notes}</div>}
                </td>
                <td>{s.branch.name}</td>
                <td>{t("maintenance.everyNDays", { n: s.intervalDays })}</td>
                <td>{s.lastPerformedAt ? new Date(s.lastPerformedAt).toLocaleDateString(locale) : "—"}</td>
                <td style={{ color: s.isOverdue ? "var(--danger)" : "inherit", fontWeight: s.isOverdue ? 700 : 400 }}>
                  {new Date(s.nextDueAt).toLocaleDateString(locale)}
                  {s.isOverdue
                    ? ` ${t("maintenance.overdueByDays", { n: Math.abs(s.daysUntilDue) })}`
                    : ` ${t("maintenance.dueInDays", { n: s.daysUntilDue })}`}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn success" disabled={busyId === s.id} onClick={() => markDone(s.id)}>
                    {t("maintenance.markDone")}
                  </button>
                  <button className="btn danger" disabled={busyId === s.id} onClick={() => removeSchedule(s.id)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  {t("maintenance.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
