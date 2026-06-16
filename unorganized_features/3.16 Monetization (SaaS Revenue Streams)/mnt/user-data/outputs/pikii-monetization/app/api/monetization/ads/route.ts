// app/api/monetization/ads/route.ts
// GET  /api/monetization/ads?placement=HOME_BANNER&audience=CLIENTS&zoneId=...
//       — serve the best available ad for a slot
// POST /api/monetization/ads/click
//       — record a click event (called from the client after user taps CTA)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { serveAd, recordAdClick } from "@/lib/monetization/ad-service";
import type { AdAudience, AdPlacement } from "@/types/monetization";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // Ads can be served to unauthenticated clients in some placements, but
  // we capture userId for authenticated users for better targeting.
  const userId = session?.user?.id;

  const placement = req.nextUrl.searchParams.get("placement") as AdPlacement | null;
  const audience = req.nextUrl.searchParams.get("audience") as AdAudience | null;
  const zoneId = req.nextUrl.searchParams.get("zoneId") ?? undefined;

  if (!placement || !audience) {
    return NextResponse.json(
      { error: "placement and audience query params are required." },
      { status: 400 }
    );
  }

  try {
    const ad = await serveAd({ placement, audience, zoneId, userId });
    // Return 204 (no content) if no ad is available — the client hides the slot silently
    if (!ad) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ data: { ad } });
  } catch (err) {
    console.error("[ads GET]", err);
    return NextResponse.json(
      { error: "Failed to serve ad." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const body = await req.json();
  const { campaignId, zoneId } = body as { campaignId?: string; zoneId?: string };

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
  }

  try {
    await recordAdClick(campaignId, userId, zoneId);
    return NextResponse.json({ data: { recorded: true } });
  } catch (err) {
    console.error("[ads POST click]", err);
    return NextResponse.json(
      { error: "Failed to record click." },
      { status: 500 }
    );
  }
}
