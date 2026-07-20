import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getGreeting } from "../lib/greeting";

const ROLE_LABEL: Record<string, string> = {
  manager: "مدير",
  supervisor: "مشرف",
  washer: "عامل غسيل",
  detailer: "فني تنشيف",
};

export default function TopBar() {
  const { manager } = useAuth();
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        <img src="/ejaz-logo.png" alt="إيجاز" className="ejaz-logo" />
        <div className="greeting">{greeting}</div>
      </div>
      {manager && (
        <div className="dashboard-topbar-right">
          <div className="user-chip">
            <span className="user-name">{manager.name}</span>
            <span className="user-role">{ROLE_LABEL[manager.role] ?? manager.role}</span>
          </div>
        </div>
      )}
    </div>
  );
}
