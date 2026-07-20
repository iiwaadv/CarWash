import { useEffect, useState } from "react";
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

  return (
    <div>
      <div className="page-title">🛠️ الصيانة الوقائية الدورية</div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="value" style={{ color: overdueCount > 0 ? "var(--danger)" : "inherit" }}>
            {overdueCount}
          </div>
          <div className="label">معدات متأخرة عن الصيانة</div>
        </div>
        <div className="kpi-card">
          <div className="value">{schedules.length}</div>
          <div className="label">إجمالي المعدات المتابعة</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">إضافة معدة إلى جدول الصيانة</div>
        <form onSubmit={createSchedule}>
          <div className="form-row">
            <input
              placeholder="اسم المعدة (مثال: مضخة ضغط عالي - موقف 1)"
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
              placeholder="عدد الأيام بين كل صيانة"
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              required
              style={{ width: 100 }}
            />
            <input placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn">إضافة</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">جدول الصيانة الحالي</div>
        <table>
          <thead>
            <tr>
              <th>المعدة</th>
              <th>الفرع</th>
              <th>دورة الصيانة</th>
              <th>آخر صيانة</th>
              <th>الاستحقاق القادم</th>
              <th>إجراءات</th>
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
                <td>كل {s.intervalDays} يوم</td>
                <td>{s.lastPerformedAt ? new Date(s.lastPerformedAt).toLocaleDateString("ar-SA") : "—"}</td>
                <td style={{ color: s.isOverdue ? "var(--danger)" : "inherit", fontWeight: s.isOverdue ? 700 : 400 }}>
                  {new Date(s.nextDueAt).toLocaleDateString("ar-SA")}
                  {s.isOverdue
                    ? ` — متأخرة ${Math.abs(s.daysUntilDue)} يوم`
                    : ` — بعد ${s.daysUntilDue} يوم`}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn success" disabled={busyId === s.id} onClick={() => markDone(s.id)}>
                    ✅ تمت الصيانة
                  </button>
                  <button className="btn danger" disabled={busyId === s.id} onClick={() => removeSchedule(s.id)}>
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  لا توجد معدات في جدول الصيانة الوقائية بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
