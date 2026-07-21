import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";
import { enqueue } from "../lib/sync";

const CHEMICAL_KEYS = ["shampoo_nano", "wax", "fog_sanitizer", "tire_shine"];

interface OtherItem {
  name: string;
  qty: string;
}

export default function ShiftOpeningWizard({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [towelsReceived, setTowelsReceived] = useState("");
  const [chemicals, setChemicals] = useState<Record<string, string>>({});
  const [otherItems, setOtherItems] = useState<OtherItem[]>([{ name: "", qty: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateOtherItem(index: number, field: keyof OtherItem, value: string) {
    setOtherItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addOtherItem() {
    setOtherItems((prev) => [...prev, { name: "", qty: "" }]);
  }

  function removeOtherItem(index: number) {
    setOtherItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const fields = {
        shiftDate: new Date().toISOString(),
        towelsReceived: towelsReceived || "0",
        chemicalsJson: JSON.stringify(chemicals),
        otherItemsJson: JSON.stringify(otherItems.filter((i) => i.name.trim())),
      };

      if (navigator.onLine) {
        const res = await fetch(`${API_BASE}/api/shift-openings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(fields),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? t("shiftOpening.saveFailed"));
      } else {
        await enqueue({ kind: "shift-opening", url: "/api/shift-openings", method: "POST", fields });
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? t("shiftOpening.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="modal-overlay">
        <div className="modal-card center-col">
          <div style={{ fontSize: 44 }}>🌅</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{t("shiftOpening.successTitle")}</div>
          <div style={{ color: "var(--muted)" }}>{t("shiftOpening.successBody")}</div>
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
        <div className="modal-title">{t("shiftOpening.title")}</div>

        <div className="field-label">{t("shiftOpening.towelsLabel")}</div>
        <input
          className="text-input"
          inputMode="numeric"
          value={towelsReceived}
          onChange={(e) => setTowelsReceived(e.target.value)}
          autoFocus
        />

        <div className="field-label" style={{ marginTop: 14 }}>{t("shiftOpening.chemicalsLabel")}</div>
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

        <div className="field-label" style={{ marginTop: 14 }}>{t("shiftOpening.otherItemsLabel")}</div>
        {otherItems.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="text-input"
              style={{ flex: 2 }}
              placeholder={t("shiftOpening.otherItemName")}
              value={item.name}
              onChange={(e) => updateOtherItem(i, "name", e.target.value)}
            />
            <input
              className="text-input"
              style={{ flex: 1 }}
              placeholder={t("shiftOpening.otherItemQty")}
              inputMode="decimal"
              value={item.qty}
              onChange={(e) => updateOtherItem(i, "qty", e.target.value)}
            />
            {otherItems.length > 1 && (
              <button className="big-btn danger" style={{ padding: "10px 14px" }} onClick={() => removeOtherItem(i)}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="big-btn secondary" style={{ marginBottom: 14 }} onClick={addOtherItem}>
          {t("shiftOpening.addItemBtn")}
        </button>

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="big-btn success" disabled={submitting || !towelsReceived} onClick={submit}>
            {submitting ? t("common.saving") : t("shiftOpening.finishBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
