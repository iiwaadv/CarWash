import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetchJson } from "../lib/api";
import { clientHashPin, db } from "../lib/db";

export interface Employee {
  id: number;
  name: string;
  role: string;
  branchId: number;
}

interface AuthContextValue {
  employee: Employee | null;
  token: string | null;
  branchId: number | null;
  isLocked: boolean;
  login: (branchId: number, pin: string) => Promise<void>;
  logout: () => void;
  unlock: (pin: string) => Promise<boolean>;
  markActivity: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const IDLE_LOCK_MS = 3 * 60 * 1000; // "يقفل النظام تلقائياً بعد 3 دقائق من التوقف"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(
    JSON.parse(localStorage.getItem("coe_employee") ?? "null")
  );
  const [token, setToken] = useState<string | null>(localStorage.getItem("coe_token"));
  const [isLocked, setIsLocked] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markActivity = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIsLocked(true), IDLE_LOCK_MS);
  };

  useEffect(() => {
    if (!employee) return;
    markActivity();
    const events = ["touchstart", "mousedown", "keydown"];
    const onActivity = () => markActivity();
    events.forEach((e) => window.addEventListener(e, onActivity));
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  const login = async (branchId: number, pin: string) => {
    const pinHash = await clientHashPin(pin);

    if (navigator.onLine) {
      try {
        const res = await apiFetchJson("/api/auth/login", null, "POST", { branchId, pinCode: pin });
        setEmployee(res.employee);
        setToken(res.token);
        localStorage.setItem("coe_employee", JSON.stringify(res.employee));
        localStorage.setItem("coe_token", res.token);
        await db.authCache.put({
          branchId,
          pinHash,
          token: res.token,
          employee: res.employee,
          cachedAt: Date.now(),
        });
        setIsLocked(false);
        return;
      } catch (err: any) {
        // Fall through to offline cache if it's a network failure, otherwise surface the error.
        if (err instanceof TypeError) {
          // network error - try offline cache below
        } else {
          throw err;
        }
      }
    }

    const cached = await db.authCache.get(branchId);
    if (cached && cached.pinHash === pinHash) {
      setEmployee(cached.employee);
      setToken(cached.token);
      localStorage.setItem("coe_employee", JSON.stringify(cached.employee));
      localStorage.setItem("coe_token", cached.token);
      setIsLocked(false);
      return;
    }

    throw new Error(navigator.onLine ? "invalid_pin" : "offline_no_cache");
  };

  const unlock = async (pin: string): Promise<boolean> => {
    if (!employee) return false;
    const pinHash = await clientHashPin(pin);
    const cached = await db.authCache.get(employee.branchId);
    const ok = cached?.pinHash === pinHash;
    if (ok) {
      setIsLocked(false);
      markActivity();
    }
    return ok;
  };

  const logout = () => {
    setEmployee(null);
    setToken(null);
    localStorage.removeItem("coe_employee");
    localStorage.removeItem("coe_token");
  };

  const value = useMemo(
    () => ({
      employee,
      token,
      branchId: employee?.branchId ?? null,
      isLocked,
      login,
      logout,
      unlock,
      markActivity,
    }),
    [employee, token, isLocked]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
