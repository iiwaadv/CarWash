import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import CircularProgress from "../components/CircularProgress";
import MiniBarChart from "../components/MiniBarChart";

interface BranchCard {
  id: number;
  name: string;
  status: string;
  activeJobs: number;
  pendingIncidents: number;
  unresolvedFuriousFeedback: number;
  towelsLostLastShift: number | null;
  cleanlinessOverdue: boolean;
}

interface Kpis {
  towelLossRatePct: number;
  touchUpCorrectionRatePct: number;
  upsellAcceptanceRatePct: number;
  estimatedSatisfactionScore: number;
  pendingIncidents: number;
  shiftReportsCompleted: number;
  overdueMaintenanceSchedules: number;
}

interface DailyTotals {
  receivedToday: number;
  deliveredToday: number;
  cancelledToday: number;
  queued: number;
  washing: number;
  ready: number;
  activeInside: number;
  upsellAccepted: number;
  upsellRevenue: number;
  upsellBonus: number;
  incidentsToday: number;
  dirtyCarReports: number;
  feedbackToday: number;
  openingsToday: number;
  closuresToday: number;
  activeEmployees: number;
  lowStockCount: number;
}

interface DailyBranch {
  branchId: number;
  branchName: string;
  queued: number;
  washing: number;
  ready: number;
  activeInside: number;
  receivedToday: number;
  deliveredToday: number;
}

interface DailyPayload {
  timezone: string;
  dayLabel: string;
  totals: DailyTotals;
  byBranch: DailyBranch[];
  lowStock: Array<{ item: string; unit: string; branch: string; quantity: number }>;
}

