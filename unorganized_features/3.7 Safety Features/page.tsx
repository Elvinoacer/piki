// app/(app)/track/[token]/page.tsx
// Public-facing live trip tracker — no login required.
// Shown to friends/family who receive a trip share link.

import { getTripSharePublicView } from "@/lib/safety/safety.service";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: { token: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await getTripSharePublicView(params.token);
  if (!view) return { title: "Trip not found — Pikii" };
  return {
    title: `Tracking ${view.riderName}'s ride — Pikii`,
    description: "Follow this live Pikii trip in real time.",
  };
}

export default async function TripTrackPage({ params }: Props) {
  const view = await getTripSharePublicView(params.token);
  if (!view) notFound();

  const mapsEmbedUrl = view.riderLat && view.riderLng
    ? `https://www.google.com/maps?q=${view.riderLat},${view.riderLng}&output=embed`
    : `https://www.google.com/maps?q=${view.pickup.lat},${view.pickup.lng}&output=embed`;

  return (
    <main className="trip-track-page">
      <header className="trip-track-page__header">
        <span className="trip-track-page__logo">Pikii</span>
        <span className="trip-track-page__status">{formatStatus(view.status)}</span>
      </header>

      {/* Live map */}
      <div className="trip-track-page__map-wrap">
        <iframe
          className="trip-track-page__map"
          src={mapsEmbedUrl}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Live rider location"
        />
      </div>

      {/* Rider card */}
      <section className="trip-track-page__rider-card">
        <div className="trip-track-page__rider-avatar">
          {view.riderPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.riderPhoto} alt={view.riderName} />
          ) : (
            <span>{view.riderName.charAt(0)}</span>
          )}
        </div>
        <div className="trip-track-page__rider-info">
          <strong>{view.riderName}</strong>
          <span className="trip-track-page__plate">{view.riderPlate}</span>
          <span className="trip-track-page__rating">
            ★ {view.riderRating.toFixed(1)}
          </span>
        </div>
      </section>

      {/* Route summary */}
      <section className="trip-track-page__route">
        <div className="trip-track-page__route-row">
          <span className="trip-track-page__dot trip-track-page__dot--pickup" aria-hidden="true" />
          <span>{view.pickup.address}</span>
        </div>
        <div className="trip-track-page__route-row">
          <span className="trip-track-page__dot trip-track-page__dot--dropoff" aria-hidden="true" />
          <span>{view.dropoff.address}</span>
        </div>
      </section>

      <p className="trip-track-page__footer">
        This link was shared by someone on a Pikii trip. It expires after 24 hours.
      </p>
    </main>
  );
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    requested: "Looking for rider…",
    accepted: "Rider on the way",
    arriving: "Rider arriving",
    arrived: "Rider has arrived",
    "in-progress": "Trip in progress",
    completed: "Trip completed",
    cancelled: "Trip cancelled",
  };
  return map[status] ?? status;
}
