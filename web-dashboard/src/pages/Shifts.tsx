import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, API_BASE } from "../lib/api";

interface Branch {
  id: number;
  name: string;
}

interface Opening {
  id: number;
  shiftDate: string;
  towelsReceived: number;
  chemicalsJson: string | null;
  otherItemsJson: string | null;
  createdAt: string;
  branch: { id: number; name: string };
  supervisor: { name: string };
}

interface Closure {
  id: number;
  shiftDate: string;
  towelsReceivedStart: number;
  towelsCollectedEnd: number;
  upsellTargetPct: number | null;
  createdAt: string;
  branch: { id: number; name: string };
  supervisor: { name: string };
}

interface ShiftDetail {
  branchId: number;
  date: string;
  period: string;
  counts: {
    jobs: number;
    delivered: number;
    incidents: number;
    upsells: number;
    feedback: number;
    furious: number;
  };
  timeline: Array<{ at: string; kind: string; title: string; detail?: string | null }>;
  attachments: Array<{ kind: string; url: string; source: string }>;
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shiftDateOnly(shiftDate: string) {
  return shiftDate.slice(0, 10);
}

export default function Shifts() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/branches", token).then(setBranches);
  }, [token]);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (branchId) qs.set("branchId", branchId);
      const data = await apiFetch(`/api/shifts?${qs}`, token);
      setOpenings(data.openings ?? []);
      setClosures(data.closures ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function openDetail(bId: number, date: string) {
    setDetailLoading(true);
    try {
      const qs = new URLSearchParams({ branchId: String(bId), date });
      const data = await apiFetch(`/api/shifts/detail?${qs}`, token);
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      <div className="page-title">{t("shifts.title")}</div>
      <div className="section-card">
        <div className="form-row">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t("shifts.allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? t("common.loading") : t("shifts.refresh")}
          </button>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">{t("shifts.openingsTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("shifts.colBranch")}</th>
              <th>{t("shifts.colSupervisor")}</th>
              <th>{t("shifts.colDate")}</th>
              <th>{t("shifts.colTowels")}</th>
              <th>{t("shifts.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {openings.map((o) => (
              <tr key={o.id}>
                <td>{o.branch.name}</td>
                <td>{o.supervisor.name}</td>
                <td>{new Date(o.shiftDate).toLocaleString(locale)}</td>
                <td>{o.towelsReceived}</td>
                <td>
                  <button
                    className="btn secondary"
                    disabled={detailLoading}
                    onClick={() => openDetail(o.branch.id, shiftDateOnly(o.shiftDate))}
                  >
                    {t("shifts.viewDetail")}
                  </button>
                </td>
              </tr>
            ))}
            {openings.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {t("shifts.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section-card">
        <div className="section-title">{t("shifts.closuresTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("shifts.colBranch")}</th>
              <th>{t("shifts.colSupervisor")}</th>
              <th>{t("shifts.colDate")}</th>
              <th>{t("shifts.colTowelsStart")}</th>
              <th>{t("shifts.colTowelsEnd")}</th>
              <th>{t("shifts.colLost")}</th>
              <th>{t("shifts.colUpsellPct")}</th>
              <th>{t("shifts.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {closures.map((c) => (
              <tr key={c.id}>
                <td>{c.branch.name}</td>
                <td>{c.supervisor.name}</td>
                <td>{new Date(c.shiftDate).toLocaleString(locale)}</td>
                <td>{c.towelsReceivedStart}</td>
                <td>{c.towelsCollectedEnd}</td>
                <td style={{ fontWeight: 700, color: c.towelsReceivedStart - c.towelsCollectedEnd > 0 ? "var(--danger)" : "inherit" }}>
                  {c.towelsReceivedStart - c.towelsCollectedEnd}
                </td>
                <td>{c.upsellTargetPct != null ? `${c.upsellTargetPct}%` : "—"}</td>
                <td>
                  <button
                    className="btn secondary"
                    disabled={detailLoading}
                    onClick={() => openDetail(c.branch.id, shiftDateOnly(c.shiftDate))}
                  >
                    {t("shifts.viewDetail")}
                  </button>
                </td>
              </tr>
            ))}
            {closures.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  {t("shifts.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="section-card">
          <div className="section-title">
            {t("shifts.detailTitle")} — {detail.date}
            <button className="btn secondary" style={{ marginInlineStart: 12 }} onClick={() => setDetail(null)}>
              {t("common.close")}
            </button>
          </div>
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            <strong>{t("shifts.detailPeriod")}:</strong> {t(`shifts.period.${detail.period}`, detail.period)}
          </div>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <div className="kpi-card">
              <div className="value">{detail.counts.jobs}</div>
              <div className="label">{t("shifts.detailJobs")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.delivered}</div>
              <div className="label">{t("shifts.detailDelivered")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.incidents}</div>
              <div className="label">{t("shifts.detailIncidents")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.upsells}</div>
              <div className="label">{t("shifts.detailUpsells")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.feedback}</div>
              <div className="label">{t("shifts.detailFeedback")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{detail.counts.furious}</div>
              <div className="label">{t("shifts.detailFurious")}</div>
            </div>
          </div>

          {detail.attachments.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 14 }}>
                {t("shifts.detailAttachments")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {detail.attachments.map((att, i) => (
                  <a key={i} href={`${API_BASE}${att.url}`} target="_blank" rel="noreferrer" className="btn secondary">
                    {att.kind} ({att.source})
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="section-title" style={{ fontSize: 14 }}>
            {t("shifts.detailTimeline")}
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("shifts.colDate")}</th>
                <th>{t("shifts.detailKind")}</th>
                <th>{t("shifts.detailEvent")}</th>
                <th>{t("shifts.detailDetail")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.timeline.map((ev, i) => (
                <tr key={i}>
                  <td>{new Date(ev.at).toLocaleString(locale)}</td>
                  <td>{ev.kind}</td>
                  <td>{ev.title}</td>
                  <td>{ev.detail ?? "—"}</td>
                </tr>
              ))}
              {detail.timeline.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    {t("shifts.detailEmptyTimeline")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
