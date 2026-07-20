import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface BranchRow {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
}

const STATUS_OPTIONS = [
  { id: "open", label: "مفتوح" },
  { id: "closed", label: "مغلق" },
  { id: "maintenance", label: "صيانة" },
];

export default function Branches() {
  const { token } = useAuth();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

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
    if (!confirm(`هل تريد حذف/أرشفة "${b.name}"؟ يمكن استرجاعه لاحقاً.`)) return;
    await apiFetch(`/api/branches/${b.id}`, token, { method: "DELETE" });
    load();
  }

  async function restoreBranch(b: BranchRow) {
    await apiFetch(`/api/branches/${b.id}/activate`, token, { method: "POST" });
    load();
  }

  return (
    <div>
      <div className="page-title">🏢 إدارة الفروع</div>

      <div className="section-card">
        <div className="section-title">إضافة فرع جديد</div>
        <form onSubmit={addBranch}>
          <div className="form-row">
            <input placeholder="اسم الفرع" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <button className="btn">إضافة الفرع</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">قائمة الفروع</div>
        <table>
          <thead>
            <tr>
              <th>اسم الفرع</th>
              <th>الحالة التشغيلية</th>
              <th>الحالة</th>
              <th>إجراءات</th>
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
                        حفظ
                      </button>
                      <button className="btn secondary" onClick={() => setEditingId(null)}>
                        إلغاء
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
                    {b.isActive ? "نشط" : "محذوف/مؤرشف"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {editingId !== b.id && b.isActive && (
                    <button className="btn secondary" onClick={() => startEdit(b)}>
                      تعديل الاسم
                    </button>
                  )}
                  {b.isActive ? (
                    <button className="btn danger" onClick={() => archiveBranch(b)}>
                      حذف
                    </button>
                  ) : (
                    <button className="btn success" onClick={() => restoreBranch(b)}>
                      استرجاع
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {branches.length === 0 && <div className="empty-state">لا توجد فروع بعد</div>}
      </div>
    </div>
  );
}
