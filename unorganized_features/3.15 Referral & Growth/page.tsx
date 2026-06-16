// src/app/(client)/referral/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { ReferralCard } from "@/components/referral/ReferralCard";
import { ReferralHistory } from "@/components/referral/ReferralHistory";
import { LoyaltyWidget } from "@/components/referral/LoyaltyWidget";

export const metadata = {
  title: "Refer & Earn — Pikii",
  description: "Share your referral code and earn ride credits.",
};

export default function ClientReferralPage() {
  const loyaltyEnabled = process.env.NEXT_PUBLIC_LOYALTY_ENABLED === "true";

  return (
    <main className="ref-page">
      <header className="ref-page-header">
        <h1>Refer &amp; Earn</h1>
        <p>Invite friends to Pikii and both of you get ride credit.</p>
      </header>

      <div className="ref-page-body">
        <ReferralCard />
        {loyaltyEnabled && <LoyaltyWidget />}
        <ReferralHistory limit={20} />
      </div>

      <style>{`
        .ref-page {
          max-width: 480px;
          margin: 0 auto;
          padding: 20px 16px 40px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .ref-page-header h1 {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--color-text, #111827);
          margin: 0 0 4px;
        }
        .ref-page-header p {
          font-size: 0.875rem;
          color: var(--color-text-muted, #6b7280);
          margin: 0;
        }
        .ref-page-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
      `}</style>
    </main>
  );
}
