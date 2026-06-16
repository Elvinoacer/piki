// src/components/sacco/ComplianceReport.tsx
"use client";

import { useState, useTransition } from "react";
import type { ComplianceRiderDTO, VerificationResult } from "@/types/sacco";
import { runBulkVerification } from "@/lib/sacco/actions";
import { CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_LABELS: Record<ComplianceRiderDTO["overallStatus"], { label: string; cls: string }> = {
  COMPLIANT: { label: "Compliant", cls: "bg-emerald-50 text-emerald-700" },
  EXPIRING_SOON: { label: "Expiring Soon", cls: "bg-amber-50 text-amber-700" },
  EXPIRED: { label: "Expired", cls: "bg-red-50 text-red-700" },
  MISSING: { label: "Docs Missing", cls: "bg-purple-50 text-purple-700" },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  NATIONAL_ID: "National ID",
  DRIVING_LICENSE: "Driving License",
  LOGBOOK: "Logbook",
  INSURANCE: "Insurance",
  PSV_BADGE: "PSV Badge",
};

interface BulkItem {
  documentId: string;
  result: VerificationResult;
  reviewNote: string;
}

interface Props {
  riders: ComplianceRiderDTO[];
  saccoId: string;
}

export default function ComplianceReport({ riders, saccoId }: Props) {
  const [filter, setFilter] = useState<ComplianceRiderDTO["overallStatus"] | "ALL">("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bulkQueue, setBulkQueue] = useState<BulkItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const visible = filter === "ALL" ? riders : riders.filter((r) => r.overallStatus === filter);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setDocResult(
    documentId: string,
    result: VerificationResult,
    note = ""
  ) {
    setBulkQueue((prev) => {
      const existing = prev.findIndex((i) => i.documentId === documentId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { documentId, result, reviewNote: note };
        return updated;
      }
      return [...prev, { documentId, result, reviewNote: note }];
    });
  }

  function handleSubmitBulk() {
    if (bulkQueue.length === 0) return;
    startTransition(async () => {
      await runBulkVerification(saccoId, { items: bulkQueue });
      setBulkQueue([]);
      setSubmitted(true);
    });
  }

  const FILTERS: Array<{ value: typeof filter; label: string }> = [
    { value: "ALL", label: "All" },
    { value: "EXPIRED", label: "Expired" },
    { value: "EXPIRING_SOON", label: "Expiring Soon" },
    { value: "MISSING", label: "Missing Docs" },
    { value: "COMPLIANT", label: "Compliant" },
  ];

  return (
    <div>
      {/* Bulk queue banner */}
      {bulkQueue.length > 0 && (
        <div className="mb-4 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <p className="text-sm text-indigo-700 font-medium">
            {bulkQueue.length} document{bulkQueue.length > 1 ? "s" : ""} queued for bulk review
          </p>
          <button
            disabled={isPending}
            onClick={handleSubmitBulk}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "Processing…" : "Submit All"}
          </button>
        </div>
      )}

      {submitted && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
          ✓ Bulk verification submitted successfully.
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
              filter === f.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rider rows */}
      <div className="space-y-2">
        {visible.map((rider) => {
          const isOpen = expanded.has(rider.riderProfileId);
          const status = STATUS_LABELS[rider.overallStatus];
          return (
            <div
              key={rider.riderProfileId}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Row header */}
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
                onClick={() => toggleExpand(rider.riderProfileId)}
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center overflow-hidden">
                  {rider.avatarUrl ? (
                    <img src={rider.avatarUrl} alt={rider.riderName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-indigo-600">{rider.riderName[0]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{rider.riderName}</p>
                  <p className="text-xs text-gray-400">{rider.phone}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
                  {status.label}
                </span>
                {isOpen ? (
                  <ChevronUp size={14} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                )}
              </button>

              {/* Expanded doc list */}
              {isOpen && (
                <div className="px-5 pb-4 border-t border-gray-50 pt-3 space-y-2">
                  {rider.documents.map((doc) => {
                    const queued = bulkQueue.find((q) => q.documentId === doc.id);
                    return (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center gap-3 text-sm"
                      >
                        <FileText size={14} className="text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-700 w-32">
                          {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            doc.verificationStatus === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700"
                              : doc.verificationStatus === "REJECTED"
                              ? "bg-red-50 text-red-700"
                              : doc.verificationStatus === "EXPIRED"
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {doc.verificationStatus}
                        </span>
                        {doc.expiryDate && (
                          <span
                            className={`text-xs ${
                              (doc.daysUntilExpiry ?? 9999) < 0
                                ? "text-red-500 font-semibold"
                                : (doc.daysUntilExpiry ?? 9999) <= 30
                                ? "text-amber-500 font-medium"
                                : "text-gray-400"
                            }`}
                          >
                            Exp:{" "}
                            {new Date(doc.expiryDate).toLocaleDateString("en-KE")}
                            {doc.daysUntilExpiry !== null && doc.daysUntilExpiry >= 0
                              ? ` (${doc.daysUntilExpiry}d)`
                              : doc.daysUntilExpiry !== null
                              ? " (EXPIRED)"
                              : ""}
                          </span>
                        )}

                        {/* Quick review buttons */}
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => setDocResult(doc.id, "APPROVED")}
                            className={`p-1.5 rounded-lg transition ${
                              queued?.result === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "text-gray-300 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title="Approve"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => setDocResult(doc.id, "REJECTED")}
                            className={`p-1.5 rounded-lg transition ${
                              queued?.result === "REJECTED"
                                ? "bg-red-100 text-red-600"
                                : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                            }`}
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            onClick={() => setDocResult(doc.id, "NEEDS_REVIEW")}
                            className={`p-1.5 rounded-lg transition ${
                              queued?.result === "NEEDS_REVIEW"
                                ? "bg-amber-100 text-amber-700"
                                : "text-gray-300 hover:text-amber-600 hover:bg-amber-50"
                            }`}
                            title="Flag for review"
                          >
                            <Clock size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {rider.documents.length === 0 && (
                    <p className="text-xs text-gray-400 py-2">
                      No documents uploaded yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">
            No riders match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
