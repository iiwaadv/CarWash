import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { db, newClientUuid } from "../lib/db";
import { enqueue, flushOutbox } from "../lib/sync";
import PhotoCaptureGrid from "./PhotoCaptureGrid";

interface Bay {
  id: number;
  bayName: string;
}

export default function NewCarModal({ onClose, onCreated }: { onClose: () => void; onCreated: (job: any) => void }) {
  const { token, branchId } = useAuth();
  const { t } = useTranslation();
  const [bays, setBays] = useState<Bay[]>([]);
  const [plateNumber, setPlateNumber] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [carType, setCarType] = useState("medium");
  const [bayId, setBayId] = useState<number | null>(null);
  const [isHighlyDirty, setIsHighlyDirty] = useState(false);
  const [scratchesNotes, setScratchesNotes] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CAR_TYPES = [
    { id: "small", label: t("newCar.types.small") },
    { id: "medium", label: t("newCar.types.medium") },
    { id: "large", label: t("newCar.types.large") },
  ];

  useEffect(() => {
    if (!token || !branchId) return;
    apiFetch(`/api/bays?branchId=${branchId}`, token)
      .then((data) => {
        setBays(data);
        if (data.length) setBayId(data[0].id);
      })
      .catch(() => setBays([]));
  }, [token, branchId]);

  async function submit() {
    if (!plateNumber.trim()) return setError(t("newCar.plateRequired"));
    if (photos.length < 4) return setError(t("newCar.photosRequired"));
    setError(null);
    setSubmitting(true);

    const clientUuid = newClientUuid();
    const job = {
      id: clientUuid,
      branchId,
      bayId,
      plateNumber,
      customerPhone,
      carType,
      isHighlyDirty,
      status: "queued",
      createdAt: new Date().toISOString(),
      pendingSync: true,
    };

    await db.cachedJobs.put({ localId: clientUuid, branchId: branchId!, data: job, updatedAt: Date.now() });

    await enqueue({
      kind: "create-job",
      url: "/api/job-orders",
      method: "POST",
      clientUuid,
      fields: {
        plateNumber,
        customerPhone,
        carType,
        bayId: bayId ?? undefined,
        isHighlyDirty,
        scratchesNotes,
        clientUuid,
      },
      fileFields: { photos: photos.map((p, i) => ({ blob: p, filename: `${clientUuid}-${i}.jpg` })) },
    });

    if (navigator.onLine) void flushOutbox(token);

    setSubmitting(false);
    onCreated(job);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t("newCar.title")}</div>

        <label className="field-label">{t("newCar.plateLabel")}</label>
        <input
          className="text-input"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          placeholder={t("newCar.platePlaceholder")}
          autoFocus
        />

        <label className="field-label">{t("newCar.phoneLabel")}</label>
        <input
          className="text-input"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="05xxxxxxxx"
          inputMode="tel"
        />

        <label className="field-label">{t("newCar.carTypeLabel")}</label>
        <div className="chip-row">
          {CAR_TYPES.map((c) => (
            <button
              key={c.id}
              className={`chip-btn ${carType === c.id ? "active" : ""}`}
              onClick={() => setCarType(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="field-label">{t("newCar.bayLabel")}</label>
        <div className="chip-row">
          {bays.map((b) => (
            <button
              key={b.id}
              className={`chip-btn ${bayId === b.id ? "active" : ""}`}
              onClick={() => setBayId(b.id)}
            >
              {b.bayName}
            </button>
          ))}
          {bays.length === 0 && <div style={{ color: "var(--muted)" }}>{t("newCar.noBays")}</div>}
        </div>

        <label className="field-label">{t("newCar.photosLabel")}</label>
        <PhotoCaptureGrid count={4} label={t("newCar.photosCaptureLabel")} onChange={setPhotos} />

        <button
          className={`chip-btn ${isHighlyDirty ? "active" : ""}`}
          style={{ width: "100%", marginBottom: 16 }}
          onClick={() => setIsHighlyDirty((v) => !v)}
        >
          {isHighlyDirty ? "✅ " : "⚠️ "} {t("newCar.dirtyToggle")}
        </button>

        <label className="field-label">{t("newCar.scratchesLabel")}</label>
        <input
          className="text-input"
          value={scratchesNotes}
          onChange={(e) => setScratchesNotes(e.target.value)}
        />

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="big-btn success" onClick={submit} disabled={submitting}>
            {submitting ? t("common.saving") : t("newCar.submitBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
