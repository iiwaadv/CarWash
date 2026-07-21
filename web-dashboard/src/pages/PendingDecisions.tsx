import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, apiFetchJson, API_BASE } from "../lib/api";

interface Incident {
  id: number;
  type: string;
  description: string;
  severity: string | null;
  breakdownType: string | null;
  compensationPaid: number;
  proposedDeduction: number;
  repairCost: number;
  costPending: boolean;
  status: string;
  photosJson: string | null;
  branch: { name: string };
  bay: { id: number; bayName: string } | null;
  equipment: { id: number; name: string } | null;
  receivedBy?: { id: number; name: string } | null;
  createdAt: string;
}

interface CostReport {
  byBay: { bayId: number | null; bayName: string; totalCost: number; count: number }[];
  byEquipment: { equipmentId: number | null; equipmentName: string; totalCost: number; count: number }[];
  pendingCostCount: number;
  totalCost: number;
}

export default function PendingDecisions() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState<Incident[]>([]);
  const [active, setActive] = useState<Incident[]>([]);
  const [costPending, setCostPending] = useState<Incident[]>([]);
  const [costReport, setCostReport] = useState<CostReport | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [costDrafts, setCostDrafts] = useState<Record<number, string>>({});

  const TYPE_LABEL: Record<string, string> = {
    equipment_breakdown: t("decisions.typeEquipment"),
    customer_car_damage: t("decisions.typeCarDamage"),
  };

  const STATUS_LABEL: Record<string, string> = {
    approved: t("decisions.status.approved"),
    received: t("decisions.status.received"),
    in_progress: t("decisions.status.in_progress"),
    completed: t("decisions.status.completed"),
  };

  async function load() {
    const [pendingData, all, report] = await Promise.all([
      apiFetch("/api/dashboard/pending-decisions", token),
      apiFetch("/api/maintenance", token),
      apiFetch("/api/maintenance/cost-report", token).catch(() => null),
    ]);
    setPending(pendingData);
    setActive(
      all.filter((i: Incident) => ["approved", "received", "in_progress"].includes(i.status))
    );
    setCostPending(all.filter((i: Incident) => i.costPending === true || (i.status === "completed" && i.costPending)));
    setCostReport(report);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function decide(id: number, action: "approve" | "reject" | "amend" | "return") {
    let reason: string | undefined;
    if (action !== "approve") {
      const input = prompt(t("decisions.reasonPrompt"));
      if (input === null) return;
      if (!input.trim()) return;
      reason = input.trim();
    }
    setBusyId(id);
    try {
      if (action === "approve") {
        await apiFetch(`/api/maintenance/${id}/approve`, token, { method: "POST" });
      } else {
        await apiFetchJson(`/api/maintenance/${id}/${action}`, token, "POST", { reason });
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function advance(id: number, action: "receive" | "start-work" | "complete") {
    setBusyId(id);
    try {
      await apiFetchJson(`/api/maintenance/${id}/${action}`, token, "POST", {});
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveCost(id: number) {
    const raw = costDrafts[id];
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value < 0) return;
    setBusyId(id);
    try {
      await apiFetchJson(`/api/maintenance/${id}/cost`, token, "POST", { repairCost: value });
      setCostDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function metaLine(inc: Incident) {
    return (
      <div style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0" }}>
        {inc.bay ? `🅿️ ${inc.bay.bayName}` : t("decisions.generalBreakdown")}
        {inc.equipment ? ` · 🔧 ${inc.equipment.name}` : ""}
        {inc.breakdownType ? ` · ${inc.breakdownType}` : ""}
        {inc.receivedBy ? ` · 👷 ${inc.receivedBy.name}` : ""}
      </div>
    );
  }

  function renderCard(inc: Incident, actions: React.ReactNode) {
    const photos: string[] = inc.photosJson ? JSON.parse(inc.photosJson) : [];
    return (
      <div className="decision-item" key={inc.id}>
        <div className="desc">
          <div style={{ fontWeight: 700 }}>
            {TYPE_LABEL[inc.type] ?? inc.type} — {inc.branch.name}
            {STATUS_LABEL[inc.status] ? ` · ${STATUS_LABEL[inc.status]}` : ""}
          </div>
          {inc.type === "equipment_breakdown" && metaLine(inc)}
          <div style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0" }}>{inc.description}</div>
          <div className="amounts">
            {inc.compensationPaid > 0 && (
              <span>
                {t("decisions.compensationPaid")}: {inc.compensationPaid} {t("common.riyal")}
              </span>
            )}
            {inc.proposedDeduction > 0 && (
              <span>
                {t("decisions.proposedDeduction")}: {inc.proposedDeduction} {t("common.riyal")}
              </span>
            )}
            {inc.repairCost > 0 && (
              <span>
                {t("decisions.repairCost")}: {inc.repairCost} {t("common.riyal")}
              </span>
            )}
            <span>{new Date(inc.createdAt).toLocaleString(i18n.language === "ar" ? "ar-SA" : "en-US")}</span>
          </div>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {photos.map((p, i) => (
                <img key={i} src={`${API_BASE}${p}`} alt="incident" style={{ width: 60, height: 45, objectFit: "cover", borderRadius: 6 }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{actions}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">{t("decisions.title")}</div>

      <div className="section-card">
        <div className="section-title">{t("decisions.pendingSection")}</div>
        {pending.length === 0 && <div className="empty-state">{t("decisions.empty")}</div>}
        {pending.map((inc) =>
          renderCard(
            inc,
            <>
              <button className="btn danger" disabled={busyId === inc.id} onClick={() => decide(inc.id, "reject")}>
                {t("decisions.reject")}
              </button>
              <button className="btn secondary" disabled={busyId === inc.id} onClick={() => decide(inc.id, "amend")}>
                {t("decisions.amend")}
              </button>
              <button className="btn secondary" disabled={busyId === inc.id} onClick={() => decide(inc.id, "return")}>
                {t("decisions.returnReview")}
              </button>
              <button className="btn success" disabled={busyId === inc.id} onClick={() => decide(inc.id, "approve")}>
                {t("decisions.approve")}
              </button>
            </>
          )
        )}
      </div>

      <div className="section-card">
        <div className="section-title">{t("decisions.cycleSection")}</div>
        {active.length === 0 && <div className="empty-state">{t("decisions.emptyCycle")}</div>}
        {active.map((inc) =>
          renderCard(
            inc,
            <>
              {inc.status === "approved" && (
                <button className="btn" disabled={busyId === inc.id} onClick={() => advance(inc.id, "receive")}>
                  {t("decisions.receive")}
                </button>
              )}
              {inc.status === "received" && (
                <button className="btn" disabled={busyId === inc.id} onClick={() => advance(inc.id, "start-work")}>
                  {t("decisions.startWork")}
                </button>
              )}
              {inc.status === "in_progress" && (
                <button className="btn success" disabled={busyId === inc.id} onClick={() => advance(inc.id, "complete")}>
                  {t("decisions.complete")}
                </button>
              )}
            </>
          )
        )}
      </div>

      <div className="section-card">
        <div className="section-title">{t("decisions.costPendingSection")}</div>
        {costPending.length === 0 && <div className="empty-state">{t("decisions.emptyCostPending")}</div>}
        {costPending.map((inc) =>
          renderCard(
            inc,
            <>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={t("decisions.costPlaceholder")}
                value={costDrafts[inc.id] ?? ""}
                onChange={(e) => setCostDrafts((prev) => ({ ...prev, [inc.id]: e.target.value }))}
                style={{ width: 140, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button className="btn success" disabled={busyId === inc.id} onClick={() => saveCost(inc.id)}>
                {t("decisions.saveCost")}
              </button>
            </>
          )
        )}
      </div>

      {costReport && (
        <div className="section-card">
          <div className="section-title">{t("decisions.costReportTitle")}</div>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <div className="kpi-card">
              <div className="value">{costReport.totalCost.toFixed(2)}</div>
              <div className="label">{t("decisions.totalRepairCost")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{costReport.pendingCostCount}</div>
              <div className="label">{t("decisions.pendingCostCount")}</div>
            </div>
          </div>
          <div className="section-title" style={{ fontSize: 14 }}>
            {t("decisions.costByBay")}
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("decisions.colBay")}</th>
                <th>{t("decisions.colIncidents")}</th>
                <th>{t("decisions.colTotalCost")}</th>
              </tr>
            </thead>
            <tbody>
              {costReport.byBay.map((row) => (
                <tr key={row.bayId ?? "general"}>
                  <td>{row.bayName}</td>
                  <td>{row.count}</td>
                  <td style={{ fontWeight: 700 }}>{row.totalCost.toFixed(2)}</td>
                </tr>
              ))}
              {costReport.byBay.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    {t("decisions.emptyCostReport")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="section-title" style={{ fontSize: 14, marginTop: 16 }}>
            {t("decisions.costByEquipment")}
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("decisions.colEquipment")}</th>
                <th>{t("decisions.colIncidents")}</th>
                <th>{t("decisions.colTotalCost")}</th>
              </tr>
            </thead>
            <tbody>
              {costReport.byEquipment.map((row) => (
                <tr key={row.equipmentId ?? "none"}>
                  <td>{row.equipmentName}</td>
                  <td>{row.count}</td>
                  <td style={{ fontWeight: 700 }}>{row.totalCost.toFixed(2)}</td>
                </tr>
              ))}
              {costReport.byEquipment.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    {t("decisions.emptyCostReport")}
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