export default function Overview() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<BranchCard[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [daily, setDaily] = useState<DailyPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [b, k, d] = await Promise.all([
      apiFetch("/api/branches/live", token),
      apiFetch("/api/dashboard/kpis", token),
      apiFetch("/api/dashboard/daily", token),
    ]);
    setBranches(b);
    setKpis(k);
    setDaily(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const alerts = useMemo(() => {
    const list: { key: string; text: string; tone: "bad" | "warning" }[] = [];
    if (kpis && kpis.pendingIncidents > 0) {
      list.push({ key: "incidents", text: `${kpis.pendingIncidents} — ${t("overview.pendingIncidents")}`, tone: "warning" });
    }
    if (kpis && kpis.overdueMaintenanceSchedules > 0) {
      list.push({ key: "maintenance", text: `${kpis.overdueMaintenanceSchedules} — ${t("overview.overdueMaintenance")}`, tone: "bad" });
    }
    if (daily && daily.totals.lowStockCount > 0) {
      list.push({ key: "stock", text: `${daily.totals.lowStockCount} — ${t("overview.lowStockAlert")}`, tone: "warning" });
    }
    branches.forEach((b) => {
      if (b.unresolvedFuriousFeedback > 0) {
        list.push({ key: `furious-${b.id}`, text: `${b.name}: ${b.unresolvedFuriousFeedback} ${t("overview.furiousCustomer")}`, tone: "bad" });
      }
      if (b.cleanlinessOverdue) {
        list.push({ key: `clean-${b.id}`, text: `${b.name}: ${t("overview.cleanlinessStatus")} — ${t("overview.overdue")}`, tone: "warning" });
      }
    });
    return list;
  }, [kpis, branches, daily, t]);

  const barData = useMemo(
    () => (daily?.byBranch ?? []).map((b) => ({ label: b.branchName, value: b.activeInside })),
    [daily]
  );

  const tot = daily?.totals;

  return (
    <div className="overview-page">
      <div className="page-title">{t("overview.title")}</div>
      {daily && (
        <div style={{ color: "var(--muted)", marginBottom: 12, fontSize: 13 }}>
          {t("overview.riyadhDay", { day: daily.dayLabel })} · {daily.timezone}
        </div>
      )}

      <div className={`alerts-banner ${alerts.length === 0 ? "calm" : ""}`}>
        <div className="alerts-banner-title">{alerts.length === 0 ? t("overview.noAlerts") : t("overview.alertsTitle")}</div>
        {alerts.length > 0 && (
          <div className="alerts-banner-list">
            {alerts.map((a) => (
              <span key={a.key} className={`alert-chip alert-chip-${a.tone}`}>
                {a.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {tot && (
        <div className="section-card compact">
          <div className="section-title">{t("overview.dailyTitle")}</div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="value">{tot.receivedToday}</div>
              <div className="label">{t("overview.receivedToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.deliveredToday}</div>
              <div className="label">{t("overview.deliveredToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.activeInside}</div>
              <div className="label">{t("overview.insideNow")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.queued}</div>
              <div className="label">{t("overview.queuedNow")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.washing}</div>
              <div className="label">{t("overview.washingNow")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.ready}</div>
              <div className="label">{t("overview.readyNow")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.upsellAccepted}</div>
              <div className="label">{t("overview.upsellsToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.upsellRevenue.toFixed(0)}</div>
              <div className="label">{t("overview.revenueToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.incidentsToday}</div>
              <div className="label">{t("overview.incidentsToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.dirtyCarReports}</div>
              <div className="label">{t("overview.dirtyCarsToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.feedbackToday}</div>
              <div className="label">{t("overview.feedbackToday")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{tot.activeEmployees}</div>
              <div className="label">{t("overview.activeStaff")}</div>
            </div>
          </div>
        </div>
      )}

      {kpis && (
        <div className="circular-kpi-grid">
          <CircularProgress
            value={kpis.upsellAcceptanceRatePct}
            label={t("overview.upsellRate")}
            tone={kpis.upsellAcceptanceRatePct >= 40 ? "good" : "warning"}
          />
          <CircularProgress
            value={kpis.towelLossRatePct}
            label={t("overview.towelLossRate")}
            tone={kpis.towelLossRatePct <= 5 ? "good" : "bad"}
          />
          <CircularProgress
            value={kpis.touchUpCorrectionRatePct}
            label={t("overview.touchUpRate")}
            tone={kpis.touchUpCorrectionRatePct <= 10 ? "good" : "warning"}
          />
          <CircularProgress
            value={(kpis.estimatedSatisfactionScore / 5) * 100}
            displayValue={`${kpis.estimatedSatisfactionScore}/5`}
            label={t("overview.satisfaction")}
            tone={kpis.estimatedSatisfactionScore >= 4 ? "good" : kpis.estimatedSatisfactionScore >= 3 ? "warning" : "bad"}
          />
          <div className="stat-card">
            <div className="stat-icon">📥</div>
            <div>
              <div className={`stat-value ${kpis.pendingIncidents > 0 ? "warn" : ""}`}>{kpis.pendingIncidents}</div>
              <div className="stat-label">{t("overview.pendingIncidents")}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛠️</div>
            <div>
              <div className={`stat-value ${kpis.overdueMaintenanceSchedules > 0 ? "danger" : ""}`}>
                {kpis.overdueMaintenanceSchedules}
              </div>
              <div className="stat-label">{t("overview.overdueMaintenance")}</div>
            </div>
          </div>
        </div>
      )}

      {barData.length > 0 && (
        <div className="section-card compact">
          <div className="section-title">{t("overview.trendTitle")}</div>
          <MiniBarChart items={barData} />
        </div>
      )}

      {daily && daily.byBranch.length > 0 && (
        <div className="section-card">
          <div className="section-title">{t("overview.todayByBranch")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("overview.colBranch")}</th>
                <th>{t("overview.receivedToday")}</th>
                <th>{t("overview.deliveredToday")}</th>
                <th>{t("overview.queuedNow")}</th>
                <th>{t("overview.washingNow")}</th>
                <th>{t("overview.readyNow")}</th>
                <th>{t("overview.insideNow")}</th>
              </tr>
            </thead>
            <tbody>
              {daily.byBranch.map((b) => (
                <tr key={b.branchId}>
                  <td style={{ fontWeight: 700 }}>{b.branchName}</td>
                  <td>{b.receivedToday}</td>
                  <td>{b.deliveredToday}</td>
                  <td>{b.queued}</td>
                  <td>{b.washing}</td>
                  <td>{b.ready}</td>
                  <td>{b.activeInside}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">{t("overview.liveBranches")}</div>
      {loading && <div className="empty-state">{t("common.loading")}</div>}
      <div className="branch-grid">
        {branches.map((b) => (
          <div className="branch-card" key={b.id}>
            <div className="head">
              <div style={{ fontWeight: 800 }}>
                <span className={`status-dot status-${b.status}`} />
                {b.name}
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>{t(`overview.status.${b.status}`, b.status)}</span>
            </div>
            <div className="metric-row">
              <span>{t("overview.activeJobsNow")}</span>
              <strong>{b.activeJobs}</strong>
            </div>
            <div className="metric-row">
              <span>{t("overview.towelsLost")}</span>
              <strong>{b.towelsLostLastShift ?? "—"}</strong>
            </div>
            <div className="metric-row" style={{ border: "none" }}>
              <span>{t("overview.cleanlinessStatus")}</span>
              <strong style={{ color: b.cleanlinessOverdue ? "var(--danger)" : "var(--success)" }}>
                {b.cleanlinessOverdue ? t("overview.overdue") : t("overview.onTrack")}
              </strong>
            </div>
            {(b.pendingIncidents > 0 || b.unresolvedFuriousFeedback > 0) && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {b.pendingIncidents > 0 && (
                  <span className="alert-badge">
                    {b.pendingIncidents} {t("overview.pendingDecision")}
                  </span>
                )}
                {b.unresolvedFuriousFeedback > 0 && (
                  <span className="alert-badge">
                    {b.unresolvedFuriousFeedback} {t("overview.furiousCustomer")}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
