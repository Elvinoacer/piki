// src/components/promotions/PromoBanner.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect } from "react";
import { useReferralStore } from "@/store/useReferralStore";
import type { BannerPlacement, Promotion } from "@/types/referral";
import { X, Tag } from "lucide-react";

interface Props {
  placement: BannerPlacement;
}

export function PromoBanner({ placement }: Props) {
  const { promotions, dismissedIds, isFetchingPromos, fetchPromotions, dismissPromotion, trackPromoClick } =
    useReferralStore();

  useEffect(() => {
    fetchPromotions(placement);
  }, [placement, fetchPromotions]);

  const visible = promotions.filter((p) => !dismissedIds.has(p.id));

  if (isFetchingPromos || visible.length === 0) return null;

  return (
    <div className="banner-stack" role="region" aria-label="Promotions">
      {visible.map((promo) => (
        <BannerItem
          key={promo.id}
          promo={promo}
          onDismiss={() => dismissPromotion(promo.id)}
          onCta={() => {
            trackPromoClick(promo.id);
            if (promo.ctaUrl) window.open(promo.ctaUrl, "_blank", "noopener");
          }}
        />
      ))}
      <style>{css}</style>
    </div>
  );
}

function BannerItem({
  promo,
  onDismiss,
  onCta,
}: {
  promo: Promotion;
  onDismiss: () => void;
  onCta: () => void;
}) {
  return (
    <div
      className="banner"
      role="article"
      aria-label={promo.title}
      style={promo.imageUrl ? { backgroundImage: `url(${promo.imageUrl})` } : {}}
    >
      {promo.imageUrl && <div className="banner-overlay" aria-hidden />}
      <div className="banner-body">
        <div className="banner-text">
          <p className="banner-title">{promo.title}</p>
          {promo.description && <p className="banner-desc">{promo.description}</p>}
          {promo.promoCode && (
            <div className="banner-code">
              <Tag size={12} aria-hidden />
              <span>Use code</span>
              <strong>{promo.promoCode.code}</strong>
            </div>
          )}
        </div>
        <div className="banner-actions">
          {promo.ctaLabel && (
            <button className="banner-cta" onClick={onCta}>
              {promo.ctaLabel}
            </button>
          )}
        </div>
      </div>
      <button
        className="banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss this promotion"
      >
        <X size={14} />
      </button>
    </div>
  );
}

const css = `
  .banner-stack { display: flex; flex-direction: column; gap: 10px; }
  .banner {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
    background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
    background-size: cover;
    background-position: center;
    padding: 16px;
    min-height: 90px;
  }
  .banner-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.45);
    border-radius: inherit;
  }
  .banner-body {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
  }
  .banner-text { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .banner-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #fff;
    margin: 0;
    line-height: 1.3;
  }
  .banner-desc {
    font-size: 0.78rem;
    color: rgba(255,255,255,0.85);
    margin: 0;
  }
  .banner-code {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,0.2);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 0.75rem;
    color: #fff;
    width: fit-content;
    margin-top: 2px;
  }
  .banner-code strong { letter-spacing: 0.06em; }
  .banner-actions { flex-shrink: 0; }
  .banner-cta {
    background: #fff;
    color: #f97316;
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s;
  }
  .banner-cta:hover { opacity: 0.9; }
  .banner-dismiss {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.3);
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    z-index: 2;
    transition: background 0.15s;
  }
  .banner-dismiss:hover { background: rgba(0,0,0,0.55); }
`;
