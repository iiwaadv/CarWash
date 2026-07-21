import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./context/AuthContext";
import TopBar from "./components/TopBar";
import Branches from "./pages/Branches";
import BranchDetail from "./pages/BranchDetail";
import Employees from "./pages/Employees";
import Equipment from "./pages/Equipment";
import FeedbackPlayer from "./pages/FeedbackPlayer";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Materials from "./pages/Materials";
import Overview from "./pages/Overview";
import PendingDecisions from "./pages/PendingDecisions";
import PreventiveMaintenance from "./pages/PreventiveMaintenance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Shifts from "./pages/Shifts";
import Tasks from "./pages/Tasks";

const TABS = [
  { id: "overview", labelKey: "nav.overview", component: Overview },
  { id: "decisions", labelKey: "nav.decisions", component: PendingDecisions },
  { id: "tasks", labelKey: "nav.tasks", component: Tasks },
  { id: "shifts", labelKey: "nav.shifts", component: Shifts },
  { id: "branchDetail", labelKey: "nav.branchDetail", component: BranchDetail },
  { id: "maintenance", labelKey: "nav.maintenance", component: PreventiveMaintenance },
  { id: "equipment", labelKey: "nav.equipment", component: Equipment },
  { id: "feedback", labelKey: "nav.feedback", component: FeedbackPlayer },
  { id: "inventory", labelKey: "nav.sales", component: Inventory },
  { id: "materials", labelKey: "nav.inventory", component: Materials },
  { id: "reports", labelKey: "nav.reports", component: Reports },
  { id: "settings", labelKey: "nav.settings", component: Settings },
  { id: "employees", labelKey: "nav.employees", component: Employees },
  { id: "branches", labelKey: "nav.branches", component: Branches },
];

function Shell() {
  const { manager, logout } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState("overview");

  if (!manager) return <Login />;

  const Active = TABS.find((t) => t.id === tab)?.component ?? Overview;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">{t("brand.nameWithEmoji")}</div>
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            className={`nav-item ${tab === tabItem.id ? "active" : ""}`}
            onClick={() => setTab(tabItem.id)}
          >
            {t(tabItem.labelKey)}
          </button>
        ))}
        <button className="logout" onClick={logout}>
          {t("common.logout")}
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
