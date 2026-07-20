import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import TopBar from "./components/TopBar";
import Branches from "./pages/Branches";
import Employees from "./pages/Employees";
import FeedbackPlayer from "./pages/FeedbackPlayer";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import PendingDecisions from "./pages/PendingDecisions";
import PreventiveMaintenance from "./pages/PreventiveMaintenance";

const TABS = [
  { id: "overview", label: "🏠 نظرة عامة", component: Overview },
  { id: "decisions", label: "📥 القرارات المعلقة", component: PendingDecisions },
  { id: "maintenance", label: "🛠️ الصيانة الوقائية", component: PreventiveMaintenance },
  { id: "feedback", label: "🎵 تقييمات العملاء", component: FeedbackPlayer },
  { id: "inventory", label: "📦 المخزون والبيع", component: Inventory },
  { id: "employees", label: "👥 الطاقم والصلاحيات", component: Employees },
  { id: "branches", label: "🏢 الفروع", component: Branches },
];

function Shell() {
  const { manager, logout } = useAuth();
  const [tab, setTab] = useState("overview");

  if (!manager) return <Login />;

  const Active = TABS.find((t) => t.id === tab)?.component ?? Overview;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">🚗 نظام إدارة مغاسل إيجاز</div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <button className="logout" onClick={logout}>
          🚪 تسجيل خروج
        </button>
      </div>
      <div className="content-area">
        <TopBar />
        <div className="main-content">
          <Active />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
