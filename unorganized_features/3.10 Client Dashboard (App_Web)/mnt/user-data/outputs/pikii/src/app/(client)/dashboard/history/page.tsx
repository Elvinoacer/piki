import { getTripHistory } from "../actions";
import { TripHistoryList } from "@/components/client-dashboard/TripHistoryList";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function TripHistoryPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));

  const { trips, total } = await getTripHistory(page);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Trip History</h1>
      <TripHistoryList trips={trips} total={total} page={page} />
    </div>
  );
}
