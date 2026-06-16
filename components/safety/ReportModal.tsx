"use client";
// components/safety/ReportModal.tsx
// Lets a client or rider report and/or block another user.

import { useState } from "react";
import type { ReportReason } from "@/types/safety";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "UNSAFE_DRIVING", label: "Unsafe driving" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "WRONG_ROUTE", label: "Took wrong route" },
  { value: "OVERCHARGING", label: "Overcharged me" },
  { value: "FRAUD", label: "Fraud / scam" },
  { value: "IMPERSONATION", label: "Impersonating someone" },
  { value: "OTHER", label: "Other" },
];

interface ReportModalProps {
  reportedId: string;
  reportedName: string;
  tripId?: string;
  onClose: () => void;
}

export function ReportModal({ reportedId, reportedName, tripId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const reportRes = await fetch("/api/safety/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedId, tripId, reason, description }),
      });
      if (!reportRes.ok) throw new Error();

      if (alsoBlock) {
        await fetch("/api/safety/report/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedId: reportedId }),
        });
      }

      setDone(true);
    } catch {
      setError("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="report-modal" role="dialog" aria-modal="true" aria-label="Report user">
      <div className="report-modal__backdrop" onClick={onClose} />
      <div className="report-modal__sheet">
        {done ? (
          <div className="report-modal__done">
            <span className="report-modal__done-icon" aria-hidden="true">✅</span>
            <h2>Report submitted</h2>
            <p>
              Thanks for keeping Pikii safe. Our team will review this within 24 hours.
              {alsoBlock && " You've also blocked this user."}
            </p>
            <button className="report-modal__close" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="report-modal__header">
              <h2 className="report-modal__title">Report {reportedName}</h2>
              <button
                className="report-modal__x"
                onClick={onClose}
                aria-label="Close report dialog"
              >
                ✕
              </button>
            </div>

            <fieldset className="report-modal__reasons">
              <legend className="report-modal__reasons-label">What happened?</legend>
              {REASONS.map(({ value, label }) => (
                <label key={value} className="report-modal__reason-item">
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <textarea
              className="report-modal__description"
              placeholder="Tell us more (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              aria-label="Additional details"
            />

            <label className="report-modal__block-toggle">
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
              />
              <span>Also block {reportedName} from seeing my profile or requesting rides with me</span>
            </label>

            {error && (
              <p className="report-modal__error" role="alert">
                {error}
              </p>
            )}

            <div className="report-modal__actions">
              <button
                className="report-modal__submit"
                onClick={handleSubmit}
                disabled={submitting || !reason}
              >
                {submitting ? "Submitting…" : "Submit report"}
              </button>
              <button className="report-modal__cancel" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
