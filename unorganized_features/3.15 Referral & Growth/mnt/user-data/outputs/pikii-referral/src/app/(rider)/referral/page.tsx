// src/app/(rider)/referral/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { ReferralCard } from "@/components/referral/ReferralCard";
import { ReferralHistory } from "@/components/referral/ReferralHistory";

export const metadata = {
  title: "Refer Riders — Pikii",
  description: "Refer other riders and earn cash bonuses.",
};

export default function RiderReferralPage() {
  return (
    <main className="ref-page">
      <header className="ref-page-header">
        <h1>Refer Riders</h1>
        <p>
          Know someone who should be on Pikii? Share your code and earn{" "}
          <strong>KES 100</strong> when they complete their first trip.
        </p>
      </header>

      <div className="ref-page-body">
        <ReferralCard />
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
          line-height: 1.5;
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
