// src/components/referral/ReferralCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { useReferralStore } from "@/store/useReferralStore";
import { Share2, Copy, Check, Users, Coins, Clock } from "lucide-react";

export function ReferralCard() {
  const { myCode, stats, isFetchingCode, fetchMyCode, fetchStats } = useReferralStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMyCode();
    fetchStats();
  }, [fetchMyCode, fetchStats]);

  const shareUrl = myCode
    ? `${process.env.NEXT_PUBLIC_APP_URL}/join?ref=${myCode.code}`
    : "";

  function copyCode() {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    if (!myCode || !navigator.share) {
      copyCode();
      return;
    }
    try {
      await navigator.share({
        title: "Join me on Pikii",
        text: `Use my code ${myCode.code} when you sign up and we both get a free ride credit!`,
        url: shareUrl,
      });
    } catch {
      // user cancelled or not supported
    }
  }

  const bonusKes = myCode ? Number(myCode.bonusAmount) : 0;

  return (
    <section className="pikii-card" aria-label="Your referral code">
      {/* Header */}
      <div className="ref-header">
        <div>
          <h2 className="ref-title">Refer &amp; Earn</h2>
          <p className="ref-subtitle">
            Share your code — you both get{" "}
            <strong>KES {bonusKes.toLocaleString()}</strong> ride credit after their
            first trip.
          </p>
        </div>
        <span className="ref-badge" aria-hidden>🛵</span>
      </div>

      {/* Code display */}
      <div className="code-row">
        {isFetchingCode ? (
          <div className="code-skeleton" aria-label="Loading your code…" />
        ) : (
          <>
            <span className="code-text" aria-label={`Your referral code: ${myCode?.code}`}>
              {myCode?.code ?? "—"}
            </span>
            <button
              className="icon-btn"
              onClick={copyCode}
              disabled={!myCode}
              aria-label={copied ? "Code copied" : "Copy code"}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <button
              className="share-btn"
              onClick={nativeShare}
              disabled={!myCode}
              aria-label="Share your referral code"
            >
              <Share2 size={16} />
              Share
            </button>
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="stats-row" aria-label="Referral stats">
        <StatPill icon={<Users size={14} />} label="Referred" value={stats?.totalReferrals ?? 0} />
        <StatPill
          icon={<Coins size={14} />}
          label="Earned (KES)"
          value={`${(stats?.totalEarned ?? 0).toLocaleString()}`}
        />
        <StatPill
          icon={<Clock size={14} />}
          label="Pending (KES)"
          value={`${(stats?.pendingEarnings ?? 0).toLocaleString()}`}
          muted
        />
      </div>

      <style>{`
        .pikii-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ref-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .ref-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-text, #111827);
          margin: 0 0 4px;
        }
        .ref-subtitle {
          font-size: 0.85rem;
          color: var(--color-text-muted, #6b7280);
          margin: 0;
          line-height: 1.4;
        }
        .ref-badge { font-size: 2rem; flex-shrink: 0; }
        .code-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--color-surface-alt, #f9fafb);
          border: 1.5px dashed var(--color-accent, #f97316);
          border-radius: 10px;
          padding: 10px 14px;
        }
        .code-text {
          flex: 1;
          font-family: ui-monospace, monospace;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--color-accent, #f97316);
        }
        .code-skeleton {
          flex: 1;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-muted, #6b7280);
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .icon-btn:hover:not(:disabled) { color: var(--color-accent, #f97316); }
        .icon-btn:disabled { opacity: 0.4; cursor: default; }
        .share-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: var(--color-accent, #f97316);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .share-btn:hover:not(:disabled) { opacity: 0.9; }
        .share-btn:disabled { opacity: 0.4; cursor: default; }
        .stats-row {
          display: flex;
          gap: 10px;
        }
        .stat-pill {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: var(--color-surface-alt, #f9fafb);
          border-radius: 10px;
          padding: 10px 6px;
        }
        .stat-icon { color: var(--color-text-muted, #6b7280); }
        .stat-value {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text, #111827);
        }
        .stat-value.muted { color: var(--color-text-muted, #6b7280); }
        .stat-label {
          font-size: 0.7rem;
          color: var(--color-text-muted, #6b7280);
          text-align: center;
        }
      `}</style>
    </section>
  );
}

function StatPill({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  muted?: boolean;
}) {
  return (
    <div className="stat-pill">
      <span className="stat-icon">{icon}</span>
      <span className={`stat-value${muted ? " muted" : ""}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
