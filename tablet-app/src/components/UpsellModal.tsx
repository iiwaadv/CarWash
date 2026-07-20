import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { enqueue, flushOutbox } from "../lib/sync";

interface Service {
  id: number;
  serviceName: string;
  basePrice: number;
}

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
  const { t } = useTranslation();
  const [service, setService] = useState<Service | null>(null);
  const [step, setStep] = useState<"suggest" | "accept" | "reject">("suggest");
  const [invoiceNo, setInvoiceNo] = useState("");

  const REASONS = [
    { id: "in_a_hurry", label: t("upsell.reasons.in_a_hurry") },
    { id: "too_expensive", label: t("upsell.reasons.too_expensive") },
    { id: "old_car", label: t("upsell.reasons.old_car") },
    { id: "loyalty_program", label: t("upsell.reasons.loyalty_program") },
  ];

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
        <div className="modal-title">{t("upsell.title")}</div>

        {!service && <div style={{ color: "var(--muted)" }}>{t("upsell.noSuggestion")}</div>}

        {service && step === "suggest" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{service.serviceName}</div>
            <div style={{ color: "var(--muted)", marginBottom: 20 }}>{service.basePrice.toFixed(2)} {t("common.riyal")}</div>
            <div className="modal-actions">
              <button className="big-btn danger" onClick={() => setStep("reject")}>
                {t("upsell.rejected")}
              </button>
              <button className="big-btn success" onClick={() => setStep("accept")}>
                {t("upsell.accepted")}
              </button>
            </div>
          </>
        )}

        {service && step === "accept" && (
          <>
            <label className="field-label">{t("upsell.invoiceLabel")}</label>
            <input
              className="text-input"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="INV-XXXX"
              autoFocus
            />
            <div className="modal-actions">
              <button className="big-btn secondary" onClick={() => setStep("suggest")}>
                {t("common.back")}
              </button>
              <button className="big-btn success" onClick={accept} disabled={!invoiceNo.trim()}>
                {t("upsell.confirmBtn")}
              </button>
            </div>
          </>
        )}

        {service && step === "reject" && (
          <>
            <div className="field-label">{t("upsell.rejectReasonLabel")}</div>
            <div className="chip-row">
              {REASONS.map((r) => (
                <button key={r.id} className="chip-btn" style={{ flex: 1 }} onClick={() => reject(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button className="big-btn secondary" onClick={() => setStep("suggest")} style={{ marginTop: 8 }}>
              {t("common.back")}
            </button>
          </>
        )}

        {!service && (
          <button className="big-btn secondary" onClick={onDone}>
            {t("upsell.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
