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
  bayName: string;
  branchId: number;
}

interface EquipmentRow {
  id: number;
  name: string;
  bayId: number;
  isActive: boolean;
}

export default function Equipment() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [newBayId, setNewBayId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  async function load(currentBranchId: number | null) {
    const b = await apiFetch("/api/branches", token);
    setBranches(b);
    const activeBranchId = currentBranchId ?? b[0]?.id ?? null;
    if (currentBranchId === null && activeBranchId) setBranchId(activeBranchId);
    if (!activeBranchId) return;
    const bayList: Bay[] = await apiFetch(`/api/bays?branchId=${activeBranchId}`, token);
    setBays(bayList);
    const eq = await apiFetch(`/api/bay-equipment?branchId=${activeBranchId}`, token);
    setEquipment(eq);
  }

  useEffect(() => {
    load(branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, branchId]);

  async function addEquipment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim() || !newBayId) return;
    try {
      await apiFetchJson("/api/bay-equipment", token, "POST", { bayId: Number(newBayId), name: newName.trim() });
      setNewName("");
      load(branchId);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(eq: EquipmentRow) {
    setEditingId(eq.id);
    setEditingName(eq.name);
  }

  async function saveEdit(id: number) {
    if (!editingName.trim()) return;
    await apiFetchJson(`/api/bay-equipment/${id}`, token, "PATCH", { name: editingName.trim() });
    setEditingId(null);
    load(branchId);
  }

  async function removeEquipment(id: number) {
    if (!confirm(t("equipment.confirmDelete"))) return;
    await apiFetch(`/api/bay-equipment/${id}`, token, { method: "DELETE" });
    load(branchId);
  }

  return (
    <div>
      <div className="page-title">{t("equipment.title")}</div>

      <div className="section-card">
        <div className="section-title">{t("equipment.branchSelectLabel")}</div>
        <div className="chip-row">
          {branches.map((b) => (
            <button key={b.id} className={`chip-btn ${branchId === b.id ? "active" : ""}`} onClick={() => setBranchId(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">{t("equipment.addTitle")}</div>
        <form onSubmit={addEquipment}>
          <div className="form-row">
            <select value={newBayId} onChange={(e) => setNewBayId(e.target.value)} required>
              <option value="">{t("equipment.selectBay")}</option>
              {bays.map((bay) => (
                <option key={bay.id} value={bay.id}>
                  {bay.bayName}
                </option>
              ))}
            </select>
            <input placeholder={t("equipment.namePlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <button className="btn">{t("common.add")}</button>
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        </form>
      </div>

      <div className="section-card">
        <div className="section-title">{t("equipment.listTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("equipment.colBay")}</th>
              <th>{t("equipment.colName")}</th>
              <th>{t("branches.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {bays.map((bay) => {
              const bayEquipment = equipment.filter((eq) => eq.bayId === bay.id);
              if (bayEquipment.length === 0) {
                return (
                  <tr key={`empty-${bay.id}`}>
                    <td style={{ fontWeight: 700 }}>{bay.bayName}</td>
                    <td className="empty-state" colSpan={2}>
                      {t("equipment.emptyForBay")}
                    </td>
                  </tr>
                );
              }
              return bayEquipment.map((eq, i) => (
                <tr key={eq.id}>
                  {i === 0 ? (
                    <td style={{ fontWeight: 700 }} rowSpan={bayEquipment.length}>
                      {bay.bayName}
                    </td>
                  ) : null}
                  <td>
                    {editingId === eq.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                          autoFocus
                        />
                        <button className="btn" onClick={() => saveEdit(eq.id)}>
                          {t("common.save")}
                        </button>
                        <button className="btn secondary" onClick={() => setEditingId(null)}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      eq.name
                    )}
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    {editingId !== eq.id && (
                      <button className="btn secondary" onClick={() => startEdit(eq)}>
                        {t("employees.editName")}
                      </button>
                    )}
                    <button className="btn danger" onClick={() => removeEquipment(eq.id)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ));
            })}
            {bays.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  {t("equipment.noBays")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
