import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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

const STATUS_LABEL: Record<string, string> = { open: "مفتوح", closed: "مغلق", maintenance: "صيانة" };

export default function Overview() {
  const { token } = useAuth();
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

  return (
    <div>
      <div className="page-title">رقابة 360 درجة</div>

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="value">{kpis.upsellAcceptanceRatePct}%</div>
            <div className="label">نسبة قبول البيع الإضافي (الهدف &gt;40%)</div>
          </div>
          <div className="kpi-card">
            <div className="value">{kpis.towelLossRatePct}%</div>
            <div className="label">مؤشر هدر المناشف (الهدف &lt;5%)</div>
          </div>
          <div className="kpi-card">
            <div className="value">{kpis.touchUpCorrectionRatePct}%</div>
            <div className="label">مؤشر التصحيح بالمنشفة (إهمال التنشيف)</div>
          </div>
          <div className="kpi-card">
            <div className="value">{kpis.estimatedSatisfactionScore}/5</div>
            <div className="label">رضا العملاء التقديري</div>
          </div>
          <div className="kpi-card">
            <div className="value">{kpis.pendingIncidents}</div>
            <div className="label">قرارات معلقة بانتظار الاعتماد</div>
          </div>
          <div className="kpi-card">
            <div className="value" style={{ color: kpis.overdueMaintenanceSchedules > 0 ? "var(--danger)" : "inherit" }}>
              {kpis.overdueMaintenanceSchedules}
            </div>
            <div className="label">معدات متأخرة عن الصيانة الوقائية</div>
          </div>
        </div>
      )}

      <div className="section-title">بطاقات الفروع الحية</div>
      {loading && <div className="empty-state">...جاري التحميل</div>}
      <div className="branch-grid">
        {branches.map((b) => (
          <div className="branch-card" key={b.id}>
            <div className="head">
              <div style={{ fontWeight: 800 }}>
                <span className={`status-dot status-${b.status}`} />
                {b.name}
              </div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>{STATUS_LABEL[b.status] ?? b.status}</span>
            </div>
            <div className="metric-row">
              <span>سيارات نشطة الآن</span>
              <strong>{b.activeJobs}</strong>
            </div>
            <div className="metric-row">
              <span>مناشف مفقودة (آخر وردية)</span>
              <strong>{b.towelsLostLastShift ?? "—"}</strong>
            </div>
            <div className="metric-row" style={{ border: "none" }}>
              <span>حالة جولة النظافة</span>
              <strong style={{ color: b.cleanlinessOverdue ? "var(--danger)" : "var(--success)" }}>
                {b.cleanlinessOverdue ? "متأخرة" : "ملتزمة"}
              </strong>
            </div>
            {(b.pendingIncidents > 0 || b.unresolvedFuriousFeedback > 0) && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {b.pendingIncidents > 0 && <span className="alert-badge">{b.pendingIncidents} قرار معلق</span>}
                {b.unresolvedFuriousFeedback > 0 && (
                  <span className="alert-badge">{b.unresolvedFuriousFeedback} عميل غاضب</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
