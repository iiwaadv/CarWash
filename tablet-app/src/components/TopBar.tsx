import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import MaintenanceModal from "./MaintenanceModal";
import ShiftClosureWizard from "../pages/ShiftClosureWizard";

export default function TopBar() {
  const { employee, logout } = useAuth();
  const sync = useSync();
  const [showClosure, setShowClosure] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);

  const dotClass = !sync.isOnline ? "offline" : sync.pendingCount > 0 ? "pending" : "";
  const label = !sync.isOnline
    ? "غير متصل — العمل محفوظ محلياً"
    : sync.pendingCount > 0
    ? `مزامنة... (${sync.pendingCount})`
    : "متصل ومتزامن";

  return (
    <div className="topbar">
      <div>
        <div className="brand">🚗 COE — ساحة العمل</div>
        <div className="who">
          {employee?.name} · فرع #{employee?.branchId}
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
