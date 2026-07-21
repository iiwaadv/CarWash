import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { enqueue, flushOutbox } from "../lib/sync";
import PhotoCaptureGrid from "./PhotoCaptureGrid";

interface Bay {
  id: number;
  bayName: string;
}

interface EquipmentOption {
  id: number;
  name: string;
}

export default function MaintenanceModal({ onClose }: { onClose: () => void }) {
  const { token, employee } = useAuth();
  const { t } = useTranslation();
  const [type, setType] = useState("equipment_breakdown");
  const [severity, setSeverity] = useState("partial_slow");
  const [scope, setScope] = useState<"bay" | "general">("bay");
  const [bays, setBays] = useState<Bay[]>([]);
  const [bayId, setBayId] = useState<string>("");
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [breakdownType, setBreakdownType] = useState("");
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

  useEffect(() => {
    if (!token || !employee?.branchId) return;
    apiFetch(`/api/bays?branchId=${employee.branchId}`, token).then(setBays).catch(() => {});
  }, [token, employee?.branchId]);

  useEffect(() => {
    if (!token || !bayId) {
      setEquipmentOptions([]);
      return;
    }
    apiFetch(`/api/bay-equipment?bayId=${bayId}`, token).then(setEquipmentOptions).catch(() => {});
  }, [token, bayId]);

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
          bayId: type === "equipment_breakdown" && scope === "bay" && bayId ? bayId : undefined,
          equipmentId: type === "equipment_breakdown" && scope === "bay" && equipmentId ? equipmentId : undefined,
          breakdownType: type === "equipment_breakdown" ? breakdownType || undefined : undefined,
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

            <div className="field-label">{t("maintenance.scopeLabel")}</div>
            <div className="chip-row">
              <button className={`chip-btn ${scope === "bay" ? "active" : ""}`} onClick={() => setScope("bay")}>
                {t("maintenance.scopeBay")}
              </button>
              <button className={`chip-btn ${scope === "general" ? "active" : ""}`} onClick={() => setScope("general")}>
                {t("maintenance.scopeGeneral")}
              </button>
            </div>

            {scope === "bay" && (
              <>
                <div className="field-label">{t("maintenance.bayLabel")}</div>
                <select
                  className="text-input"
                  value={bayId}
                  onChange={(e) => {
                    setBayId(e.target.value);
                    setEquipmentId("");
                  }}
                >
                  <option value="">{t("maintenance.selectBay")}</option>
                  {bays.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bayName}
                    </option>
                  ))}
                </select>

                {bayId && (
                  <>
                    <div className="field-label">{t("maintenance.equipmentLabel")}</div>
                    <select className="text-input" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
                      <option value="">{t("maintenance.selectEquipment")}</option>
                      {equipmentOptions.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </>
            )}

            <label className="field-label">{t("maintenance.breakdownTypeLabel")}</label>
            <input
              className="text-input"
              placeholder={t("maintenance.breakdownTypePlaceholder")}
              value={breakdownType}
              onChange={(e) => setBreakdownType(e.target.value)}
            />
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
