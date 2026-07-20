import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { getGreeting } from "../lib/greeting";
import MaintenanceModal from "./MaintenanceModal";
import ShiftClosureWizard from "../pages/ShiftClosureWizard";

const ROLE_LABEL: Record<string, string> = {
  manager: "مدير",
  supervisor: "مشرف",
  washer: "عامل غسيل",
  detailer: "فني تنشيف",
};

export default function TopBar() {
  const { employee, logout } = useAuth();
  const sync = useSync();
  const [showClosure, setShowClosure] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60000);
    return () => clearInterval(interval);
  }, []);

  const branchName = useMemo(() => {
    try {
      const branches = JSON.parse(localStorage.getItem("coe_branches") ?? "[]");
      return branches.find((b: any) => b.id === employee?.branchId)?.name ?? `فرع #${employee?.branchId}`;
    } catch {
      return `فرع #${employee?.branchId}`;
    }
  }, [employee?.branchId]);

  const dotClass = !sync.isOnline ? "offline" : sync.pendingCount > 0 ? "pending" : "";
  const label = !sync.isOnline
    ? "غير متصل — العمل محفوظ محلياً"
    : sync.pendingCount > 0
    ? `مزامنة... (${sync.pendingCount})`
    : "متصل ومتزامن";

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/ejaz-logo.png" alt="إيجاز" className="topbar-logo" />
        <div>
          <div className="brand">🚗 إيجاز — ساحة العمل</div>
          <div className="who">
            {greeting} · {employee?.name} ({ROLE_LABEL[employee?.role ?? ""] ?? employee?.role}) · {branchName}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="sync-pill">
          <span className={`sync-dot ${dotClass}`} />
          {label}
        </div>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => setShowMaintenance(true)}>
          🛠️ بلاغ عطل
        </button>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => setShowClosure(true)}>
          🔏 إغلاق الوردية
        </button>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={logout}>
          خروج
        </button>
      </div>

      {showClosure && <ShiftClosureWizard onClose={() => setShowClosure(false)} />}
      {showMaintenance && <MaintenanceModal onClose={() => setShowMaintenance(false)} />}
    </div>
  );
}
