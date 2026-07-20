import { useState } from "react";
import PhotoCaptureGrid from "../components/PhotoCaptureGrid";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";
import { enqueue } from "../lib/sync";

const CHEMICALS = [
  { key: "shampoo_nano", label: "شامبو نانو (لتر)" },
  { key: "wax", label: "واكس (لتر)" },
  { key: "fog_sanitizer", label: "معقم ضباب (لتر)" },
  { key: "tire_shine", label: "ملمع إطارات (لتر)" },
];

export default function ShiftClosureWizard({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [storagePhotos, setStoragePhotos] = useState<Blob[]>([]);
  const [yardPhotos, setYardPhotos] = useState<Blob[]>([]);
  const [chemicals, setChemicals] = useState<Record<string, string>>({});
  const [towelsStart, setTowelsStart] = useState("");
  const [towelsEnd, setTowelsEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = ["غرفة العهدة", "الساحة", "الجرد والإغلاق"];

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("shiftDate", new Date().toISOString());
      form.append("chemicalsRemainingJson", JSON.stringify(chemicals));
      form.append("towelsReceivedStart", towelsStart || "0");
      form.append("towelsCollectedEnd", towelsEnd || "0");
      storagePhotos.forEach((p, i) => form.append("storagePhotos", p, `storage-${i}.jpg`));
      yardPhotos.forEach((p, i) => form.append("yardPhotos", p, `yard-${i}.jpg`));

      if (navigator.onLine) {
        const res = await fetch(`${API_BASE}/api/shift-inventory`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "فشل الحفظ");
        setResult(await res.json());
      } else {
        await enqueue({
          kind: "shift-inventory",
          url: "/api/shift-inventory",
          method: "POST",
          fields: {
            shiftDate: new Date().toISOString(),
            chemicalsRemainingJson: JSON.stringify(chemicals),
            towelsReceivedStart: towelsStart || "0",
            towelsCollectedEnd: towelsEnd || "0",
          },
          fileFields: {
            storagePhotos: storagePhotos.map((p, i) => ({ blob: p, filename: `storage-${i}.jpg` })),
            yardPhotos: yardPhotos.map((p, i) => ({ blob: p, filename: `yard-${i}.jpg` })),
          },
        });
        const towelsLost = Number(towelsStart || 0) - Number(towelsEnd || 0);
        setResult({
          towelsLost,
          targetMet: null,
          encouragementMessage: "تم حفظ التقرير محلياً وسيتم رفعه تلقائياً عند استعادة الاتصال. شكراً على جهدك اليوم!",
        });
      }
    } catch (err: any) {
      setError(err.message ?? "حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const towelsLost = result.towelsLost ?? 0;
    return (
      <div className="modal-overlay">
        <div className="modal-card center-col">
          <div style={{ fontSize: 44 }}>{towelsLost > 5 ? "⚠️" : "🎉"}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>تم إغلاق الوردية بنجاح</div>

          <div className="kv-row" style={{ width: "100%" }}>
            <span>المناشف المفقودة</span>
            <strong>{towelsLost}</strong>
          </div>
          {result.upsellTargetPct != null && (
            <div style={{ width: "100%" }}>
              <div className="kv-row">
                <span>تحقيق التارقت المالي (بيع إضافي)</span>
                <strong>{result.upsellTargetPct}%</strong>
              </div>
              <div style={{ height: 14, background: "var(--card)", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, result.upsellTargetPct)}%`,
                    background: result.targetMet ? "var(--success)" : "var(--warning)",
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ color: "var(--muted)", marginTop: 12 }}>{result.encouragementMessage}</div>

          <button className="big-btn success" style={{ marginTop: 16, width: "100%" }} onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">🔏 معالج جرد وإغلاق الوردية</div>
        <div className="wizard-steps">
          {steps.map((_, i) => (
            <div key={i} className={`wizard-step ${i < step ? "done" : i === step ? "active" : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="field-label">صوّر أدراج غرف العهدة والمكانس وهي نظيفة</div>
            <PhotoCaptureGrid count={2} label="غرفة العهدة" onChange={setStoragePhotos} />
          </>
        )}

        {step === 1 && (
          <>
            <div className="field-label">صوّر الساحة والبايكات وغرف الانتظار خالية ونظيفة</div>
            <PhotoCaptureGrid count={2} label="الساحة" onChange={setYardPhotos} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="field-label">اللترات المتبقية من المواد الكيميائية</div>
            {CHEMICALS.map((c) => (
              <input
                key={c.key}
                className="text-input"
                placeholder={c.label}
                inputMode="decimal"
                value={chemicals[c.key] ?? ""}
                onChange={(e) => setChemicals((prev) => ({ ...prev, [c.key]: e.target.value }))}
              />
            ))}
            <div className="field-label">عدد المناشف المستلمة بداية الوردية</div>
            <input className="text-input" inputMode="numeric" value={towelsStart} onChange={(e) => setTowelsStart(e.target.value)} />
            <div className="field-label">عدد المناشف المجمّعة نهاية الوردية</div>
            <input className="text-input" inputMode="numeric" value={towelsEnd} onChange={(e) => setTowelsEnd(e.target.value)} />
          </>
        )}

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button
            className="big-btn secondary"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "إلغاء" : "السابق"}
          </button>
          {step < 2 ? (
            <button
              className="big-btn"
              disabled={step === 0 ? storagePhotos.length === 0 : yardPhotos.length === 0}
              onClick={() => setStep((s) => s + 1)}
            >
              التالي
            </button>
          ) : (
            <button className="big-btn success" disabled={submitting} onClick={submit}>
              {submitting ? "...جاري الحفظ" : "إنهاء وإغلاق الوردية"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
