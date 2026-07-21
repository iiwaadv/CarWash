import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}

interface ReportSummary {
  range: { from: string; to: string };
  kpis: {
    totalJobs: number;
    deliveredCount: number;
    cancelledCount: number;
    activeNow: number;
    upsellAccepted: number;
    upsellRejected: number;
    totalBonus: number;
    estimatedUpsellRevenue: number;
    towelsLost: number;
    maintenanceCost: number;
    feedbackCount: number;
    furiousCount: number;
    shiftClosures: number;
    shiftOpenings: number;
    incidents: number;
  };
  byBranch: Array<{
    branchId: number;
    branchName: string;
    jobs: number;
    delivered: number;
    cancelled: number;
    bonus: number;
  }>;
  targets: Array<{ period: string; amount: number; branch: { name: string } }>;
  recentJobs: Array<{ id: number; plateNumber: string; status: string; branch: { name: string }; createdAt: string }>;
  recentUpsells: Array<{
    status: string;
    bonusAmount: number;
    service: { serviceName: string };
    employee: { name: string } | null;
    job: { plateNumber: string; branch: { name: string } };
  }>;
  recentIncidents: Array<{
    type: string;
    status: string;
    repairCost: number;
    branch: { name: string };
    bay: { bayName: string } | null;
    equipment: { name: string } | null;
  }>;
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/branches", token).then(setBranches);
  }, [token]);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (branchId) qs.set("branchId", branchId);
      const summary = await apiFetch(`/api/reports/summary?${qs}`, token);
      setData(summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const k = data?.kpis;

  return (
    <div>
      <div className="page-title">{t("reports.title")}</div>

      <div className="section-card">
        <div className="form-row">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t("reports.allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? t("common.loading") : t("reports.refresh")}
          </button>
        </div>
      </div>

      {k && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="value">{k.totalJobs}</div>
            <div className="label">{t("reports.totalJobs")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.deliveredCount}</div>
            <div className="label">{t("reports.delivered")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.cancelledCount}</div>
            <div className="label">{t("reports.cancelled")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.estimatedUpsellRevenue.toFixed(0)}</div>
            <div className="label">{t("reports.upsellRevenue")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.totalBonus.toFixed(2)}</div>
            <div className="label">{t("reports.totalBonus")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.towelsLost}</div>
            <div className="label">{t("reports.towelsLost")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.maintenanceCost.toFixed(0)}</div>
            <div className="label">{t("reports.maintenanceCost")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.furiousCount}</div>
            <div className="label">{t("reports.furious")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.incidents}</div>
            <div className="label">{t("reports.incidents")}</div>
          </div>
          <div className="kpi-card">
            <div className="value">{k.shiftClosures}</div>
            <div className="label">{t("reports.shiftClosures")}</div>
          </div>
        </div>
      )}

      {data && data.byBranch.length > 0 && (
        <div className="section-card">
          <div className="section-title">{t("reports.byBranch")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("reports.colBranch")}</th>
                <th>{t("reports.colJobs")}</th>
                <th>{t("reports.delivered")}</th>
                <th>{t("reports.cancelled")}</th>
                <th>{t("reports.totalBonus")}</th>
              </tr>
            </thead>
            <tbody>
              {data.byBranch.map((b) => (
                <tr key={b.branchId}>
                  <td style={{ fontWeight: 700 }}>{b.branchName}</td>
                  <td>{b.jobs}</td>
                  <td>{b.delivered}</td>
                  <td>{b.cancelled}</td>
                  <td>{b.bonus.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.targets.length > 0 && (
        <div className="section-card">
          <div className="section-title">{t("reports.targets")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("reports.colBranch")}</th>
                <th>{t("reports.colPeriod")}</th>
                <th>{t("reports.colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.targets.map((tg, i) => (
                <tr key={i}>
                  <td>{tg.branch.name}</td>
                  <td>{t(`reports.period.${tg.period}`, tg.period)}</td>
                  <td>
                    {tg.amount.toFixed(2)} {t("common.riyal")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div className="section-card">
          <div className="section-title">{t("reports.recentJobs")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("reports.colPlate")}</th>
                <th>{t("reports.colBranch")}</th>
                <th>{t("reports.colStatus")}</th>
                <th>{t("reports.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentJobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.plateNumber}</td>
                  <td>{j.branch.name}</td>
                  <td>{j.status}</td>
                  <td>{new Date(j.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
              {data.recentJobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    {t("reports.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div className="section-card">
          <div className="section-title">{t("reports.recentUpsells")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("reports.colEmployee")}</th>
                <th>{t("reports.colBranch")}</th>
                <th>{t("reports.colService")}</th>
                <th>{t("reports.colStatus")}</th>
                <th>{t("reports.totalBonus")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentUpsells.map((u, i) => (
                <tr key={i}>
                  <td>{u.employee?.name ?? "—"}</td>
                  <td>{u.job.branch.name}</td>
                  <td>{u.service.serviceName}</td>
                  <td>{u.status}</td>
                  <td>{u.bonusAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div className="section-card">
          <div className="section-title">{t("reports.recentIncidents")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("reports.colBranch")}</th>
                <th>{t("reports.colBay")}</th>
                <th>{t("reports.colEquipment")}</th>
                <th>{t("reports.colStatus")}</th>
                <th>{t("reports.maintenanceCost")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentIncidents.map((inc, i) => (
                <tr key={i}>
                  <td>{inc.branch.name}</td>
                  <td>{inc.bay?.bayName ?? t("reports.general")}</td>
                  <td>{inc.equipment?.name ?? "—"}</td>
                  <td>{inc.status}</td>
                  <td>{inc.repairCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
