import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, saveToken } from "@/src/lib/api";

export type VibeUser = {
  user_id: string;
  email?: string;
  name?: string;
  handle?: string;
  bio?: string;
  age?: number;
  gender?: string;
  orientation?: string;
  vibe_status?: string;
  interests?: string[];
  music_tags?: string[];
  photos?: string[];
  city?: string;
  location?: { lat: number; lng: number };
  onboarded?: boolean;
  distance_km?: number;
  is_premium?: boolean;
  boosted_until?: string;
};

type Ctx = {
  loading: boolean;
  user: VibeUser | null;
  refresh: () => Promise<void>;
  loginPassword: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginGoogle: (sessionId: string) => Promise<void>;
  updateProfile: (patch: Partial<VibeUser> & { location?: any }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<VibeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: VibeUser }>("/auth/me");
      setUser(res.user);
    } catch {
      setUser(null);
      await clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const finish = async (token: string, u: VibeUser) => {
    await saveToken(token);
    setUser(u);
  };

  const loginPassword = async (email: string, password: string) => {
    const res = await api<{ token: string; user: VibeUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    await finish(res.token, res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api<{ token: string; user: VibeUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
      auth: false,
    });
    await finish(res.token, res.user);
  };

  const loginGoogle = async (sessionId: string) => {
    const res = await api<{ token: string; user: VibeUser }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
      auth: false,
    });
    await finish(res.token, res.user);
  };

  const updateProfile = async (patch: Partial<VibeUser> & { location?: any }) => {
    const res = await api<{ user: VibeUser }>("/users/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearToken();
      setUser(null);
    }
  };

  const value = useMemo<Ctx>(
    () => ({ loading, user, refresh, loginPassword, register, loginGoogle, updateProfile, logout }),
    [loading, user, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
