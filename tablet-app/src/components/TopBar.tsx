import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import MaintenanceModal from "./MaintenanceModal";
import ShiftClosureWizard from "../pages/ShiftClosureWizard";
import ShiftOpeningWizard from "./ShiftOpeningWizard";

function getGreetingKey(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "topbar.greetingMorning";
  if (hour >= 12 && hour < 17) return "topbar.greetingAfternoon";
  if (hour >= 17 && hour < 20) return "topbar.greetingEvening";
  return "topbar.greetingNight";
}

export default function TopBar() {
  const { employee, logout } = useAuth();
  const sync = useSync();
  const { t, i18n } = useTranslation();
  const [showOpening, setShowOpening] = useState(false);
  const [showClosure, setShowClosure] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [greetingKey, setGreetingKey] = useState(getGreetingKey());

  useEffect(() => {
    const interval = setInterval(() => setGreetingKey(getGreetingKey()), 60000);
    return () => clearInterval(interval);
  }, []);

  const branchName = useMemo(() => {
    try {
      const branches = JSON.parse(localStorage.getItem("coe_branches") ?? "[]");
      return branches.find((b: any) => b.id === employee?.branchId)?.name ?? t("topbar.branchFallback", { id: employee?.branchId });
    } catch {
      return t("topbar.branchFallback", { id: employee?.branchId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.branchId, i18n.language]);

  const dotClass = !sync.isOnline ? "offline" : sync.pendingCount > 0 ? "pending" : "";
  const label = !sync.isOnline
    ? t("topbar.offline")
    : sync.pendingCount > 0
    ? t("topbar.syncing", { n: sync.pendingCount })
    : t("topbar.synced");

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/ejaz-logo.png" alt="إيجاز" className="topbar-logo" />
        <div>
          <div className="brand">{t("brand.tagline")}</div>
          <div className="who">
            {t(greetingKey)} · {employee?.name} ({t(`topbar.roles.${employee?.role}`, employee?.role ?? "")}) · {branchName}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="sync-pill">
          <span className={`sync-dot ${dotClass}`} />
          {label}
        </div>
        <button
          className="big-btn secondary lang-toggle"
          style={{ padding: "10px 14px", fontSize: 14 }}
          onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
        >
          🌐 {t("topbar.language")}
        </button>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => setShowMaintenance(true)}>
          {t("topbar.reportIncidentBtn")}
        </button>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => setShowOpening(true)}>
          {t("topbar.openShiftBtn")}
        </button>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => setShowClosure(true)}>
          {t("topbar.closeShiftBtn")}
        </button>
        <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={logout}>
          {t("topbar.logoutBtn")}
        </button>
      </div>

      {showOpening && <ShiftOpeningWizard onClose={() => setShowOpening(false)} />}
      {showClosure && <ShiftClosureWizard onClose={() => setShowClosure(false)} />}
      {showMaintenance && <MaintenanceModal onClose={() => setShowMaintenance(false)} />}
    </div>
  );
}
