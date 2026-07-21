import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface SearchPayload {
  query: string;
  jobs: Array<{
    id: number;
    plateNumber: string;
    customerPhone: string | null;
    status: string;
    isHighlyDirty: boolean;
    posInvoiceNo: string | null;
    createdAt: string;
    branch: { name: string };
    bay: { bayName: string } | null;
  }>;
  employees: Array<{ id: number; name: string; role: string; branch: { name: string } }>;
  branches: Array<{ id: number; name: string; status: string }>;
  equipment: Array<{
    id: number;
    name: string;
    bay: { bayName: string; branch: { name: string } };
  }>;
  incidents: Array<{
    id: number;
    type: string;
    status: string;
    description: string;
    createdAt: string;
    branch: { name: string };
    bay: { bayName: string } | null;
    equipment: { name: string } | null;
  }>;
}

interface CenterPayload {
  identity: {
    plate: string | null;
    plates: string[];
    phones: string[];
    carTypes: string[];
    phone: string | null;
  };
  summary: {
    visitCount: number;
    dirtyCount: number;
    furiousCount: number;
    upsellAccepted: number;
    upsellBonus: number;
    latestStatus: string;
    latestBranch: string;
    latestBay: string | null;
    latestAt: string;
    activeJob: { id: number; status: string; branch: string; bay: string | null } | null;
  } | null;
  jobs: Array<{
    id: number;
    plateNumber: string;
    customerPhone: string | null;
    status: string;
    isHighlyDirty: boolean;
    posInvoiceNo: string | null;
    createdAt: string;
    deliveredAt: string | null;
    branch: { name: string };
    bay: { bayName: string } | null;
    upsells: Array<{ status: string; bonusAmount: number; service: string; employee: string | null }>;
    feedback: Array<{ isCustomerFurious: boolean; voiceRecUrl: string | null }>;
  }>;
  dirtyCarLog: Array<{
    jobId: number;
    plateNumber: string;
    branch: string;
    bay: string | null;
    createdAt: string;
    status: string;
    scratchesNotes: string | null;
  }>;
  timeline: Array<{ at: string; kind: string; jobId: number; title: string; detail?: string | null }>;
}

