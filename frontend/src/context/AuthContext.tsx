import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
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
  is_admin?: boolean;
  is_email_verified?: boolean;
  handle_changes_left?: number;
  boosted_until?: string;
  music_compatibility_pct?: number;
  badges?: string[];
  theme_id?: string;
};

type Ctx = {
  loading: boolean;
  user: VibeUser | null;
  refresh: () => Promise<void>;
  loginPassword: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginGoogle: (sessionId: string) => Promise<void>;
  updateProfile: (patch: Partial<VibeUser> & { location?: any }) => Promise<void>;
  sendVerificationCode: () => Promise<string>;
  verifyEmailCode: (code: string) => Promise<void>;
  verifyPayment: (method?: string, txId?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<VibeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: VibeUser; token?: string }>("/auth/me");
      if (res.token) {
        await saveToken(res.token);
      }
      setUser(res.user);
    } catch (err: any) {
      const status = err?.status;
      const msg = String(err?.message || "").toLowerCase();
      // ONLY clear token if backend explicitly responded HTTP 401 Unauthorized or revoked token!
      if (
        status === 401 ||
        msg.includes("401") ||
        msg.includes("not authenticated") ||
        msg.includes("invalid or expired token") ||
        msg.includes("iptal edildi")
      ) {
        setUser(null);
        await clearToken();
      } else {
        // Network timeout / Render server waking up from cold start: Keep token stored!
        console.log("Preserving user session during server cold-start / network delay:", msg);
      }
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

  const sendVerificationCode = async (): Promise<string> => {
    const res = await api<{ message: string; code?: string }>("/auth/send-verification-code", {
      method: "POST",
    });
    return res.code || "";
  };

  const verifyEmailCode = async (code: string) => {
    const res = await api<{ message: string; user: VibeUser }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    setUser(res.user);
  };

  const verifyPayment = async (method = "card", txId?: string) => {
    const res = await api<{ message: string; user: VibeUser }>("/subscription/verify-payment", {
      method: "POST",
      body: JSON.stringify({ payment_method: method, transaction_id: txId }),
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
      router.replace("/(auth)/welcome");
    }
  };

  const deleteAccount = async () => {
    try {
      await api("/users/me", { method: "DELETE" });
    } catch {
      // Ignore errors during deletion
    } finally {
      await clearToken();
      setUser(null);
      router.replace("/(auth)/welcome");
    }
  };

  const value = useMemo<Ctx>(
    () => ({
      loading,
      user,
      refresh,
      loginPassword,
      register,
      loginGoogle,
      updateProfile,
      sendVerificationCode,
      verifyEmailCode,
      verifyPayment,
      logout,
      deleteAccount,
    }),
    [loading, user, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
