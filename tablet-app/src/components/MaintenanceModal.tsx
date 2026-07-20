import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { enqueue, flushOutbox } from "../lib/sync";
import PhotoCaptureGrid from "./PhotoCaptureGrid";

export default function MaintenanceModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [type, setType] = useState("equipment_breakdown");
  const [severity, setSeverity] = useState("partial_slow");
  const [description, setDescription] = useState("");
  const [compensationPaid, setCompensationPaid] = useState("");
  const [proposedDeduction, setProposedDeduction] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const TYPES = [
    { id: "equipment_breakdown", label: t("maintenance.types.equipment_breakdown") },
    { id: "customer_car_damage", label: t("maintenance.types.customer_car_damage") },
  ];
  const SEVERITIES = [
    { id: "critical_stop", label: t("maintenance.severities.critical_stop") },
    { id: "partial_slow", label: t("maintenance.severities.partial_slow") },
  ];

  async function submit() {
    setSubmitting(true);
    try {
      await enqueue({
        kind: "maintenance",
        url: "/api/maintenance",
        method: "POST",
        fields: {
          type,
          severity: type === "equipment_breakdown" ? severity : undefined,
          description,
          compensationPaid: type === "customer_car_damage" ? compensationPaid || "0" : "0",
          proposedDeduction: type === "customer_car_damage" ? proposedDeduction || "0" : "0",
        },
        fileFields: { photos: photos.map((p, i) => ({ blob: p, filename: `incident-${i}.jpg` })) },
      });
      if (navigator.onLine) void flushOutbox(token);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="modal-overlay">
        <div className="modal-card center-col">
          <div style={{ fontSize: 44 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t("maintenance.doneTitle")}</div>
          <div style={{ color: "var(--muted)" }}>
            {type === "customer_car_damage" ? t("maintenance.doneDamage") : t("maintenance.doneEquipment")}
          </div>
          <button className="big-btn success" style={{ width: "100%" }} onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t("maintenance.title")}</div>

        <div className="field-label">{t("maintenance.typeLabel")}</div>
        <div className="chip-row">
          {TYPES.map((tp) => (
            <button key={tp.id} className={`chip-btn ${type === tp.id ? "active" : ""}`} onClick={() => setType(tp.id)}>
              {tp.label}
            </button>
          ))}
        </div>

        {type === "equipment_breakdown" && (
          <>
            <div className="field-label">{t("maintenance.severityLabel")}</div>
            <div className="chip-row">
              {SEVERITIES.map((s) => (
                <button key={s.id} className={`chip-btn ${severity === s.id ? "active" : ""}`} onClick={() => setSeverity(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        {type === "customer_car_damage" && (
          <>
            <label className="field-label">{t("maintenance.compensationLabel")}</label>
            <input className="text-input" inputMode="decimal" value={compensationPaid} onChange={(e) => setCompensationPaid(e.target.value)} />
            <label className="field-label">{t("maintenance.deductionLabel")}</label>
            <input className="text-input" inputMode="decimal" value={proposedDeduction} onChange={(e) => setProposedDeduction(e.target.value)} />
          </>
        )}

        <label className="field-label">{t("maintenance.descriptionLabel")}</label>
        <input className="text-input" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="field-label">{t("maintenance.photosLabel")}</label>
        <PhotoCaptureGrid count={2} label={t("maintenance.photosCaptureLabel")} onChange={setPhotos} />

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="big-btn danger" disabled={!description.trim() || submitting} onClick={submit}>
            {submitting ? t("common.uploading") : t("maintenance.submitBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