export default function SearchCenter() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState<SearchPayload | null>(null);
  const [center, setCenter] = useState<CenterPayload | null>(null);
  const [centerLoading, setCenterLoading] = useState(false);

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setCenter(null);
    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`, token);
      setSearch(data);
    } finally {
      setLoading(false);
    }
  }

  async function openCenter(opts: { plate?: string; phone?: string }) {
    setCenterLoading(true);
    try {
      const qs = new URLSearchParams();
      if (opts.plate) qs.set("plate", opts.plate);
      if (opts.phone) qs.set("phone", opts.phone);
      const data = await apiFetch(`/api/customers/center?${qs}`, token);
      setCenter(data);
    } finally {
      setCenterLoading(false);
    }
  }

  return (
    <div>
      <div className="page-title">{t("search.title")}</div>
      <div className="section-card">
        <form className="form-row" onSubmit={runSearch}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder")}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? t("common.loading") : t("search.submit")}
          </button>
        </form>
        <div className="muted" style={{ marginTop: 8 }}>
          {t("search.hint")}
        </div>
      </div>

      {search && (
        <>
          <div className="section-card">
            <div className="section-title">{t("search.jobsTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("search.colPlate")}</th>
                  <th>{t("search.colPhone")}</th>
                  <th>{t("search.colBranch")}</th>
                  <th>{t("search.colStatus")}</th>
                  <th>{t("search.colDate")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {search.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      {j.plateNumber}
                      {j.isHighlyDirty ? ` · ${t("search.dirty")}` : ""}
                    </td>
                    <td>{j.customerPhone ?? "—"}</td>
                    <td>{j.branch.name}</td>
                    <td>{j.status}</td>
                    <td>{new Date(j.createdAt).toLocaleString(locale)}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => openCenter({ plate: j.plateNumber })}>
                        {t("search.openFile")}
                      </button>
                    </td>
                  </tr>
                ))}
                {!search.jobs.length && (
                  <tr>
                    <td colSpan={6}>{t("search.empty")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="kpi-grid">
            <div className="section-card">
              <div className="section-title">{t("search.employeesTitle")}</div>
              <ul>
                {search.employees.map((e) => (
                  <li key={e.id}>
                    {e.name} — {e.role} · {e.branch.name}
                  </li>
                ))}
                {!search.employees.length && <li>{t("search.empty")}</li>}
              </ul>
            </div>
            <div className="section-card">
              <div className="section-title">{t("search.branchesTitle")}</div>
              <ul>
                {search.branches.map((b) => (
                  <li key={b.id}>
                    {b.name} ({b.status})
                  </li>
                ))}
                {!search.branches.length && <li>{t("search.empty")}</li>}
              </ul>
            </div>
            <div className="section-card">
              <div className="section-title">{t("search.equipmentTitle")}</div>
              <ul>
                {search.equipment.map((eq) => (
                  <li key={eq.id}>
                    {eq.name} — {eq.bay.bayName} · {eq.bay.branch.name}
                  </li>
                ))}
                {!search.equipment.length && <li>{t("search.empty")}</li>}
              </ul>
            </div>
            <div className="section-card">
              <div className="section-title">{t("search.incidentsTitle")}</div>
              <ul>
                {search.incidents.map((inc) => (
                  <li key={inc.id}>
                    #{inc.id} {inc.branch.name}: {inc.description.slice(0, 80)}
                  </li>
                ))}
                {!search.incidents.length && <li>{t("search.empty")}</li>}
              </ul>
            </div>
          </div>
        </>
      )}

      {centerLoading && <div className="empty-state">{t("common.loading")}</div>}

      {center && (
        <>
          <div className="section-card">
            <div className="section-title">{t("search.centerTitle")}</div>
            {!center.summary ? (
              <div>{t("search.empty")}</div>
            ) : (
              <>
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="label">{t("search.colPlate")}</div>
                    <div className="value">{center.identity.plates.join(" · ") || "—"}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="label">{t("search.colPhone")}</div>
                    <div className="value">{center.identity.phones.join(" · ") || "—"}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="label">{t("search.visits")}</div>
                    <div className="value">{center.summary.visitCount}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="label">{t("search.dirtyCount")}</div>
                    <div className="value">{center.summary.dirtyCount}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="label">{t("search.furiousCount")}</div>
                    <div className="value">{center.summary.furiousCount}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="label">{t("search.upsellBonus")}</div>
                    <div className="value">
                      {center.summary.upsellBonus} {t("common.riyal")}
                    </div>
                  </div>
                </div>
                {center.summary.activeJob && (
                  <div style={{ marginTop: 12 }}>
                    {t("search.activeJob")}: #{center.summary.activeJob.id} — {center.summary.activeJob.status} ·{" "}
                    {center.summary.activeJob.branch}
                    {center.summary.activeJob.bay ? ` · ${center.summary.activeJob.bay}` : ""}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="section-card">
            <div className="section-title">{t("search.dirtyLogTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>{t("search.colDate")}</th>
                  <th>{t("search.colBranch")}</th>
                  <th>{t("search.colBay")}</th>
                  <th>{t("search.colNotes")}</th>
                </tr>
              </thead>
              <tbody>
                {center.dirtyCarLog.map((d) => (
                  <tr key={d.jobId}>
                    <td>{new Date(d.createdAt).toLocaleString(locale)}</td>
                    <td>{d.branch}</td>
                    <td>{d.bay ?? "—"}</td>
                    <td>{d.scratchesNotes ?? "—"}</td>
                  </tr>
                ))}
                {!center.dirtyCarLog.length && (
                  <tr>
                    <td colSpan={4}>{t("search.noDirty")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="section-card">
            <div className="section-title">{t("search.timelineTitle")}</div>
            <ul>
              {center.timeline.map((item, idx) => (
                <li key={`${item.jobId}-${item.kind}-${idx}`}>
                  <strong>{new Date(item.at).toLocaleString(locale)}</strong> — {item.title}
                  {item.detail ? ` · ${item.detail}` : ""}
                </li>
              ))}
              {!center.timeline.length && <li>{t("search.empty")}</li>}
            </ul>
          </div>

          <div className="section-card">
            <div className="section-title">{t("search.visitsTitle")}</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("search.colDate")}</th>
                  <th>{t("search.colBranch")}</th>
                  <th>{t("search.colStatus")}</th>
                  <th>{t("search.colInvoice")}</th>
                  <th>{t("search.dirty")}</th>
                </tr>
              </thead>
              <tbody>
                {center.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.id}</td>
                    <td>{new Date(j.createdAt).toLocaleString(locale)}</td>
                    <td>{j.branch.name}</td>
                    <td>{j.status}</td>
                    <td>{j.posInvoiceNo ?? "—"}</td>
                    <td>{j.isHighlyDirty ? t("common.active") : "—"}</td>
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
