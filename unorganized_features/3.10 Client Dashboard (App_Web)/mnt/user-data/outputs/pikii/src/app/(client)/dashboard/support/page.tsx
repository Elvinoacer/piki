import { getMyTickets } from "../actions";
import { SupportCenter } from "@/components/client-dashboard/SupportCenter";

export default async function SupportPage() {
  const tickets = await getMyTickets();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Help & Support</h1>
      <SupportCenter tickets={tickets} />
    </div>
  );
}
