import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, refreshSession, tokens } from "../lib/api";
import { decodeJwt } from "../lib/jwt";
import type { LoginResponse, RegisterResponse } from "../types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
}

interface AuthContextValue {
  status: AuthStatus;
  currentUser: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [claimsTick, setClaimsTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!tokens.refresh) {
      setStatus("anonymous");
      return;
    }

    refreshSession().then((ok) => {
      if (!cancelled) setStatus(ok ? "authenticated" : "anonymous");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    tokens.save(data.accessToken, data.refreshToken);
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      username: string;
      password: string;
      displayName: string;
    }) => {
      await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refresh = tokens.refresh;
    if (refresh) {
      try {
        await api("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: refresh }),
        });
      } catch {
        // token already revoked or network issue — clear locally regardless
      }
    }
    tokens.clear();
    setStatus("anonymous");
  }, []);

  const refreshUser = useCallback(async () => {
    const ok = await refreshSession();
    if (ok) setClaimsTick((tick) => tick + 1);
    return ok;
  }, []);

  const currentUser = useMemo<CurrentUser | null>(() => {
    if (status !== "authenticated") return null;
    const access = tokens.access;
    const claims = access ? decodeJwt(access) : null;
    if (!claims?.sub) return null;
    return {
      id: claims.sub,
      email: claims.email,
      username: claims.username ?? claims.email,
      displayName: claims.displayName ?? null,
    };
  }, [status, claimsTick]);

  const value = useMemo(
    () => ({ status, currentUser, login, register, logout, refreshUser }),
    [status, currentUser, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
