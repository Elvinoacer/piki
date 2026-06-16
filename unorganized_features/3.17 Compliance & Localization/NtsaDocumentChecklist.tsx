"use client";

// components/compliance/NtsaDocumentChecklist.tsx
// Renders the full NTSA document checklist for rider onboarding and the
// rider settings page. Each row shows status, expiry warning, and upload CTA.

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { NTSA_DOCUMENT_TYPES, type NtsaDocumentType, type DocumentStatus } from "@/lib/compliance/ntsa";
import { CheckCircle, Clock, AlertTriangle, XCircle, Upload, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface DocRow {
  type: NtsaDocumentType;
  status: DocumentStatus;
  fileUrl?: string | null;
  expiresAt?: string | null;
  verifiedAt?: string | null;
  uploadedAt?: string | null;
}

// ------------------------------------------------------------------
// Translation key per document type
// ------------------------------------------------------------------
const DOC_LABEL_KEYS: Record<NtsaDocumentType, string> = {
  NATIONAL_ID: "docs_national_id",
  DRIVING_LICENSE: "docs_driving_license",
  NTSA_PSV_BADGE: "docs_ntsa_badge",
  LOGBOOK: "docs_logbook",
  INSURANCE: "docs_insurance",
  PROFILE_PHOTO: "docs_photo",
} as const;

// ------------------------------------------------------------------
// Status icon + colour
// ------------------------------------------------------------------
function StatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation();
  const config: Record<DocumentStatus, { icon: React.ReactNode; className: string; labelKey: string }> = {
    verified: {
      icon: <CheckCircle className="h-4 w-4" />,
      className: "text-emerald-600",
      labelKey: "docs_status_verified",
    },
    pending: {
      icon: <Clock className="h-4 w-4" />,
      className: "text-amber-500",
      labelKey: "docs_status_pending",
    },
    expiring_soon: {
      icon: <AlertTriangle className="h-4 w-4" />,
      className: "text-amber-500",
      labelKey: "docs_status_verified",
    },
    expiring_critical: {
      icon: <AlertTriangle className="h-4 w-4" />,
      className: "text-orange-600",
      labelKey: "docs_expiry_critical",
    },
    expired: {
      icon: <XCircle className="h-4 w-4" />,
      className: "text-destructive",
      labelKey: "docs_status_expired",
    },
    missing: {
      icon: <XCircle className="h-4 w-4" />,
      className: "text-muted-foreground",
      labelKey: "docs_status_missing",
    },
  };

  const { icon, className, labelKey } = config[status];
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", className)}>
      {icon}
      {t(labelKey as any)}
    </span>
  );
}

// ------------------------------------------------------------------
// Single document row
// ------------------------------------------------------------------
function DocRow({
  doc,
  onUpload,
}: {
  doc: DocRow;
  onUpload: (type: NtsaDocumentType, file: File, expiresAt?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const expiryWarning = (() => {
    if (!doc.expiresAt) return null;
    const days = differenceInDays(new Date(doc.expiresAt), new Date());
    if (days <= 0) return t("docs_expiry_critical");
    if (days <= 7) return t("docs_expiry_warning", { days });
    if (days <= 30) return t("docs_expiry_warning", { days });
    return t("docs_expiry_label", { date: format(new Date(doc.expiresAt), "dd MMM yyyy") });
  })();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For expiring docs ask for expiry date — simplified: could use a date picker modal
    let expiresAt: string | undefined;
    const needsExpiry: NtsaDocumentType[] = ["DRIVING_LICENSE", "INSURANCE", "NTSA_PSV_BADGE"];
    if (needsExpiry.includes(doc.type)) {
      const raw = window.prompt("Expiry date (YYYY-MM-DD):");
      expiresAt = raw ?? undefined;
    }

    setUploading(true);
    try {
      await onUpload(doc.type, file, expiresAt);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasFile = !!doc.fileUrl;
  const isBlocking = doc.status === "missing" || doc.status === "expired" || doc.status === "expiring_critical";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-4 py-3",
        isBlocking ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {t(DOC_LABEL_KEYS[doc.type] as any)}
        </p>
        {expiryWarning && (
          <p
            className={cn(
              "mt-0.5 text-xs",
              doc.status === "expiring_critical" || doc.status === "expired"
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {expiryWarning}
          </p>
        )}
      </div>

      <StatusBadge status={doc.status} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
        aria-label={t(hasFile ? "docs_replace_cta" : "docs_upload_cta")}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || doc.status === "pending" || doc.status === "verified"}
        className={cn(
          "flex min-w-[44px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          doc.status === "verified"
            ? "cursor-default text-muted-foreground"
            : doc.status === "pending"
            ? "cursor-wait text-muted-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {uploading ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <Upload className="h-3 w-3" />
        )}
        {doc.status === "pending"
          ? t("docs_status_pending")
          : hasFile
          ? t("docs_replace_cta")
          : t("docs_upload_cta")}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// Main checklist component
// ------------------------------------------------------------------
interface NtsaDocumentChecklistProps {
  riderId?: string; // If omitted, fetches from /api/rider/documents
}

export function NtsaDocumentChecklist({ riderId: _riderId }: NtsaDocumentChecklistProps) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rider/documents");
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async (type: NtsaDocumentType, file: File, expiresAt?: string) => {
    // Step 1: Request presigned URL
    const presignRes = await fetch("/api/rider/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, fileName: file.name, mimeType: file.type, expiresAt }),
    });
    if (!presignRes.ok) return;
    const { uploadUrl } = await presignRes.json();

    // Step 2: PUT directly to storage
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

    // Step 3: Refresh list
    await fetchDocs();
  };

  const missingCount = docs.filter(
    (d) => d.status === "missing" || d.status === "expired"
  ).length;

  const allVerified = docs.length === NTSA_DOCUMENT_TYPES.length && missingCount === 0 &&
    docs.every((d) => d.status === "verified" || d.status === "expiring_soon");

  return (
    <section aria-label={t("docs_title")} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("docs_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("docs_subtitle")}</p>
      </div>

      {allVerified ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t("docs_checklist_complete")}
        </div>
      ) : missingCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("docs_checklist_incomplete", { count: missingCount })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t("docs_admin_note")}
        </div>
      )}

      <div className="space-y-2">
        {loading
          ? NTSA_DOCUMENT_TYPES.map((type) => (
              <div key={type} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))
          : docs.map((doc) => (
              <DocRow key={doc.type} doc={doc} onUpload={handleUpload} />
            ))}
      </div>
    </section>
  );
}
