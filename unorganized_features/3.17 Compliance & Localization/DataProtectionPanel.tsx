"use client";

// components/compliance/DataProtectionPanel.tsx
// Kenya Data Protection Act, 2019 compliance UI.
// Covers consent management, data export request, and account deletion.

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Shield, Download, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DpaRight } from "@/lib/compliance/dpa";
import { DPA_SUBJECT_RIGHTS } from "@/lib/compliance/dpa";

// ------------------------------------------------------------------
// Consent toggle row
// ------------------------------------------------------------------
function ConsentToggle({
  labelKey,
  checked,
  onChange,
  required,
}: {
  labelKey: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const id = `consent-${labelKey}`;
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-required={required}
        onClick={() => { if (!required || !checked) onChange(!checked); }}
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-muted",
          required && checked && "cursor-not-allowed opacity-80"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {t(labelKey as any)}
        {required && <span className="ml-1 text-xs text-muted-foreground">(required)</span>}
      </label>
    </div>
  );
}

// ------------------------------------------------------------------
// Collapsible rights section
// ------------------------------------------------------------------
function RightsAccordion() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          {t("dpa_rights_heading")}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <ul className="space-y-2" role="list">
            {DPA_SUBJECT_RIGHTS.map((right: DpaRight) => (
              <li key={right} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(right as any)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("dpa_contact")}</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Delete confirmation modal
// ------------------------------------------------------------------
function DeleteConfirmModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-background px-5 py-6 shadow-xl sm:rounded-xl">
        <h3 className="text-base font-semibold text-foreground">{t("dpa_delete_confirm_title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("dpa_delete_confirm_body")}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {loading ? t("loading") : t("dpa_delete_confirm_cta")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main panel
// ------------------------------------------------------------------
interface ConsentState {
  location: boolean;
  marketing: boolean;
  analytics: boolean;
}

export function DataProtectionPanel() {
  const { t } = useTranslation();
  const [consent, setConsent] = useState<ConsentState>({
    location: true,
    marketing: false,
    analytics: false,
  });
  const [consentSaving, setConsentSaving] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "requested">("idle");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "confirming" | "loading" | "done">("idle");

  // Load saved consent on mount
  useEffect(() => {
    fetch("/api/compliance/consent")
      .then((r) => r.json())
      .then((data) => {
        if (data) setConsent({ location: data.location, marketing: data.marketing, analytics: data.analytics });
      })
      .catch(() => {});
  }, []);

  const saveConsent = async (next: ConsentState) => {
    setConsent(next);
    setConsentSaving(true);
    try {
      await fetch("/api/compliance/consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } finally {
      setConsentSaving(false);
    }
  };

  const requestExport = async () => {
    setExportStatus("loading");
    try {
      await fetch("/api/compliance/data-export", { method: "POST" });
      setExportStatus("requested");
    } catch {
      setExportStatus("idle");
    }
  };

  const requestDeletion = async () => {
    setDeleteStatus("loading");
    try {
      await fetch("/api/compliance/account-deletion", { method: "POST" });
      setDeleteStatus("done");
    } catch {
      setDeleteStatus("idle");
    }
  };

  return (
    <section aria-label={t("dpa_title")} className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("dpa_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("dpa_subtitle")}</p>
      </div>

      {/* Consent toggles */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t("dpa_consent_heading")}</h3>
        <ConsentToggle
          labelKey="dpa_consent_location"
          checked={consent.location}
          onChange={(v) => saveConsent({ ...consent, location: v })}
          required
        />
        <ConsentToggle
          labelKey="dpa_consent_marketing"
          checked={consent.marketing}
          onChange={(v) => saveConsent({ ...consent, marketing: v })}
        />
        <ConsentToggle
          labelKey="dpa_consent_analytics"
          checked={consent.analytics}
          onChange={(v) => saveConsent({ ...consent, analytics: v })}
        />
        {consentSaving && <p className="text-xs text-muted-foreground">{t("loading")}</p>}
      </div>

      <hr className="border-border" />

      {/* Data export */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">{t("dpa_export_heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("dpa_export_body")}</p>
        {exportStatus === "requested" ? (
          <p className="text-sm text-emerald-600">{t("dpa_export_processing")}</p>
        ) : (
          <button
            onClick={requestExport}
            disabled={exportStatus === "loading"}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium",
              "text-foreground transition-colors hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-wait disabled:opacity-60"
            )}
          >
            <Download className="h-4 w-4" />
            {exportStatus === "loading" ? t("loading") : t("dpa_export_cta")}
          </button>
        )}
      </div>

      <hr className="border-border" />

      {/* Rights accordion */}
      <RightsAccordion />

      <hr className="border-border" />

      {/* Account deletion */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">{t("dpa_delete_heading")}</h3>
        <p className="text-sm text-muted-foreground">{t("dpa_delete_body")}</p>
        {deleteStatus === "done" ? (
          <p className="text-sm text-muted-foreground">{t("dpa_delete_confirm_body")}</p>
        ) : (
          <button
            onClick={() => setDeleteStatus("confirming")}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-destructive/40 px-4 py-2.5 text-sm font-medium",
              "text-destructive transition-colors hover:bg-destructive/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            )}
          >
            <Trash2 className="h-4 w-4" />
            {t("dpa_delete_cta")}
          </button>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteStatus === "confirming" && (
        <DeleteConfirmModal
          onConfirm={requestDeletion}
          onCancel={() => setDeleteStatus("idle")}
          loading={false}
        />
      )}
    </section>
  );
}
