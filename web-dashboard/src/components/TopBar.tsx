import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

function getGreetingKey(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "topbar.greetingMorning";
  if (hour >= 12 && hour < 17) return "topbar.greetingAfternoon";
  if (hour >= 17 && hour < 20) return "topbar.greetingEvening";
  return "topbar.greetingNight";
}

export default function TopBar() {
  const { manager } = useAuth();
  const { t, i18n } = useTranslation();
  const [greetingKey, setGreetingKey] = useState(getGreetingKey());

  useEffect(() => {
    const interval = setInterval(() => setGreetingKey(getGreetingKey()), 60000);
    return () => clearInterval(interval);
  }, []);

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  }

  return (
    <div className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        <img src="/ejaz-logo.png" alt="إيجاز" className="ejaz-logo" />
        <div className="greeting">{t(greetingKey)}</div>
      </div>
      <div className="dashboard-topbar-right">
        <button className="lang-switch" onClick={toggleLanguage}>
          🌐 {t("topbar.language")}
        </button>
        {manager && (
          <div className="user-chip">
            <span className="user-name">{manager.name}</span>
            <span className="user-role">{t(`topbar.roles.${manager.role}`, manager.role)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
