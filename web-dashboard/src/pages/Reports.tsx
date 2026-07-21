import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, API_BASE } from "../lib/api";

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
    occupancyPct?: number;
    avgCycleMinutes?: number | null;
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
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null);

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

  async function downloadFile(format: "csv" | "xlsx") {
    setExporting(format);
    try {
      const qs = new URLSearchParams({ from, to, format });
      if (branchId) qs.set("branchId", branchId);
      const res = await fetch(`${API_BASE}/api/reports/export?${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Bypass-Tunnel-Reminder": "true",
        },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ejaz-report-${from}-${to}.${format === "xlsx" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      let report = data;
      if (!report) {
        const qs = new URLSearchParams({ from, to });
        if (branchId) qs.set("branchId", branchId);
        report = await apiFetch(`/api/reports/summary?${qs}`, token);
        setData(report);
      }
      if (!report) return;

      const html2pdf = (await import("html2pdf.js")).default;
      const branchName =
        branches.find((b) => String(b.id) === branchId)?.name ?? t("reports.allBranches");
      const k = report.kpis;
      const el = document.createElement("div");
      el.dir = i18n.language === "ar" ? "rtl" : "ltr";
      el.style.cssText =
        "font-family: Tajawal, Arial, sans-serif; padding: 24px; color: #221c13; background: #fff; width: 800px;";
      el.innerHTML = `
        <h1 style="color:#a87f1f;margin:0 0 8px;font-size:22px;">${t("brand.name")}</h1>
        <h2 style="margin:0 0 16px;font-size:18px;">${t("reports.title")}</h2>
        <p style="margin:0 0 16px;color:#79705f;">${from} → ${to} · ${branchName}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px;">
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.totalJobs")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.totalJobs}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.delivered")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.deliveredCount}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.cancelled")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.cancelledCount}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.upsellRevenue")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.estimatedUpsellRevenue.toFixed(0)}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.totalBonus")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.totalBonus.toFixed(2)}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.maintenanceCost")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.maintenanceCost.toFixed(0)}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.incidents")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.incidents}</td></tr>
          <tr><td style="padding:6px;border:1px solid #e7dfcb;">${t("reports.furious")}</td><td style="padding:6px;border:1px solid #e7dfcb;font-weight:700;">${k.furiousCount}</td></tr>
        </table>
        <h3 style="font-size:15px;margin:12px 0 8px;">${t("reports.byBranch")}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;">
          <thead>
            <tr>
              <th style="border:1px solid #e7dfcb;padding:6px;background:#faf7ef;">${t("reports.colBranch")}</th>
              <th style="border:1px solid #e7dfcb;padding:6px;background:#faf7ef;">${t("reports.colJobs")}</th>
              <th style="border:1px solid #e7dfcb;padding:6px;background:#faf7ef;">${t("reports.delivered")}</th>
              <th style="border:1px solid #e7dfcb;padding:6px;background:#faf7ef;">${t("reports.cancelled")}</th>
              <th style="border:1px solid #e7dfcb;padding:6px;background:#faf7ef;">${t("reports.totalBonus")}</th>
            </tr>
          </thead>
          <tbody>
            ${report.byBranch
              .map(
                (b) => `<tr>
              <td style="border:1px solid #e7dfcb;padding:6px;">${b.branchName}</td>
              <td style="border:1px solid #e7dfcb;padding:6px;">${b.jobs}</td>
              <td style="border:1px solid #e7dfcb;padding:6px;">${b.delivered}</td>
              <td style="border:1px solid #e7dfcb;padding:6px;">${b.cancelled}</td>
              <td style="border:1px solid #e7dfcb;padding:6px;">${b.bonus.toFixed(2)}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <h3 style="font-size:15px;margin:12px 0 8px;">${t("reports.recentJobs")}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr>
              <th style="border:1px solid #e7dfcb;padding:5px;background:#faf7ef;">${t("reports.colPlate")}</th>
              <th style="border:1px solid #e7dfcb;padding:5px;background:#faf7ef;">${t("reports.colBranch")}</th>
              <th style="border:1px solid #e7dfcb;padding:5px;background:#faf7ef;">${t("reports.colStatus")}</th>
              <th style="border:1px solid #e7dfcb;padding:5px;background:#faf7ef;">${t("reports.colDate")}</th>
            </tr>
          </thead>
          <tbody>
            ${report.recentJobs
              .slice(0, 40)
              .map(
                (j) => `<tr>
              <td style="border:1px solid #e7dfcb;padding:5px;">${j.plateNumber}</td>
              <td style="border:1px solid #e7dfcb;padding:5px;">${j.branch.name}</td>
              <td style="border:1px solid #e7dfcb;padding:5px;">${j.status}</td>
              <td style="border:1px solid #e7dfcb;padding:5px;">${new Date(j.createdAt).toLocaleString(locale)}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      `;
      document.body.appendChild(el);
      await html2pdf()
        .set({
          margin: 10,
          filename: `ejaz-report-${from}-${to}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(el)
        .save();
      document.body.removeChild(el);
    } finally {
      setExporting(null);
    }
  }

  const k = data?.kpis;
  const busy = exporting !== null;

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
          <button className="btn" onClick={load} disabled={loading || busy}>
            {loading ? t("common.loading") : t("reports.refresh")}
          </button>
          <button className="btn secondary" onClick={() => downloadFile("xlsx")} disabled={busy}>
            {exporting === "xlsx" ? t("common.loading") : t("reports.exportExcel")}
          </button>
          <button className="btn secondary" onClick={exportPdf} disabled={busy}>
            {exporting === "pdf" ? t("common.loading") : t("reports.exportPdf")}
          </button>
          <button className="btn secondary" onClick={() => downloadFile("csv")} disabled={busy}>
            {exporting === "csv" ? t("common.loading") : t("reports.exportCsv")}
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
          {k.occupancyPct != null && (
            <div className="kpi-card">
              <div className="value">{k.occupancyPct}%</div>
              <div className="label">{t("reports.occupancyPct")}</div>
            </div>
          )}
          {k.avgCycleMinutes != null && (
            <div className="kpi-card">
              <div className="value">{k.avgCycleMinutes}</div>
              <div className="label">{t("reports.avgCycleMinutes")}</div>
            </div>
          )}
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
