import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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
  branch: { name: string };
  supervisor: { name: string };
}

interface Closure {
  id: number;
  shiftDate: string;
  towelsReceivedStart: number;
  towelsCollectedEnd: number;
  upsellTargetPct: number | null;
  createdAt: string;
  branch: { name: string };
  supervisor: { name: string };
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
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
            </tr>
          </thead>
          <tbody>
            {openings.map((o) => (
              <tr key={o.id}>
                <td>{o.branch.name}</td>
                <td>{o.supervisor.name}</td>
                <td>{new Date(o.shiftDate).toLocaleString(locale)}</td>
                <td>{o.towelsReceived}</td>
              </tr>
            ))}
            {openings.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
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
              </tr>
            ))}
            {closures.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  {t("shifts.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
