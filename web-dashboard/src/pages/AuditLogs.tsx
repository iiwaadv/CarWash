import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface AuditLogRow {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AuditLogs() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (entityType) qs.set("entityType", entityType);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const data = await apiFetch(`/api/audit-logs?${qs}`, token);
      setLogs(data);
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
      <div className="page-title">{t("audit.title")}</div>

      <div className="section-card">
        <div className="form-row">
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">{t("audit.allTypes")}</option>
            <option value="maintenance">{t("audit.typeMaintenance")}</option>
            <option value="employee">{t("audit.typeEmployee")}</option>
            <option value="sales_target">{t("audit.typeSalesTarget")}</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? t("common.loading") : t("audit.refresh")}
          </button>
        </div>
      </div>

      <div className="section-card">
        <div className="section-title">{t("audit.listTitle")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("audit.colDate")}</th>
              <th>{t("audit.colActor")}</th>
              <th>{t("audit.colAction")}</th>
              <th>{t("audit.colEntityType")}</th>
              <th>{t("audit.colEntityId")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString(locale)}</td>
                <td>{log.actorName ?? "—"}</td>
                <td>{log.action}</td>
                <td>{log.entityType}</td>
                <td>{log.entityId ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {t("audit.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
