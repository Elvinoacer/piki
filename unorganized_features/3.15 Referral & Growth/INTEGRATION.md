# 3.15 Referral & Growth — Integration Notes

## Files created

### Data layer
| File | Purpose |
|------|---------|
| `prisma/referral.prisma` | New models — append to `schema.prisma`, run `prisma migrate dev` |
| `src/types/referral.ts` | All TS types & constants for this feature |
| `src/lib/referral/referral.service.ts` | Core business logic (server-only) |
| `src/store/useReferralStore.ts` | Zustand slice for client-side state |

### API routes
| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/referral/my-code` | GET | User | Get or create referral code |
| `/api/referral/stats` | GET | User | Referral stats + history |
| `/api/referral/redeem` | POST | User | Redeem a referral code at sign-up |
| `/api/referral/validate-promo` | POST | User | Validate promo code before booking |
| `/api/promotions` | GET | User | Active banners for a placement |
| `/api/promotions/[id]/click` | POST | Public | Click tracking |
| `/api/promotions/[id]/dismiss` | POST | User | Dismiss a banner |
| `/api/promotions/admin` | GET / POST | Admin | List / create promotions |
| `/api/promotions/admin/[id]` | PATCH / DELETE | Admin | Update / deactivate promotion |
| `/api/promotions/promo-codes` | GET / POST | Admin | List / create promo codes |
| `/api/loyalty` | GET | User | Loyalty account + history |

### Pages
| Path | Role | Purpose |
|------|------|---------|
| `(client)/referral/page.tsx` | Client | Referral + loyalty page |
| `(rider)/referral/page.tsx` | Rider | Referral page |
| `(admin)/promotions/page.tsx` | Admin | Manage banners |
| `(admin)/promotions/promo-codes/page.tsx` | Admin | Manage promo codes |

### Components
| Component | Where to use |
|-----------|-------------|
| `<ReferralCard />` | Client & Rider referral pages |
| `<ReferralHistory />` | Client & Rider referral pages |
| `<LoyaltyWidget />` | Client profile / referral page (gated) |
| `<PromoBanner placement="HOME" />` | Home screen, booking screen, etc. |
| `<PromoCodeInput fareAmount={...} onApply={...} onRemove={...} />` | Booking flow, payment screen |

---

## Integration checklist

### 1 — Prisma
```bash
# append prisma/referral.prisma contents to prisma/schema.prisma
# add the User relation fields listed at the bottom of the file
npx prisma migrate dev --name add_referral_growth
npx prisma generate
```

### 2 — nanoid dependency
```bash
npm install nanoid
```

### 3 — Env vars to add
```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_LOYALTY_ENABLED=false   # set true when Phase 4 is ready
```

### 4 — Post-trip hook
Call `qualifyReferral` and `earnLoyaltyPoints` when a trip status transitions to `COMPLETED`:

```ts
// Inside your trip-completion handler (route handler or server action)
import { qualifyReferral, earnLoyaltyPoints } from "@/lib/referral/referral.service";

// After trip record is marked COMPLETED:
await Promise.all([
  qualifyReferral(trip.clientId, trip.id),
  earnLoyaltyPoints(trip.clientId, Number(trip.fareTotal), trip.id),
]);
```

### 5 — Sign-up flow
Call `/api/referral/redeem` from the onboarding step where you show the "referral code" field:

```ts
// After user is created and session is active:
if (referralCodeInput) {
  await fetch("/api/referral/redeem", {
    method: "POST",
    body: JSON.stringify({ code: referralCodeInput }),
  });
}
```

### 6 — Add nav links
Add "Refer & Earn" to `(client)` and `(rider)` sidebars/bottom-nav pointing to `/referral`.
Add "Promotions" and "Promo Codes" to the `(admin)` sidebar.

### 7 — CSS variables
The components use these CSS variables (add to your global stylesheet if not already present):
```css
:root {
  --color-surface: #ffffff;
  --color-surface-alt: #f9fafb;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-accent: #f97316;   /* Pikii orange */
}
```

### 8 — Loyalty (Phase 4)
`LoyaltyWidget` and all loyalty API calls are already wired — just set `NEXT_PUBLIC_LOYALTY_ENABLED=true`
and optionally add a redemption flow in the payment screen.
