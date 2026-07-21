import { useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./context/AuthContext";
import TopBar from "./components/TopBar";
import AuditLogs from "./pages/AuditLogs";
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
import SearchCenter from "./pages/SearchCenter";
import Shifts from "./pages/Shifts";
import Tasks from "./pages/Tasks";

type TabDef = {
  id: string;
  labelKey: string;
  group: string;
  component: ComponentType;
  /** permission key; manager always sees all */
  perm?: string;
  roles?: string[];
};

const TABS: TabDef[] = [
  { id: "overview", labelKey: "nav.overview", group: "nav.groupOps", component: Overview },
  { id: "search", labelKey: "nav.search", group: "nav.groupOps", component: SearchCenter },
  { id: "tasks", labelKey: "nav.tasks", group: "nav.groupOps", component: Tasks },
  { id: "decisions", labelKey: "nav.decisions", group: "nav.groupMaint", component: PendingDecisions, perm: "maintenance" },
  { id: "maintenance", labelKey: "nav.maintenance", group: "nav.groupMaint", component: PreventiveMaintenance, perm: "maintenance" },
  { id: "equipment", labelKey: "nav.equipment", group: "nav.groupMaint", component: Equipment, perm: "maintenance" },
  { id: "inventory", labelKey: "nav.sales", group: "nav.groupSales", component: Inventory, perm: "sales" },
  { id: "materials", labelKey: "nav.inventory", group: "nav.groupSales", component: Materials, perm: "inventory" },
  { id: "shifts", labelKey: "nav.shifts", group: "nav.groupOps", component: Shifts, perm: "shifts" },
  { id: "branchDetail", labelKey: "nav.branchDetail", group: "nav.groupOps", component: BranchDetail },
  { id: "reports", labelKey: "nav.reports", group: "nav.groupReports", component: Reports, perm: "reports" },
  { id: "audit", labelKey: "nav.audit", group: "nav.groupReports", component: AuditLogs, roles: ["manager"] },
  { id: "feedback", labelKey: "nav.feedback", group: "nav.groupOps", component: FeedbackPlayer },
  { id: "employees", labelKey: "nav.employees", group: "nav.groupAdmin", component: Employees, roles: ["manager"] },
  { id: "branches", labelKey: "nav.branches", group: "nav.groupAdmin", component: Branches, roles: ["manager"] },
  { id: "settings", labelKey: "nav.settings", group: "nav.groupAdmin", component: Settings, roles: ["manager"] },
];

const DEFAULT_BRANCH_MANAGER_PERMS = [
  "maintenance",
  "shifts",
  "reports",
  "sales",
  "inventory",
];

function parsePerms(json: string | null | undefined): string[] {
  if (!json) return DEFAULT_BRANCH_MANAGER_PERMS;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : DEFAULT_BRANCH_MANAGER_PERMS;
  } catch {
    return DEFAULT_BRANCH_MANAGER_PERMS;
  }
}

function Shell() {
  const { manager, logout } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState("overview");

  const visibleTabs = useMemo(() => {
    if (!manager) return [];
    if (manager.role === "manager") return TABS;
    const perms = parsePerms(manager.permissionsJson);
    return TABS.filter((item) => {
      if (item.roles && !item.roles.includes(manager.role)) return false;
      if (!item.perm) return true;
      return perms.includes(item.perm);
    });
  }, [manager]);

  if (!manager) return <Login />;

  const activeId = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0]?.id ?? "overview";
  const Active = visibleTabs.find((t) => t.id === activeId)?.component ?? Overview;

  const groups = Array.from(new Set(visibleTabs.map((t) => t.group)));

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">{t("brand.nameWithEmoji")}</div>
        <div className="sidebar-nav">
          {groups.map((groupKey) => (
            <div key={groupKey}>
              <div className="sidebar-group">{t(groupKey)}</div>
              {visibleTabs
                .filter((item) => item.group === groupKey)
                .map((tabItem) => (
                  <button
                    key={tabItem.id}
                    className={`nav-item ${activeId === tabItem.id ? "active" : ""}`}
                    onClick={() => setTab(tabItem.id)}
                  >
                    {t(tabItem.labelKey)}
                  </button>
                ))}
            </div>
          ))}
        </div>
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
