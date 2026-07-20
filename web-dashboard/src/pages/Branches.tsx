import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface BranchRow {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
}

export default function Branches() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const STATUS_OPTIONS = [
    { id: "open", label: t("branches.status.open") },
    { id: "closed", label: t("branches.status.closed") },
    { id: "maintenance", label: t("branches.status.maintenance") },
  ];

  async function load() {
    const b = await apiFetch("/api/branches/manage", token);
    setBranches(b);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function addBranch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    try {
      await apiFetchJson("/api/branches", token, "POST", { name: newName.trim(), status: "open" });
      setNewName("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(b: BranchRow) {
    setEditingId(b.id);
    setEditingName(b.name);
  }

  async function saveEdit(id: number) {
    if (!editingName.trim()) return;
    await apiFetchJson(`/api/branches/${id}`, token, "PATCH", { name: editingName.trim() });
    setEditingId(null);
    load();
  }

  async function changeStatus(b: BranchRow, status: string) {
    await apiFetchJson(`/api/branches/${b.id}`, token, "PATCH", { status });
    load();
  }

  async function archiveBranch(b: BranchRow) {
    if (!confirm(t("branches.confirmArchive", { name: b.name }))) return;
    await apiFetch(`/api/branches/${b.id}`, token, { method: "DELETE" });
    load();
  }

  async function restoreBranch(b: BranchRow) {
    await apiFetch(`/api/branches/${b.id}/activate`, token, { method: "POST" });
    load();
  }

  return (
    <div>
      <div className="page-title">{t("branches.title")}</div>

      <div className="section-card">
        <div className="section-title">{t("branches.addTitle")}</div>
        <form onSubmit={addBranch}>
          <div className="form-row">
            <input placeholder={t("branches.namePlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <button className="btn">{t("branches.addBtn")}</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">{t("branches.listTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("branches.colName")}</th>
              <th>{t("branches.colOperationalStatus")}</th>
              <th>{t("branches.colStatus")}</th>
              <th>{t("branches.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} style={!b.isActive ? { opacity: 0.55 } : undefined}>
                <td>
                  {editingId === b.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                        autoFocus
                      />
                      <button className="btn" onClick={() => saveEdit(b.id)}>
                        {t("common.save")}
                      </button>
                      <button className="btn secondary" onClick={() => setEditingId(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                  )}
                </td>
                <td>
                  <select
                    value={b.status}
                    onChange={(e) => changeStatus(b, e.target.value)}
                    disabled={!b.isActive}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`pill ${b.isActive ? "active" : "inactive"}`}>
                    {b.isActive ? t("common.active") : t("common.archived")}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {editingId !== b.id && b.isActive && (
                    <button className="btn secondary" onClick={() => startEdit(b)}>
                      {t("employees.editName")}
                    </button>
                  )}
                  {b.isActive ? (
                    <button className="btn danger" onClick={() => archiveBranch(b)}>
                      {t("common.delete")}
                    </button>
                  ) : (
                    <button className="btn success" onClick={() => restoreBranch(b)}>
                      {t("branches.restore")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {branches.length === 0 && <div className="empty-state">{t("branches.empty")}</div>}
      </div>
    </div>
  );
}
