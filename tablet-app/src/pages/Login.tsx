import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

interface Branch {
  id: number;
  name: string;
  status: string;
}

export default function Login() {
  const { login } = useAuth();
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
      setError(err.message ?? "فشل تسجيل الدخول");
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
      <div style={{ fontSize: 28, fontWeight: 800 }}>🚗 CarWash Ops Engine</div>
      <div style={{ color: "var(--muted)" }}>اختر فرعك وأدخل رمزك السري المكون من 4 أرقام</div>

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
        {branches.length === 0 && <div style={{ color: "var(--muted)" }}>...جاري تحميل الفروع</div>}
      </div>

      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
        ))}
      </div>

      {error && <div className="error-text">{error}</div>}
      {busy && <div style={{ color: "var(--muted)" }}>...جاري التحقق</div>}

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

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        وضع تجريبي: مشرف فرع 1 → PIN 1234 · مدير عام → PIN 9999
      </div>
    </div>
  );
}
