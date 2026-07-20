import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, API_BASE } from "../lib/api";

interface Incident {
  id: number;
  type: string;
  description: string;
  severity: string | null;
  compensationPaid: number;
  proposedDeduction: number;
  repairCost: number;
  status: string;
  photosJson: string | null;
  branch: { name: string };
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  equipment_breakdown: "عطل معدات",
  customer_car_damage: "تلف سيارة عميل",
};

export default function PendingDecisions() {
  const { token } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const data = await apiFetch("/api/dashboard/pending-decisions", token);
    setIncidents(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function decide(id: number, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await apiFetch(`/api/maintenance/${id}/${action}`, token, { method: "POST" });
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-title">📥 صندوق القرارات المعلقة</div>
      <div className="section-card">
        {incidents.length === 0 && <div className="empty-state">لا توجد قرارات معلقة حالياً 🎉</div>}
        {incidents.map((inc) => {
          const photos: string[] = inc.photosJson ? JSON.parse(inc.photosJson) : [];
          return (
            <div className="decision-item" key={inc.id}>
              <div className="desc">
                <div style={{ fontWeight: 700 }}>
                  {TYPE_LABEL[inc.type] ?? inc.type} — {inc.branch.name}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0" }}>{inc.description}</div>
                <div className="amounts">
                  {inc.compensationPaid > 0 && <span>تعويض مدفوع: {inc.compensationPaid} ر.س</span>}
                  {inc.proposedDeduction > 0 && <span>مقترح خصم: {inc.proposedDeduction} ر.س</span>}
                  {inc.repairCost > 0 && <span>تكلفة إصلاح: {inc.repairCost} ر.س</span>}
                  <span>{new Date(inc.createdAt).toLocaleString("ar-SA")}</span>
                </div>
                {photos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {photos.map((p, i) => (
                      <img key={i} src={`${API_BASE}${p}`} alt="incident" style={{ width: 60, height: 45, objectFit: "cover", borderRadius: 6 }} />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn danger" disabled={busyId === inc.id} onClick={() => decide(inc.id, "reject")}>
                  رفض
                </button>
                <button className="btn success" disabled={busyId === inc.id} onClick={() => decide(inc.id, "approve")}>
                  اعتماد
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
