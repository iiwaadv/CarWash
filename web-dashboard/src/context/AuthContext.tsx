import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { apiFetchJson } from "../lib/api";

export interface ManagerEmployee {
  id: number;
  name: string;
  role: string;
  branchId: number;
}

interface AuthContextValue {
  token: string | null;
  manager: ManagerEmployee | null;
  login: (pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("coe_manager_token"));
  const [manager, setManager] = useState<ManagerEmployee | null>(
    JSON.parse(localStorage.getItem("coe_manager") ?? "null")
  );

  async function login(pin: string) {
    const res = await apiFetchJson("/api/auth/manager-login", null, "POST", { pinCode: pin });
    setToken(res.token);
    setManager(res.employee);
    localStorage.setItem("coe_manager_token", res.token);
    localStorage.setItem("coe_manager", JSON.stringify(res.employee));
  }

  function logout() {
    setToken(null);
    setManager(null);
    localStorage.removeItem("coe_manager_token");
    localStorage.removeItem("coe_manager");
  }

  const value = useMemo(() => ({ token, manager, login, logout }), [token, manager]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
