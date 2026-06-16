import { getReferralInfo } from "../actions";
import { ReferralCard } from "@/components/client-dashboard/ReferralCard";

export default async function PromosPage() {
  const referral = await getReferralInfo();

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Promos & Referrals</h1>
      <ReferralCard referral={referral} />
    </div>
  );
}
