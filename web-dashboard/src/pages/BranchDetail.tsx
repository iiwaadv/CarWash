import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface BranchOption {
  id: number;
  name: string;
}

interface Detail {
  branch: { id: number; name: string; status: string; shiftOpenTime: string; shiftCloseTime: string };
  counts: {
    bays: number;
    occupiedBays: number;
    freeBays: number;
    equipment: number;
    employees: number;
    activeEmployees: number;
    activeJobs: number;
  };
  jobsByStatus: Record<string, number>;
  bays: Array<{
    id: number;
    bayName: string;
    occupied: boolean;
    equipment: Array<{ id: number; name: string }>;
    cars: Array<{ id: number; plateNumber: string; status: string }>;
  }>;
  employees: Array<{
    id: number;
    name: string;
    role: string;
    isActive: boolean;
    defaultBay: { bayName: string } | null;
  }>;
  recentUpsells: Array<{
    bonusAmount: number;
    service: { serviceName: string };
    employee: { name: string } | null;
    job: { plateNumber: string };
  }>;
  recentIncidents: Array<{
    id: number;
    type: string;
    status: string;
    description: string;
    bay: { bayName: string } | null;
    equipment: { name: string } | null;
  }>;
  inventory: Array<{ quantity: number; item: { name: string; unit: string } }>;
  openings: Array<{ id: number; shiftDate: string; supervisor: { name: string } }>;
  closures: Array<{ id: number; shiftDate: string; supervisor: { name: string }; towelsReceivedStart: number; towelsCollectedEnd: number }>;
}

export default function BranchDetail() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/branches", token).then((b: BranchOption[]) => {
      setBranches(b);
      if (b.length) setBranchId(b[0].id);
    });
  }, [token]);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    apiFetch(`/api/branches/${branchId}/detail`, token)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [token, branchId]);

  return (
    <div>
      <div className="page-title">{t("branchDetail.title")}</div>
      <div className="section-card">
        <div className="form-row">
          <select value={branchId ?? ""} onChange={(e) => setBranchId(Number(e.target.value))}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="empty-state">{t("common.loading")}</div>}

      {detail && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="value">{detail.counts.bays}</div>
              <div className="label">{t("branchDetail.bays")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">
                {detail.counts.occupiedBays}/{detail.counts.freeBays}
              </div>
              <div className="label">{t("branchDetail.occupiedFree")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.equipment}</div>
              <div className="label">{t("branchDetail.equipment")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.activeEmployees}</div>
              <div className="label">{t("branchDetail.staff")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.activeJobs}</div>
              <div className="label">{t("branchDetail.activeJobs")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">
                {detail.branch.shiftOpenTime}–{detail.branch.shiftCloseTime}
              </div>
              <div className="label">{t("branchDetail.shiftHours")}</div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-title">{t("branchDetail.baysTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("branchDetail.colBay")}</th>
                  <th>{t("branchDetail.colStatus")}</th>
                  <th>{t("branchDetail.colCars")}</th>
                  <th>{t("branchDetail.colEquipment")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.bays.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.bayName}</td>
                    <td>{b.occupied ? t("branchDetail.occupied") : t("branchDetail.free")}</td>
                    <td>{b.cars.map((c) => `${c.plateNumber} (${c.status})`).join(" · ") || "—"}</td>
                    <td>{b.equipment.map((e) => e.name).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-card">
            <div className="section-title">{t("branchDetail.staffTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("branchDetail.colName")}</th>
                  <th>{t("branchDetail.colRole")}</th>
                  <th>{t("branchDetail.colBay")}</th>
                  <th>{t("branchDetail.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.employees.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{e.role}</td>
                    <td>{e.defaultBay?.bayName ?? "—"}</td>
                    <td>{e.isActive ? t("common.active") : t("common.inactive")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-card">
            <div className="section-title">{t("branchDetail.upsellsTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("branchDetail.colEmployee")}</th>
                  <th>{t("branchDetail.colService")}</th>
                  <th>{t("branchDetail.colPlate")}</th>
                  <th>{t("branchDetail.colBonus")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.recentUpsells.map((u, i) => (
                  <tr key={i}>
                    <td>{u.employee?.name ?? "—"}</td>
                    <td>{u.service.serviceName}</td>
                    <td>{u.job.plateNumber}</td>
                    <td>{u.bonusAmount.toFixed(2)}</td>
                  </tr>
                ))}
                {detail.recentUpsells.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      {t("branchDetail.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="section-card">
            <div className="section-title">{t("branchDetail.inventoryTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("branchDetail.colItem")}</th>
                  <th>{t("branchDetail.colQty")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.inventory.map((row, i) => (
                  <tr key={i}>
                    <td>{row.item.name}</td>
                    <td>
                      {row.quantity} {row.item.unit}
                    </td>
                  </tr>
                ))}
                {detail.inventory.length === 0 && (
                  <tr>
                    <td colSpan={2} className="empty-state">
                      {t("branchDetail.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="section-card">
            <div className="section-title">{t("branchDetail.incidentsTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("branchDetail.colBay")}</th>
                  <th>{t("branchDetail.colEquipment")}</th>
                  <th>{t("branchDetail.colStatus")}</th>
                  <th>{t("branchDetail.colDesc")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.recentIncidents.map((inc) => (
                  <tr key={inc.id}>
                    <td>{inc.bay?.bayName ?? t("branchDetail.general")}</td>
                    <td>{inc.equipment?.name ?? "—"}</td>
                    <td>{inc.status}</td>
                    <td>{inc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-card">
            <div className="section-title">{t("branchDetail.shiftsTitle")}</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>
              {t("branchDetail.openings")}: {detail.openings.length} · {t("branchDetail.closures")}: {detail.closures.length}
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("branchDetail.colType")}</th>
                  <th>{t("branchDetail.colSupervisor")}</th>
                  <th>{t("branchDetail.colDate")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.openings.slice(0, 8).map((o) => (
                  <tr key={`o-${o.id}`}>
                    <td>{t("branchDetail.opening")}</td>
                    <td>{o.supervisor.name}</td>
                    <td>{new Date(o.shiftDate).toLocaleString(locale)}</td>
                  </tr>
                ))}
                {detail.closures.slice(0, 8).map((c) => (
                  <tr key={`c-${c.id}`}>
                    <td>{t("branchDetail.closure")}</td>
                    <td>{c.supervisor.name}</td>
                    <td>{new Date(c.shiftDate).toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
