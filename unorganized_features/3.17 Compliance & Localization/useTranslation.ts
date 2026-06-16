// hooks/useTranslation.ts
// Thin wrapper so components don't import the store directly.
// Usage: const { t, language, setLanguage } = useTranslation()

import { useLanguageStore } from "@/store/useLanguageStore";

export function useTranslation() {
  const { t, language, setLanguage } = useLanguageStore();
  return { t, language, setLanguage };
}
