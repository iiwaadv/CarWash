import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}
interface EmployeeRow {
  id: number;
  name: string;
  role: string;
  isActive: boolean;
  branchId: number;
  branch: { name: string };
}

const ROLES = [
  { id: "manager", label: "مدير عام" },
  { id: "supervisor", label: "مشرف" },
  { id: "washer", label: "عامل غسيل" },
  { id: "detailer", label: "فني تنشيف" },
];

export default function Employees() {
  const { token } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("supervisor");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetPinFor, setResetPinFor] = useState<number | null>(null);
  const [newPin, setNewPin] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function load() {
    const [b, e] = await Promise.all([apiFetch("/api/branches", token), apiFetch("/api/employees", token)]);
    setBranches(b);
    setEmployees(e);
    if (b.length && branchId === null) setBranchId(b[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length !== 4) return setError("رمز PIN يجب أن يكون 4 أرقام");
    try {
      await apiFetchJson("/api/employees", token, "POST", { name, role, branchId, pinCode: pin });
      setName("");
      setPin("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleActive(emp: EmployeeRow) {
    await apiFetch(`/api/employees/${emp.id}/${emp.isActive ? "deactivate" : "activate"}`, token, {
      method: "POST",
    });
    load();
  }

  async function submitResetPin(id: number) {
    if (newPin.length !== 4) return;
    await apiFetchJson(`/api/employees/${id}`, token, "PATCH", { pinCode: newPin });
    setResetPinFor(null);
    setNewPin("");
  }

  function startRename(emp: EmployeeRow) {
    setRenamingId(emp.id);
    setRenameValue(emp.name);
  }

  async function submitRename(id: number) {
    if (!renameValue.trim()) return;
    await apiFetchJson(`/api/employees/${id}`, token, "PATCH", { name: renameValue.trim() });
    setRenamingId(null);
    load();
  }

  return (
    <div>
      <div className="page-title">👥 إدارة الطاقم والصلاحيات</div>

      <div className="section-card">
        <div className="section-title">إضافة موظف جديد</div>
        <form onSubmit={createEmployee}>
          <div className="form-row">
            <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} required />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <select value={branchId ?? ""} onChange={(e) => setBranchId(Number(e.target.value))}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              placeholder="PIN (4 أرقام)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              inputMode="numeric"
              required
            />
            <button className="btn">إضافة</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">قائمة الموظفين</div>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الدور</th>
              <th>الفرع</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  {renamingId === emp.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                        autoFocus
                      />
                      <button className="btn" onClick={() => submitRename(emp.id)}>
                        حفظ
                      </button>
                      <button className="btn secondary" onClick={() => setRenamingId(null)}>
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    emp.name
                  )}
                </td>
                <td>{ROLES.find((r) => r.id === emp.role)?.label ?? emp.role}</td>
                <td>{emp.branch?.name}</td>
                <td>
                  <span className={`pill ${emp.isActive ? "active" : "inactive"}`}>
                    {emp.isActive ? "نشط" : "متوقف"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {renamingId !== emp.id && (
                    <button className="btn secondary" onClick={() => startRename(emp)}>
                      تعديل الاسم
                    </button>
                  )}
                  <button className="btn secondary" onClick={() => setResetPinFor(emp.id)}>
                    تغيير PIN
                  </button>
                  <button className={`btn ${emp.isActive ? "danger" : "success"}`} onClick={() => toggleActive(emp)}>
                    {emp.isActive ? "إيقاف" : "تفعيل"}
                  </button>
                  {resetPinFor === emp.id && (
                    <>
                      <input
                        placeholder="PIN جديد"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        style={{ width: 90 }}
                      />
                      <button className="btn" onClick={() => submitResetPin(emp.id)}>
                        حفظ
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
