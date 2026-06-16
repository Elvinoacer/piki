"use client";

// components/localization/LanguageToggle.tsx
// Compact EN / SW toggle. Drop into the nav header or settings page.

import { useTranslation } from "@/hooks/useTranslation";
import type { Language } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "sw", label: "SW" },
];

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("language_label")}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted p-0.5 gap-0.5",
        className
      )}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLanguage(opt.value)}
          aria-pressed={language === opt.value}
          className={cn(
            "min-w-[44px] rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            language === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
