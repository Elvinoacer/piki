"use client";
// components/rider/DocumentAlerts.tsx
// Document expiry alerts — PRD §3.9

import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { RiderDocument, DocumentVerificationStatus } from "@/types/rider-dashboard";

const VERIFICATION_STYLES: Record<
  DocumentVerificationStatus,
  { label: string; className: string; icon: string }
> = {
  VERIFIED: { label: "Verified", className: "text-emerald-600 bg-emerald-50", icon: "✓" },
  PENDING: { label: "Under Review", className: "text-amber-600 bg-amber-50", icon: "⏳" },
  REJECTED: { label: "Rejected", className: "text-red-600 bg-red-50", icon: "✕" },
  EXPIRED: { label: "Expired", className: "text-red-600 bg-red-50", icon: "!" },
};

function expiryBanner(doc: RiderDocument): {
  urgency: "critical" | "warning" | "ok" | "none";
  message: string;
} {
  if (doc.daysUntilExpiry === null) return { urgency: "none", message: "" };
  if (doc.daysUntilExpiry <= 0)
    return { urgency: "critical", message: "Expired — renew immediately" };
  if (doc.daysUntilExpiry <= 14)
    return {
      urgency: "critical",
      message: `Expires in ${doc.daysUntilExpiry} day${doc.daysUntilExpiry !== 1 ? "s" : ""}`,
    };
  if (doc.daysUntilExpiry <= 30)
    return {
      urgency: "warning",
      message: `Expires in ${doc.daysUntilExpiry} days`,
    };
  return { urgency: "ok", message: "" };
}

const URGENCY_STYLES = {
  critical: "bg-red-50 border-red-200",
  warning: "bg-amber-50 border-amber-200",
  ok: "bg-white border-gray-100",
  none: "bg-white border-gray-100",
};

export function DocumentAlerts() {
  const { documents } = useRiderDashboardStore();

  // Sort: critical → warning → ok
  const sorted = [...documents].sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2, none: 3 };
    return order[expiryBanner(a).urgency] - order[expiryBanner(b).urgency];
  });

  const criticalCount = sorted.filter(
    (d) => expiryBanner(d).urgency === "critical"
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-red-500 text-lg shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">
              {criticalCount} document{criticalCount !== 1 ? "s need" : " needs"} attention
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Expired documents may prevent you from going online.
            </p>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {sorted.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </ul>
    </div>
  );
}

function DocumentRow({ doc }: { doc: RiderDocument }) {
  const { urgency, message } = expiryBanner(doc);
  const verif = VERIFICATION_STYLES[doc.verificationStatus];
  const cardStyle = URGENCY_STYLES[urgency];

  const expiryFormatted = doc.expiryDate
    ? new Date(doc.expiryDate).toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <li
      className={`border rounded-xl p-4 flex items-start justify-between gap-3 ${cardStyle}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{doc.label}</p>

        {expiryFormatted && (
          <p
            className={`text-xs mt-0.5 font-medium ${
              urgency === "critical"
                ? "text-red-600"
                : urgency === "warning"
                ? "text-amber-600"
                : "text-gray-400"
            }`}
          >
            {urgency !== "ok" && urgency !== "none" ? (
              <span>{message}</span>
            ) : (
              <span>Expires {expiryFormatted}</span>
            )}
          </p>
        )}

        {doc.verificationStatus === "REJECTED" && (
          <p className="text-xs text-red-500 mt-1">
            Document rejected — please re-upload
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${verif.className}`}
        >
          {verif.icon} {verif.label}
        </span>
        {doc.fileUrl && (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 underline"
          >
            View
          </a>
        )}
      </div>
    </li>
  );
}
