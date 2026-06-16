// store/useLanguageStore.ts
// Persists the user's chosen language to localStorage.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Language, type TranslationKey, translations, interpolate } from "@/lib/i18n/translations";

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
      t: (key, vars) => {
        const lang = get().language;
        const str = translations[lang][key] ?? translations["en"][key] ?? key;
        return interpolate(str, vars);
      },
    }),
    {
      name: "pikii-language",
    }
  )
);
