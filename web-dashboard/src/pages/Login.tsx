import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(pin);
    } catch (err: any) {
      setError(err.message ?? "فشل تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div style={{ fontSize: 28, fontWeight: 800 }}>👑 CarWash Ops Engine</div>
      <div className="login-card">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>لوحة تحكم المدير العام</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>أدخل رمزك السري (PIN) المكوّن من 4 أرقام</div>
        <form onSubmit={submit}>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            inputMode="numeric"
            autoFocus
          />
          {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn" style={{ width: "100%" }} disabled={pin.length !== 4 || busy}>
            {busy ? "...جاري الدخول" : "دخول"}
          </button>
        </form>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 14 }}>وضع تجريبي: PIN 9999</div>
      </div>
    </div>
  );
}
