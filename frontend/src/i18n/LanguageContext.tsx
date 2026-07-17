import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { Language, translations } from "./translations";

const LANG_KEY = "vibepulse.language";

type Ctx = {
  lang: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: keyof typeof translations["tr"]) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("tr");

  useEffect(() => {
    async function loadLang() {
      try {
        const saved = await storage.secureGet<Language>(LANG_KEY, "tr");
        if (saved && (saved === "tr" || saved === "en" || saved === "es" || saved === "de")) {
          setLangState(saved);
        }
      } catch {}
    }
    loadLang();
  }, []);

  const setLanguage = async (newLang: Language) => {
    setLangState(newLang);
    await storage.secureSet(LANG_KEY, newLang);
  };

  const t = (key: keyof typeof translations["tr"]): string => {
    const langDict = translations[lang] || translations["tr"];
    return langDict[key] || translations["tr"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}
