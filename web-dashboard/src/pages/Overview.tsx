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

export default function Overview() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [branches, setBranches] = useState<BranchCard[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [b, k] = await Promise.all([
      apiFetch("/api/branches/live", token),
      apiFetch("/api/dashboard/kpis", token),
    ]);
    setBranches(b);
    setKpis(k);
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
    branches.forEach((b) => {
      if (b.unresolvedFuriousFeedback > 0) {
        list.push({ key: `furious-${b.id}`, text: `${b.name}: ${b.unresolvedFuriousFeedback} ${t("overview.furiousCustomer")}`, tone: "bad" });
      }
      if (b.cleanlinessOverdue) {
        list.push({ key: `clean-${b.id}`, text: `${b.name}: ${t("overview.cleanlinessStatus")} — ${t("overview.overdue")}`, tone: "warning" });
      }
    });
    return list;
  }, [kpis, branches, t]);

  const barData = useMemo(
    () => branches.map((b) => ({ label: b.name, value: b.activeJobs })),
    [branches]
  );

  return (
    <div className="overview-page">
      <div className="page-title">{t("overview.title")}</div>

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
