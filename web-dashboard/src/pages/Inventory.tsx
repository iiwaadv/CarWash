import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface TowelRow {
  supervisorId: number;
  name: string;
  towelsLost: number;
  shifts: number;
}

interface UpsellAnalytics {
  total: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  rejectionBreakdown: Record<string, number>;
  totalBonusPaid: number;
}

export default function Inventory() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [towels, setTowels] = useState<TowelRow[]>([]);
  const [upsell, setUpsell] = useState<UpsellAnalytics | null>(null);

  const REASON_LABEL: Record<string, string> = {
    too_expensive: t("inventory.reasons.too_expensive"),
    in_a_hurry: t("inventory.reasons.in_a_hurry"),
    old_car: t("inventory.reasons.old_car"),
    loyalty_program: t("inventory.reasons.loyalty_program"),
  };

  useEffect(() => {
    apiFetch("/api/shift-inventory/missing-towels", token).then(setTowels);
    apiFetch("/api/upselling/analytics", token).then(setUpsell);
  }, [token]);

  return (
    <div>
      <div className="page-title">{t("inventory.title")}</div>

      <div className="section-card">
        <div className="section-title">{t("inventory.towelsBySupervisor")}</div>
        <table>
          <thead>
            <tr>
              <th>{t("inventory.colSupervisor")}</th>
              <th>{t("inventory.colShifts")}</th>
              <th>{t("inventory.colTotalLost")}</th>
            </tr>
          </thead>
          <tbody>
            {towels.map((t2) => (
              <tr key={t2.supervisorId}>
                <td>{t2.name}</td>
                <td>{t2.shifts}</td>
                <td style={{ color: t2.towelsLost > 10 ? "var(--danger)" : "inherit", fontWeight: 700 }}>
                  {t2.towelsLost}
                </td>
              </tr>
            ))}
            {towels.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  {t("inventory.emptyTowels")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {upsell && (
        <div className="section-card">
          <div className="section-title">{t("inventory.upsellAnalysis")}</div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="value">{upsell.acceptanceRate}%</div>
              <div className="label">{t("inventory.acceptanceRate")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{upsell.totalBonusPaid.toFixed(2)}</div>
              <div className="label">{t("inventory.totalBonus")}</div>
            </div>
            <div className="kpi-card">
              <div className="value">{upsell.total}</div>
              <div className="label">{t("inventory.totalAttempts")}</div>
            </div>
          </div>
          <div className="section-title" style={{ fontSize: 14 }}>
            {t("inventory.rejectionBreakdown")}
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("inventory.colReason")}</th>
                <th>{t("inventory.colCount")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(upsell.rejectionBreakdown).map(([reason, count]) => (
                <tr key={reason}>
                  <td>{REASON_LABEL[reason] ?? reason}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
