import { useEffect, useState } from "react";
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

const REASON_LABEL: Record<string, string> = {
  too_expensive: "السعر غالي",
  in_a_hurry: "مستعجل",
  old_car: "السيارة قديمة",
  loyalty_program: "مشترك ولاء",
};

export default function Inventory() {
  const { token } = useAuth();
  const [towels, setTowels] = useState<TowelRow[]>([]);
  const [upsell, setUpsell] = useState<UpsellAnalytics | null>(null);

  useEffect(() => {
    apiFetch("/api/shift-inventory/missing-towels", token).then(setTowels);
    apiFetch("/api/upselling/analytics", token).then(setUpsell);
  }, [token]);

  return (
    <div>
      <div className="page-title">📦 المخزون والبيع الإضافي</div>

      <div className="section-card">
        <div className="section-title">🧺 المناشف المفقودة لكل مشرف</div>
        <table>
          <thead>
            <tr>
              <th>المشرف</th>
              <th>عدد الورديات</th>
              <th>إجمالي المناشف المفقودة</th>
            </tr>
          </thead>
          <tbody>
            {towels.map((t) => (
              <tr key={t.supervisorId}>
                <td>{t.name}</td>
                <td>{t.shifts}</td>
                <td style={{ color: t.towelsLost > 10 ? "var(--danger)" : "inherit", fontWeight: 700 }}>
                  {t.towelsLost}
                </td>
              </tr>
            ))}
            {towels.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  لا توجد بيانات جرد بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {upsell && (
        <div className="section-card">
          <div className="section-title">🛍️ تحليل البيع الإضافي والرفض</div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="value">{upsell.acceptanceRate}%</div>
              <div className="label">نسبة القبول</div>
            </div>
            <div className="kpi-card">
              <div className="value">{upsell.totalBonusPaid.toFixed(2)}</div>
              <div className="label">إجمالي البونص المدفوع (ر.س)</div>
            </div>
            <div className="kpi-card">
              <div className="value">{upsell.total}</div>
              <div className="label">إجمالي محاولات البيع</div>
            </div>
          </div>
          <div className="section-title" style={{ fontSize: 14 }}>
            توزيع أسباب الرفض
          </div>
          <table>
            <thead>
              <tr>
                <th>السبب</th>
                <th>العدد</th>
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
