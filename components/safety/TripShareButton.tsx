"use client";
// components/safety/TripShareButton.tsx
// Generates a shareable live-tracking link the client can send to a contact.

import { useState } from "react";
import { useSafetyStore } from "@/store/useSafetyStore";

interface TripShareButtonProps {
  tripId: string;
}

export function TripShareButton({ tripId }: TripShareButtonProps) {
  const { shareUrl, shareLoading, generateShareLink, clearShareLink } = useSafetyStore();
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!shareUrl) await generateShareLink(tripId);
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleNativeShare() {
    if (navigator.share && shareUrl) {
      navigator.share({
        title: "Track my Pikii ride",
        text: "Follow my live trip location:",
        url: shareUrl,
      });
    }
  }

  return (
    <div className="trip-share">
      {!shareUrl ? (
        <button
          className="trip-share__btn"
          onClick={handleGenerate}
          disabled={shareLoading}
          aria-label="Share live trip location"
        >
          {shareLoading ? "Generating link…" : "Share live location"}
        </button>
      ) : (
        <div className="trip-share__panel" role="region" aria-label="Share trip">
          <p className="trip-share__label">Send this link to a trusted contact</p>
          <div className="trip-share__url-row">
            <input
              className="trip-share__url"
              value={shareUrl}
              readOnly
              aria-label="Trip share link"
            />
            <button className="trip-share__copy" onClick={handleCopy} aria-label="Copy link">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="trip-share__actions">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button className="trip-share__native" onClick={handleNativeShare}>
                Share via…
              </button>
            )}
            <button className="trip-share__revoke" onClick={clearShareLink}>
              Stop sharing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
