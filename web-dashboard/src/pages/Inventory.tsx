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

interface BonusDetail {
  upsellId: number;
  employeeId: number | null;
  employeeName: string;
  branchId: number;
  branchName: string;
  plateNumber: string;
  serviceName: string;
  bonusAmount: number;
  extraInvoiceNo: string | null;
  createdAt: string;
}

interface RejectionDetail {
  upsellId: number;
  employeeId: number | null;
  employeeName: string;
  branchId: number;
  branchName: string;
  plateNumber: string;
  serviceName: string;
  rejectionReason: string;
  createdAt: string;
}

interface BranchBreakdown {
  branchId: number;
  branchName: string;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  totalBonusPaid: number;
}

interface UpsellAnalytics {
  total: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  rejectionBreakdown: Record<string, number>;
  totalBonusPaid: number;
  bonusDetails: BonusDetail[];
  rejectionDetails: RejectionDetail[];
  byBranch: BranchBreakdown[];
}

export default function Inventory() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [towels, setTowels] = useState<TowelRow[]>([]);
  const [upsell, setUpsell] = useState<UpsellAnalytics | null>(null);
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

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

      {upsell && upsell.byBranch.length > 0 && (
        <div className="section-card">
          <div className="section-title">{t("inventory.byBranchTitle")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("inventory.colBranch")}</th>
                <th>{t("inventory.colAccepted")}</th>
                <th>{t("inventory.colRejected")}</th>
                <th>{t("inventory.colRate")}</th>
                <th>{t("inventory.colBonus")}</th>
              </tr>
            </thead>
            <tbody>
              {upsell.byBranch.map((b) => (
                <tr key={b.branchId}>
                  <td style={{ fontWeight: 700 }}>{b.branchName}</td>
                  <td>{b.accepted}</td>
                  <td>{b.rejected}</td>
                  <td>{b.acceptanceRate}%</td>
                  <td>{b.totalBonusPaid.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {upsell && (
        <div className="section-card">
          <div className="section-title">{t("inventory.bonusDetailsTitle")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("inventory.colEmployee")}</th>
                <th>{t("inventory.colBranch")}</th>
                <th>{t("inventory.colService")}</th>
                <th>{t("inventory.colPlate")}</th>
                <th>{t("inventory.colInvoice")}</th>
                <th>{t("inventory.colBonus")}</th>
                <th>{t("inventory.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {upsell.bonusDetails.map((d) => (
                <tr key={d.upsellId}>
                  <td style={{ fontWeight: 700 }}>{d.employeeName}</td>
                  <td>{d.branchName}</td>
                  <td>{d.serviceName}</td>
                  <td>{d.plateNumber}</td>
                  <td>{d.extraInvoiceNo ?? "—"}</td>
                  <td style={{ color: "var(--success)", fontWeight: 700 }}>{d.bonusAmount.toFixed(2)}</td>
                  <td>{new Date(d.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
              {upsell.bonusDetails.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {t("inventory.emptyBonusDetails")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {upsell && (
        <div className="section-card">
          <div className="section-title">{t("inventory.rejectionDetailsTitle")}</div>
          <table>
            <thead>
              <tr>
                <th>{t("inventory.colEmployee")}</th>
                <th>{t("inventory.colBranch")}</th>
                <th>{t("inventory.colService")}</th>
                <th>{t("inventory.colPlate")}</th>
                <th>{t("inventory.colReasonDetail")}</th>
                <th>{t("inventory.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {upsell.rejectionDetails.map((d) => (
                <tr key={d.upsellId}>
                  <td style={{ fontWeight: 700 }}>{d.employeeName}</td>
                  <td>{d.branchName}</td>
                  <td>{d.serviceName}</td>
                  <td>{d.plateNumber}</td>
                  <td>{REASON_LABEL[d.rejectionReason] ?? d.rejectionReason}</td>
                  <td>{new Date(d.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
              {upsell.rejectionDetails.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {t("inventory.emptyRejectionDetails")}
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
