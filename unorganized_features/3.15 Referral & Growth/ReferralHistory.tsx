// src/components/referral/ReferralHistory.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import type { ReferralRedemption, ReferralStatus } from "@/types/referral";
import { CheckCircle2, Clock, XCircle, Star } from "lucide-react";

interface Props {
  limit?: number;
}

const STATUS_META: Record<
  ReferralStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  PENDING: { label: "Signed up", icon: <Clock size={14} />, color: "#f59e0b" },
  QUALIFIED: { label: "First trip done", icon: <Star size={14} />, color: "#3b82f6" },
  PAID: { label: "Bonus paid", icon: <CheckCircle2 size={14} />, color: "#10b981" },
  EXPIRED: { label: "Expired", icon: <XCircle size={14} />, color: "#9ca3af" },
  CANCELLED: { label: "Cancelled", icon: <XCircle size={14} />, color: "#ef4444" },
};

export function ReferralHistory({ limit = 10 }: Props) {
  const [referrals, setReferrals] = useState<ReferralRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/referral/stats")
      .then((r) => r.json())
      .then((data) => setReferrals(data.referrals ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shown = referrals.slice(0, limit);

  if (loading) {
    return (
      <div className="rh-wrap">
        <h3 className="rh-heading">Your Referrals</h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rh-skeleton" />
        ))}
        <style>{sharedCss}</style>
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div className="rh-wrap">
        <h3 className="rh-heading">Your Referrals</h3>
        <div className="rh-empty">
          <span>🛵</span>
          <p>No referrals yet. Share your code and start earning!</p>
        </div>
        <style>{sharedCss}</style>
      </div>
    );
  }

  return (
    <div className="rh-wrap">
      <h3 className="rh-heading">Your Referrals</h3>
      <ul className="rh-list">
        {shown.map((r) => {
          const meta = STATUS_META[r.status];
          const initials = (r.referee?.name ?? "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <li key={r.id} className="rh-item">
              <div className="rh-avatar" aria-hidden>
                {initials}
              </div>
              <div className="rh-info">
                <span className="rh-name">{r.referee?.name ?? "New user"}</span>
                <span className="rh-date">
                  {new Date(r.createdAt).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="rh-status-wrap">
                <span
                  className="rh-status"
                  style={{ color: meta.color, borderColor: meta.color }}
                >
                  {meta.icon}
                  {meta.label}
                </span>
                {r.status === "PAID" && (
                  <span className="rh-bonus">
                    +KES {Number(r.referrerBonus).toLocaleString()}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <style>{sharedCss}</style>
    </div>
  );
}

const sharedCss = `
  .rh-wrap { display: flex; flex-direction: column; gap: 12px; }
  .rh-heading {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0;
  }
  .rh-skeleton {
    height: 56px;
    border-radius: 10px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .rh-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.85rem;
    text-align: center;
  }
  .rh-empty span { font-size: 2rem; }
  .rh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rh-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--color-surface-alt, #f9fafb);
    border-radius: 10px;
  }
  .rh-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--color-accent, #f97316);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .rh-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rh-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-date { font-size: 0.75rem; color: var(--color-text-muted, #6b7280); }
  .rh-status-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .rh-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid;
    border-radius: 99px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  .rh-bonus {
    font-size: 0.78rem;
    font-weight: 700;
    color: #10b981;
  }
`;
