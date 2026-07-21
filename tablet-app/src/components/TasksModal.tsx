import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface EmployeeOption {
  id: number;
  name: string;
  role: string;
}

interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
  assignedTo: { id: number; name: string } | null;
  createdBy: { id: number; name: string } | null;
}

export default function TasksModal({ onClose }: { onClose: () => void }) {
  const { token, employee } = useAuth();
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  const canCreate = employee?.role === "manager" || employee?.role === "supervisor";

  async function load() {
    if (!token) return;
    try {
      const data = await apiFetch("/api/tasks", token);
      setTasks(data);
    } catch {
      // stay on cached state if offline
    }
  }

  useEffect(() => {
    load();
    if (token) apiFetch(`/api/employees?branchId=${employee?.branchId ?? ""}`, token).then(setEmployees).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => (filter === "all" ? tasks : tasks.filter((tsk) => tsk.status === filter)), [tasks, filter]);

  const FILTERS = [
    { id: "all", label: t("tasks.filterAll") },
    { id: "new", label: t("tasks.status.new") },
    { id: "acknowledged", label: t("tasks.status.acknowledged") },
    { id: "in_progress", label: t("tasks.status.in_progress") },
    { id: "done", label: t("tasks.status.done") },
  ];

  async function advance(task: TaskItem) {
    const endpoint = task.status === "new" ? "acknowledge" : task.status === "acknowledged" ? "start" : "complete";
    await apiFetchJson(`/api/tasks/${task.id}/${endpoint}`, token, "POST", {});
    load();
  }

  async function createTask() {
    setError(null);
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await apiFetchJson("/api/tasks", token, "POST", {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToId: assignedToId ? Number(assignedToId) : undefined,
        priority,
      });
      setTitle("");
      setDescription("");
      setAssignedToId("");
      setPriority("normal");
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.message ?? t("tasks.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  const ACTION_LABEL: Record<string, string> = {
    new: t("tasks.acknowledgeBtn"),
    acknowledged: t("tasks.startBtn"),
    in_progress: t("tasks.completeBtn"),
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 640 }}>
        <div className="modal-title">{t("tasks.title")}</div>

        <div className="chip-row" style={{ marginBottom: 10 }}>
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip-btn ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: "45vh", overflowY: "auto", marginBottom: 12 }}>
          {filtered.map((tsk) => (
            <div
              key={tsk.id}
              className="car-card"
              style={{ marginBottom: 8, borderColor: tsk.priority === "urgent" ? "var(--danger)" : undefined }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 800 }}>
                  {tsk.priority === "urgent" && "🚨 "}
                  {tsk.title}
                </div>
                <span className={`badge status-badge-${tsk.status}`}>{t(`tasks.status.${tsk.status}`)}</span>
              </div>
              {tsk.description && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{tsk.description}</div>}
              <div className="meta" style={{ marginTop: 6 }}>
                <span>{tsk.assignedTo ? t("tasks.assignedTo", { name: tsk.assignedTo.name }) : t("tasks.unassigned")}</span>
                <span>{new Date(tsk.createdAt).toLocaleString(locale)}</span>
              </div>
              {tsk.status !== "done" && (
                <button className="big-btn success" style={{ marginTop: 8, padding: "8px 14px", fontSize: 13 }} onClick={() => advance(tsk)}>
                  {ACTION_LABEL[tsk.status]}
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state">{t("tasks.empty")}</div>}
        </div>

        {canCreate && !showCreate && (
          <button className="big-btn secondary" style={{ marginBottom: 10 }} onClick={() => setShowCreate(true)}>
            {t("tasks.newTaskBtn")}
          </button>
        )}

        {canCreate && showCreate && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 12 }}>
            <div className="field-label">{t("tasks.titleLabel")}</div>
            <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="field-label">{t("tasks.descriptionLabel")}</div>
            <input className="text-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="field-label">{t("tasks.assignToLabel")}</div>
            <select
              className="text-input"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
            >
              <option value="">{t("tasks.unassigned")}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({t(`topbar.roles.${emp.role}`, emp.role)})
                </option>
              ))}
            </select>
            <div className="chip-row" style={{ marginTop: 8 }}>
              <button className={`chip-btn ${priority === "normal" ? "active" : ""}`} onClick={() => setPriority("normal")}>
                {t("tasks.priorityNormal")}
              </button>
              <button className={`chip-btn ${priority === "urgent" ? "active" : ""}`} onClick={() => setPriority("urgent")}>
                {t("tasks.priorityUrgent")}
              </button>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button className="big-btn secondary" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </button>
              <button className="big-btn success" disabled={!title.trim() || submitting} onClick={createTask}>
                {submitting ? t("common.saving") : t("tasks.createBtn")}
              </button>
            </div>
          </div>
        )}

        <button className="big-btn secondary" style={{ width: "100%" }} onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
