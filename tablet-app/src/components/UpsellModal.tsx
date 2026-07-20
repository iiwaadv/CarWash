import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { enqueue, flushOutbox } from "../lib/sync";

interface Service {
  id: number;
  serviceName: string;
  basePrice: number;
}

const REASONS = [
  { id: "in_a_hurry", label: "مستعجل" },
  { id: "too_expensive", label: "السعر غالي" },
  { id: "old_car", label: "السيارة قديمة" },
  { id: "loyalty_program", label: "مشترك ولاء" },
];

export function jobRef(jobId: number | string) {
  return typeof jobId === "number" ? jobId : { __jobRef: jobId };
}

export default function UpsellModal({
  jobId,
  carType,
  onDone,
}: {
  jobId: number | string;
  carType?: string;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [step, setStep] = useState<"suggest" | "accept" | "reject">("suggest");
  const [invoiceNo, setInvoiceNo] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch(`/api/services/suggest?carType=${carType ?? ""}`, token)
      .then(setService)
      .catch(() => setService(null));
  }, [token, carType]);

  async function accept() {
    if (!service) return onDone();
    await enqueue({
      kind: "upsell-accept",
      url: "/api/upselling/accept",
      method: "POST",
      fields: { jobId: jobRef(jobId), serviceId: service.id, extraInvoiceNo: invoiceNo },
    });
    if (navigator.onLine) void flushOutbox(token);
    onDone();
  }

  async function reject(reason: string) {
    if (!service) return onDone();
    await enqueue({
      kind: "upsell-reject",
      url: "/api/upselling/reject",
      method: "POST",
      fields: { jobId: jobRef(jobId), serviceId: service.id, rejectionReason: reason },
    });
    if (navigator.onLine) void flushOutbox(token);
    onDone();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">🛍️ عرض خدمة إضافية</div>

        {!service && <div style={{ color: "var(--muted)" }}>لا توجد خدمة مقترحة حالياً لهذا النوع</div>}

        {service && step === "suggest" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{service.serviceName}</div>
            <div style={{ color: "var(--muted)", marginBottom: 20 }}>{service.basePrice.toFixed(2)} ر.س</div>
            <div className="modal-actions">
              <button className="big-btn danger" onClick={() => setStep("reject")}>
                تم الرفض
              </button>
              <button className="big-btn success" onClick={() => setStep("accept")}>
                تم القبول
              </button>
            </div>
          </>
        )}

        {service && step === "accept" && (
          <>
            <label className="field-label">رقم الفاتورة الإضافية</label>
            <input
              className="text-input"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="INV-XXXX"
              autoFocus
            />
            <div className="modal-actions">
              <button className="big-btn secondary" onClick={() => setStep("suggest")}>
                رجوع
              </button>
              <button className="big-btn success" onClick={accept} disabled={!invoiceNo.trim()}>
                تأكيد وتفعيل البونص
              </button>
            </div>
          </>
        )}

        {service && step === "reject" && (
          <>
            <div className="field-label">سبب الرفض</div>
            <div className="chip-row">
              {REASONS.map((r) => (
                <button key={r.id} className="chip-btn" style={{ flex: 1 }} onClick={() => reject(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button className="big-btn secondary" onClick={() => setStep("suggest")} style={{ marginTop: 8 }}>
              رجوع
            </button>
          </>
        )}

        {!service && (
          <button className="big-btn secondary" onClick={onDone}>
            تجاوز
          </button>
        )}
      </div>
    </div>
  );
}
