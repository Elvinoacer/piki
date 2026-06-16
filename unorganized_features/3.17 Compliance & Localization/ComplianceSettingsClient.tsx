"use client";

// app/(dashboard)/settings/compliance/ComplianceSettingsClient.tsx
// Client shell for the compliance settings page — drives tab state.

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageToggle } from "@/components/localization/LanguageToggle";
import { NtsaDocumentChecklist } from "@/components/compliance/NtsaDocumentChecklist";
import { KraExportPanel } from "@/components/compliance/KraExportPanel";
import { DataProtectionPanel } from "@/components/compliance/DataProtectionPanel";
import { Globe, FileCheck, Receipt, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "language" | "documents" | "tax" | "privacy";

interface Props {
  userRole: string;
}

export function ComplianceSettingsClient({ userRole }: Props) {
  const { t } = useTranslation();
  const isRider = userRole === "RIDER";

  const tabs: { id: Tab; label: string; icon: React.ReactNode; riderOnly?: boolean }[] = [
    { id: "language", label: t("language_label"), icon: <Globe className="h-4 w-4" /> },
    { id: "documents", label: t("docs_title"), icon: <FileCheck className="h-4 w-4" />, riderOnly: true },
    { id: "tax", label: t("kra_title"), icon: <Receipt className="h-4 w-4" />, riderOnly: true },
    { id: "privacy", label: t("dpa_title"), icon: <Shield className="h-4 w-4" /> },
  ].filter((tab) => !tab.riderOnly || isRider);

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0].id);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          {/* No translation key needed — this is a page heading */}
          Compliance &amp; Localization
        </h1>
        <LanguageToggle />
      </div>

      {/* Tab bar */}
      <nav
        role="tablist"
        aria-label="Compliance settings"
        className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      <div>
        {activeTab === "language" && (
          <section
            id="panel-language"
            role="tabpanel"
            aria-label={t("language_label")}
            className="space-y-4"
          >
            <h2 className="text-base font-semibold text-foreground">{t("language_label")}</h2>
            <p className="text-sm text-muted-foreground">
              Choose the language used throughout the Pikii app.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-sm text-foreground">{t("language_english")}</span>
              <LanguageToggle />
              <span className="text-sm text-foreground">{t("language_swahili")}</span>
            </div>
          </section>
        )}

        {activeTab === "documents" && isRider && (
          <section id="panel-documents" role="tabpanel">
            <NtsaDocumentChecklist />
          </section>
        )}

        {activeTab === "tax" && isRider && (
          <section id="panel-tax" role="tabpanel">
            <KraExportPanel />
          </section>
        )}

        {activeTab === "privacy" && (
          <section id="panel-privacy" role="tabpanel">
            <DataProtectionPanel />
          </section>
        )}
      </div>
    </div>
  );
}
