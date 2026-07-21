import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PhotoCaptureGrid from "../components/PhotoCaptureGrid";
import { useAuth } from "../context/AuthContext";
import { apiFetch, API_BASE } from "../lib/api";
import { enqueue } from "../lib/sync";

const CHEMICAL_KEYS = ["shampoo_nano", "wax", "fog_sanitizer", "tire_shine"];

export default function ShiftClosureWizard({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [storagePhotos, setStoragePhotos] = useState<Blob[]>([]);
  const [yardPhotos, setYardPhotos] = useState<Blob[]>([]);
  const [chemicals, setChemicals] = useState<Record<string, string>>({});
  const [towelsStart, setTowelsStart] = useState("");
  const [towelsEnd, setTowelsEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<any | null>(null);

  const steps: string[] = t("shiftClosure.steps", { returnObjects: true }) as unknown as string[];

  // Pre-fill towel/chemical received quantities from today's "shift opening"
  // report, instead of relying on the supervisor to recall the number from memory.
  useEffect(() => {
    if (!token) return;
    apiFetch("/api/shift-openings/latest", token)
      .then((data) => {
        if (!data) return;
        setOpening(data);
        setTowelsStart(String(data.towelsReceived ?? ""));
      })
      .catch(() => {});
  }, [token]);

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
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? t("shiftClosure.saveFailed"));
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
          encouragementMessage: t("shiftClosure.offlineMessage"),
        });
      }
    } catch (err: any) {
      setError(err.message ?? t("shiftClosure.genericError"));
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
          <div style={{ fontSize: 22, fontWeight: 800 }}>{t("shiftClosure.successTitle")}</div>

          <div className="kv-row" style={{ width: "100%" }}>
            <span>{t("shiftClosure.towelsLostLabel")}</span>
            <strong>{towelsLost}</strong>
          </div>
          {result.upsellTargetPct != null && (
            <div style={{ width: "100%" }}>
              <div className="kv-row">
                <span>{t("shiftClosure.upsellTargetLabel")}</span>
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

          {result.chemicalsConsumed && (
            <div style={{ width: "100%" }}>
              <div className="field-label">{t("shiftClosure.chemicalsConsumedLabel")}</div>
              {Object.entries(result.chemicalsConsumed as Record<string, number>).map(([key, val]) => (
                <div className="kv-row" key={key}>
                  <span>{t(`shiftClosure.chemicals.${key}`, key)}</span>
                  <strong>{val}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={{ color: "var(--muted)", marginTop: 12 }}>{result.encouragementMessage}</div>

          <button className="big-btn success" style={{ marginTop: 16, width: "100%" }} onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t("shiftClosure.title")}</div>
        <div className="wizard-steps">
          {steps.map((_, i) => (
            <div key={i} className={`wizard-step ${i < step ? "done" : i === step ? "active" : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="field-label">{t("shiftClosure.step0Label")}</div>
            <PhotoCaptureGrid count={2} label={t("shiftClosure.step0Capture")} onChange={setStoragePhotos} />
          </>
        )}

        {step === 1 && (
          <>
            <div className="field-label">{t("shiftClosure.step1Label")}</div>
            <PhotoCaptureGrid count={2} label={t("shiftClosure.step1Capture")} onChange={setYardPhotos} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="field-label">{t("shiftClosure.chemicalsLabel")}</div>
            {CHEMICAL_KEYS.map((key) => (
              <input
                key={key}
                className="text-input"
                placeholder={t(`shiftClosure.chemicals.${key}`)}
                inputMode="decimal"
                value={chemicals[key] ?? ""}
                onChange={(e) => setChemicals((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            ))}
            <div className="field-label">{t("shiftClosure.towelsStartLabel")}</div>
            <input className="text-input" inputMode="numeric" value={towelsStart} onChange={(e) => setTowelsStart(e.target.value)} />
            {opening && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 8 }}>{t("shiftClosure.prefilledFromOpening")}</div>}
            <div className="field-label">{t("shiftClosure.towelsEndLabel")}</div>
            <input className="text-input" inputMode="numeric" value={towelsEnd} onChange={(e) => setTowelsEnd(e.target.value)} />
          </>
        )}

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button
            className="big-btn secondary"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? t("common.cancel") : t("common.back")}
          </button>
          {step < 2 ? (
            <button
              className="big-btn"
              disabled={step === 0 ? storagePhotos.length === 0 : yardPhotos.length === 0}
              onClick={() => setStep((s) => s + 1)}
            >
              {t("common.next")}
            </button>
          ) : (
            <button className="big-btn success" disabled={submitting} onClick={submit}>
              {submitting ? t("common.saving") : t("shiftClosure.finishBtn")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
