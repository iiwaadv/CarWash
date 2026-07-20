import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { db, newClientUuid } from "../lib/db";
import { enqueue, flushOutbox } from "../lib/sync";
import PhotoCaptureGrid from "./PhotoCaptureGrid";

interface Bay {
  id: number;
  bayName: string;
}

const CAR_TYPES = [
  { id: "small", label: "صغيرة" },
  { id: "medium", label: "وسط" },
  { id: "large", label: "كبيرة" },
];

export default function NewCarModal({ onClose, onCreated }: { onClose: () => void; onCreated: (job: any) => void }) {
  const { token, branchId } = useAuth();
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
    if (!plateNumber.trim()) return setError("رقم اللوحة مطلوب");
    if (photos.length < 4) return setError("التصوير الإجباري: 4 صور من جميع الزوايا قبل الغسيل");
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
        <div className="modal-title">🚗 إضافة سيارة جديدة</div>

        <label className="field-label">رقم اللوحة</label>
        <input
          className="text-input"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          placeholder="أ ب ج 1234"
          autoFocus
        />

        <label className="field-label">رقم جوال العميل (اختياري)</label>
        <input
          className="text-input"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="05xxxxxxxx"
          inputMode="tel"
        />

        <label className="field-label">نوع السيارة</label>
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

        <label className="field-label">الموقف (Bay)</label>
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
          {bays.length === 0 && <div style={{ color: "var(--muted)" }}>لا توجد مواقف مسجلة لهذا الفرع</div>}
        </div>

        <label className="field-label">📸 صور ما قبل الغسيل (إجبارية - 4 زوايا)</label>
        <PhotoCaptureGrid count={4} label="فحص قبل الغسيل" onChange={setPhotos} />

        <button
          className={`chip-btn ${isHighlyDirty ? "active" : ""}`}
          style={{ width: "100%", marginBottom: 16 }}
          onClick={() => setIsHighlyDirty((v) => !v)}
        >
          {isHighlyDirty ? "✅ " : "⚠️ "} سيارة شديدة الاتساخ - خدوش مخفية
        </button>

        <label className="field-label">ملاحظات خدوش / صدمات قديمة (اختياري)</label>
        <input
          className="text-input"
          value={scratchesNotes}
          onChange={(e) => setScratchesNotes(e.target.value)}
        />

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            إلغاء
          </button>
          <button className="big-btn success" onClick={submit} disabled={submitting}>
            {submitting ? "...جاري الحفظ" : "إضافة السيارة"}
          </button>
        </div>
      </div>
    </div>
  );
}
