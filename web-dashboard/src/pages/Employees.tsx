import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}
interface Bay {
  id: number;
  branchId: number;
  bayName: string;
}
interface EmployeeRow {
  id: number;
  name: string;
  role: string;
  jobTitle: string | null;
  isActive: boolean;
  branchId: number;
  defaultBayId: number | null;
  branch: { name: string };
  defaultBay: { id: number; bayName: string } | null;
}

export default function Employees() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("supervisor");
  const [jobTitle, setJobTitle] = useState("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [defaultBayId, setDefaultBayId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetPinFor, setResetPinFor] = useState<number | null>(null);
  const [newPin, setNewPin] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const ROLES = [
    { id: "manager", label: t("employees.roles.manager") },
    { id: "branch_manager", label: t("employees.roles.branch_manager") },
    { id: "supervisor", label: t("employees.roles.supervisor") },
    { id: "washer", label: t("employees.roles.washer") },
    { id: "detailer", label: t("employees.roles.detailer") },
  ];

  const branchBays = bays.filter((b) => b.branchId === branchId);

  async function load() {
    const [b, e, bayData] = await Promise.all([
      apiFetch("/api/branches", token),
      apiFetch("/api/employees", token),
      apiFetch("/api/bays", token),
    ]);
    setBranches(b);
    setEmployees(e);
    setBays(bayData);
    if (b.length && branchId === null) setBranchId(b[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length !== 4) return setError(t("employees.pinLengthError"));
    try {
      await apiFetchJson("/api/employees", token, "POST", {
        name,
        role,
        jobTitle: jobTitle.trim() || undefined,
        branchId,
        pinCode: pin,
        defaultBayId: defaultBayId ? Number(defaultBayId) : null,
      });
      setName("");
      setJobTitle("");
      setPin("");
      setDefaultBayId("");
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

  async function assignBay(emp: EmployeeRow, bayId: string) {
    await apiFetchJson(`/api/employees/${emp.id}`, token, "PATCH", {
      defaultBayId: bayId ? Number(bayId) : null,
    });
    load();
  }

  return (
    <div>
      <div className="page-title">{t("employees.title")}</div>

      <div className="section-card">
        <div className="section-title">{t("employees.addTitle")}</div>
        <form onSubmit={createEmployee}>
          <div className="form-row">
            <input placeholder={t("employees.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
            <input placeholder={t("employees.jobTitle")} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={branchId ?? ""}
              onChange={(e) => {
                setBranchId(Number(e.target.value));
                setDefaultBayId("");
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={defaultBayId} onChange={(e) => setDefaultBayId(e.target.value)}>
              <option value="">{t("employees.noBay")}</option>
              {branchBays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bayName}
                </option>
              ))}
            </select>
            <input
              placeholder={t("employees.pinPlaceholder")}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              inputMode="numeric"
              required
            />
            <button className="btn">{t("common.add")}</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">{t("employees.listTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("employees.colName")}</th>
              <th>{t("employees.colRole")}</th>
              <th>{t("employees.jobTitle")}</th>
              <th>{t("employees.colBranch")}</th>
              <th>{t("employees.colBay")}</th>
              <th>{t("employees.colStatus")}</th>
              <th>{t("employees.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const empBays = bays.filter((b) => b.branchId === emp.branchId);
              return (
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
                          {t("common.save")}
                        </button>
                        <button className="btn secondary" onClick={() => setRenamingId(null)}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      emp.name
                    )}
                  </td>
                  <td>{ROLES.find((r) => r.id === emp.role)?.label ?? emp.role}</td>
                  <td>{emp.jobTitle ?? "—"}</td>
                  <td>{emp.branch?.name}</td>
                  <td>
                    <select
                      value={emp.defaultBayId ?? ""}
                      onChange={(e) => assignBay(emp, e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)" }}
                    >
                      <option value="">{t("employees.noBay")}</option>
                      {empBays.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bayName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`pill ${emp.isActive ? "active" : "inactive"}`}>
                      {emp.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {renamingId !== emp.id && (
                      <button className="btn secondary" onClick={() => startRename(emp)}>
                        {t("employees.editName")}
                      </button>
                    )}
                    <button className="btn secondary" onClick={() => setResetPinFor(emp.id)}>
                      {t("employees.changePin")}
                    </button>
                    <button className={`btn ${emp.isActive ? "danger" : "success"}`} onClick={() => toggleActive(emp)}>
                      {emp.isActive ? t("employees.deactivate") : t("employees.activate")}
                    </button>
                    {resetPinFor === emp.id && (
                      <>
                        <input
                          placeholder={t("employees.newPinPlaceholder")}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          maxLength={4}
                          style={{ width: 90 }}
                        />
                        <button className="btn" onClick={() => submitResetPin(emp.id)}>
                          {t("common.save")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
