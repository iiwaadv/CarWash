import IdleLockOverlay from "./components/IdleLockOverlay";
import TopBar from "./components/TopBar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SyncProvider } from "./context/SyncContext";
import Login from "./pages/Login";
import LiveYard from "./pages/LiveYard";

function Shell() {
  const { employee } = useAuth();

  if (!employee) return <Login />;

  return (
    <div className="app-shell">
      <TopBar />
      <LiveYard />
      <IdleLockOverlay />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <Shell />
      </SyncProvider>
    </AuthProvider>
  );
}
