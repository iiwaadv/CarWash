import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}

interface EmployeeOption {
  id: number;
  name: string;
  branchId: number;
}

interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
  branch: { name: string };
  assignedTo: { id: number; name: string } | null;
  createdBy: { id: number; name: string } | null;
}

export default function Tasks() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  async function load() {
    const [taskData, branchData, employeeData] = await Promise.all([
      apiFetch("/api/tasks", token),
      apiFetch("/api/branches", token),
      apiFetch("/api/employees", token),
    ]);
    setTasks(taskData);
    setBranches(branchData);
    setEmployees(employeeData);
    if (branchData.length && branchId === null) setBranchId(branchData[0].id);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => (filter === "all" ? tasks : tasks.filter((tsk) => tsk.status === filter)), [tasks, filter]);
  const eligibleEmployees = employees.filter((e) => e.branchId === branchId);

  const FILTERS = [
    { id: "all", label: t("tasks.filterAll") },
    { id: "new", label: t("tasks.status.new") },
    { id: "acknowledged", label: t("tasks.status.acknowledged") },
    { id: "in_progress", label: t("tasks.status.in_progress") },
    { id: "done", label: t("tasks.status.done") },
  ];

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !branchId) return;
    try {
      await apiFetchJson("/api/tasks", token, "POST", {
        title: title.trim(),
        description: description.trim() || undefined,
        branchId,
        assignedToId: assignedToId ? Number(assignedToId) : undefined,
        priority,
      });
      setTitle("");
      setDescription("");
      setAssignedToId("");
      setPriority("normal");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeTask(id: number) {
    setBusyId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, token, { method: "DELETE" });
      setTasks((prev) => prev.filter((t2) => t2.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-title">{t("tasks.title")}</div>

      <div className="section-card">
        <div className="section-title">{t("tasks.newTaskBtn")}</div>
        <form onSubmit={createTask}>
          <div className="form-row">
            <input placeholder={t("tasks.titleLabel")} value={title} onChange={(e) => setTitle(e.target.value)} required />
            <select value={branchId ?? ""} onChange={(e) => setBranchId(Number(e.target.value))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
              <option value="">{t("tasks.unassigned")}</option>
              {eligibleEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="normal">{t("tasks.priorityNormal")}</option>
              <option value="urgent">{t("tasks.priorityUrgent")}</option>
            </select>
            <button className="btn">{t("common.add")}</button>
          </div>
          <input
            placeholder={t("tasks.descriptionLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginTop: 8, width: "100%" }}
          />
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`chip-btn ${filter === f.id ? "active" : ""}`}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("tasks.titleLabel")}</th>
              <th>{t("inventory.colBranch")}</th>
              <th>{t("tasks.assignToLabel")}</th>
              <th>{t("tasks.status.new")}</th>
              <th>{t("inventory.colDate")}</th>
              <th>{t("common.delete")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tsk) => (
              <tr key={tsk.id}>
                <td>
                  <span style={{ fontWeight: 700 }}>
                    {tsk.priority === "urgent" && "🚨 "}
                    {tsk.title}
                  </span>
                  {tsk.description && <div style={{ color: "var(--muted)", fontSize: 12 }}>{tsk.description}</div>}
                </td>
                <td>{tsk.branch.name}</td>
                <td>{tsk.assignedTo?.name ?? t("tasks.unassigned")}</td>
                <td>
                  <span className={`pill ${tsk.status === "done" ? "active" : "inactive"}`}>{t(`tasks.status.${tsk.status}`)}</span>
                </td>
                <td>{new Date(tsk.createdAt).toLocaleString(locale)}</td>
                <td>
                  <button className="btn danger" disabled={busyId === tsk.id} onClick={() => removeTask(tsk.id)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  {t("tasks.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
