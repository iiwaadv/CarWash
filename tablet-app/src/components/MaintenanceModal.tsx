import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { enqueue, flushOutbox } from "../lib/sync";
import PhotoCaptureGrid from "./PhotoCaptureGrid";

const TYPES = [
  { id: "equipment_breakdown", label: "عطل معدات" },
  { id: "customer_car_damage", label: "تلف سيارة عميل" },
];
const SEVERITIES = [
  { id: "critical_stop", label: "توقف كامل" },
  { id: "partial_slow", label: "تعطيل جزئي" },
];

export default function MaintenanceModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const [type, setType] = useState("equipment_breakdown");
  const [severity, setSeverity] = useState("partial_slow");
  const [description, setDescription] = useState("");
  const [compensationPaid, setCompensationPaid] = useState("");
  const [proposedDeduction, setProposedDeduction] = useState("");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
          <div style={{ fontSize: 20, fontWeight: 800 }}>تم رفع البلاغ</div>
          <div style={{ color: "var(--muted)" }}>
            {type === "customer_car_damage"
              ? "تم تسجيل التعويض ورفع مقترح الخصم لمعالجة المدير العام"
              : "تم إشعار فريق الصيانة وسيتم تتبع تكلفة الإصلاح"}
          </div>
          <button className="big-btn success" style={{ width: "100%" }} onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">🛠️ بلاغ عطل / حادث</div>

        <div className="field-label">نوع البلاغ</div>
        <div className="chip-row">
          {TYPES.map((t) => (
            <button key={t.id} className={`chip-btn ${type === t.id ? "active" : ""}`} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {type === "equipment_breakdown" && (
          <>
            <div className="field-label">درجة الخطورة</div>
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
            <label className="field-label">التعويض المدفوع للعميل فوراً (ر.س)</label>
            <input className="text-input" inputMode="decimal" value={compensationPaid} onChange={(e) => setCompensationPaid(e.target.value)} />
            <label className="field-label">مقترح الخصم من العمال المتسببين (ر.س)</label>
            <input className="text-input" inputMode="decimal" value={proposedDeduction} onChange={(e) => setProposedDeduction(e.target.value)} />
          </>
        )}

        <label className="field-label">وصف الحالة</label>
        <input className="text-input" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="field-label">صور</label>
        <PhotoCaptureGrid count={2} label="بلاغ" onChange={setPhotos} />

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            إلغاء
          </button>
          <button className="big-btn danger" disabled={!description.trim() || submitting} onClick={submit}>
            {submitting ? "...جاري الرفع" : "رفع البلاغ"}
          </button>
        </div>
      </div>
    </div>
  );
}
