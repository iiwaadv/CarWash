import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

interface Branch {
  id: number;
  name: string;
  status: string;
}

export default function Login() {
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/branches`)
      .then((r) => r.json())
      .then((data) => {
        setBranches(data);
        localStorage.setItem("coe_branches", JSON.stringify(data));
        if (data.length) setBranchId((prev) => prev ?? data[0].id);
      })
      .catch(() => {
        const cached = JSON.parse(localStorage.getItem("coe_branches") ?? "[]");
        setBranches(cached);
        if (cached.length) setBranchId(cached[0].id);
      });
  }, []);

  useEffect(() => {
    if (pin.length === 4 && branchId) {
      void attemptLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function attemptLogin() {
    if (!branchId) return;
    setBusy(true);
    setError(null);
    try {
      await login(branchId, pin);
    } catch (err: any) {
      setError(err.message === "offline_no_cache" ? t("login.offlineNoCache") : t("login.incorrectPin"));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function pressKey(k: string) {
    if (busy) return;
    if (k === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    setPin((p) => p + k);
  }

  return (
    <div className="login-screen">
      <button
        className="lang-switch lang-switch-floating"
        onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
      >
        🌐 {t("topbar.language")}
      </button>
      <img src="/ejaz-logo.png" alt="إيجاز" className="login-logo" />
      <div style={{ fontSize: 26, fontWeight: 800 }}>{t("brand.nameWithEmoji")}</div>
      <div style={{ color: "var(--muted)" }}>{t("login.welcome")}</div>
      <div style={{ color: "var(--muted)" }}>{t("login.chooseBranchAndPin")}</div>

      <div className="branch-select">
        {branches.map((b) => (
          <button
            key={b.id}
            className={`branch-chip ${branchId === b.id ? "active" : ""}`}
            onClick={() => setBranchId(b.id)}
          >
            {b.name}
          </button>
        ))}
        {branches.length === 0 && <div style={{ color: "var(--muted)" }}>{t("login.loadingBranches")}</div>}
      </div>

      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
        ))}
      </div>

      {error && <div className="error-text">{error}</div>}
      {busy && <div style={{ color: "var(--muted)" }}>{t("login.checking")}</div>}

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

      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t("login.demoHint")}</div>
    </div>
  );
}
