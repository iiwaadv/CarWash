import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

export default function IdleLockOverlay() {
  const { employee, isLocked, unlock, logout } = useAuth();
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isLocked) return null;

  async function pressKey(k: string) {
    if (k === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      const ok = await unlock(next);
      if (!ok) {
        setError(t("login.incorrectPin"));
        setPin("");
      } else {
        setError(null);
      }
    }
  }

  return (
    <div className="overlay-lock">
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{t("idleLock.title", { name: employee?.name })}</div>
      <div style={{ color: "var(--muted)" }}>{t("idleLock.subtitle")}</div>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
        ))}
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
          k === "" ? (
            <div key={i} />
          ) : (
            <button key={i} className="pin-key" onClick={() => pressKey(k)}>
              {k === "back" ? "⌫" : k}
            </button>
          )
        )}
      </div>
      <button className="big-btn secondary" onClick={logout} style={{ marginTop: 12 }}>
        {t("idleLock.logoutBtn")}
      </button>
    </div>
  );
}
