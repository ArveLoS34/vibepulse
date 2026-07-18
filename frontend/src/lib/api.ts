import { Platform } from "react-native";
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";

function getFallbackBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  // Live Production Backend URL on Render
  return "https://vibepulse-tg92.onrender.com";
}

const BASE_URL = getFallbackBaseUrl();
export const TOKEN_KEY = "vibepulse.token";

export type ApiOptions = RequestInit & { auth?: boolean };

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (opts.auth !== false) {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `${BASE_URL}/api${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 saniye zaman aşımı (Render soğuk başlatma uyanması için)

  try {
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { detail: text };
    }
    if (!res.ok) {
      let detail = json?.detail;
      let msg = "İşlem sırasında bir hata oluştu.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        const firstErr = detail[0];
        if (firstErr?.type === "string_too_short" && firstErr?.loc?.includes("title")) {
          msg = "Oda başlığı en az 3 karakter olmalıdır.";
        } else if (firstErr?.msg) {
          msg = firstErr.msg;
        } else {
          msg = "Girdiğiniz metin çok kısa veya geçersiz.";
        }
      } else if (detail) {
        msg = typeof detail === "object" ? (detail.message || JSON.stringify(detail)) : String(detail);
      } else {
        msg = `Sunucu hatası (${res.status})`;
      }
      const errorObj: any = new Error(msg);
      errorObj.status = res.status;
      throw errorObj;
    }
    return json as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      const timeoutErr: any = new Error("Sunucu uyanıyor (Zaman aşımı). Lütfen birazdan tekrar deneyin.");
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

export const saveToken = (t: string) => storage.secureSet(TOKEN_KEY, t);
export const clearToken = () => storage.secureRemove(TOKEN_KEY);
