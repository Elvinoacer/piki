# Pikii — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** June 2026
**Stack:** Next.js 16+, Prisma 7+ (PostgreSQL), Zustand, TypeScript

---

## 1. Overview

### 1.1 Problem Statement

Bodaboda riders across Kenya rely on informal networks, stage queues, and word-of-mouth to find clients. Clients lack a reliable way to request rides or deliveries on demand, verify rider identity, agree on fair pricing, or track a ride in real time. There is no centralized platform connecting Kenyan bodaboda riders to passengers and delivery clients with safety, transparency, and trust built in.

### 1.2 Solution

Pikii is a real-time ride-hailing and delivery-matching platform connecting bodaboda riders with clients across Kenya. It supports passenger transport, package/parcel delivery, food/errand delivery, live GPS tracking, in-app payments (M-Pesa first), rider verification, ratings, and SACCO/fleet management tools — built as a SaaS that can scale per-county or be white-labeled for SACCOs.

### 1.3 Target Users

- **Riders (Bodaboda operators):** independent riders and SACCO/fleet-affiliated riders.
- **Clients (Passengers/Senders):** individuals needing transport, errands, or parcel delivery.
- **SACCOs / Fleet Operators:** organizations managing groups of riders, stages, and earnings.
- **Admins (Platform Operators):** Pikii staff managing operations, disputes, payouts, compliance.
- **Merchants/Businesses (future):** shops/restaurants using Pikii for last-mile delivery.

### 1.4 Goals

- Reduce client wait time and improve rider discoverability.
- Provide transparent, upfront, negotiable, or metered fare estimates.
- Increase rider trust/safety via verification, ratings, SOS, and trip tracking.
- Enable cashless and cash payments with reconciliation (M-Pesa STK Push primary).
- Provide SACCOs with fleet, earnings, and compliance dashboards.
- Generate revenue via commission, subscription tiers, and ad/promo placements.

---

## 2. Core User Roles & Permissions

| Role           | Capabilities                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Client         | Request rides/deliveries, track rider live, pay, rate, chat, view history, save favorite riders/locations                    |
| Rider          | Go online/offline, accept/reject requests, navigate, update status, view earnings, withdraw funds, manage profile/documents  |
| SACCO Admin    | Manage roster of riders, view fleet analytics, set commission splits, manage stage zones                                     |
| Platform Admin | User/rider verification, dispute resolution, pricing config, payouts, analytics, content moderation, broadcast notifications |
| Support Agent  | View/respond to tickets, access trip logs (read-only), issue refunds within limits                                           |

---

## 3. Feature Set

### 3.1 Authentication & Onboarding

- Phone number (OTP via SMS, primary identifier — Kenyan numbers) + optional email.
- Social login (Google) for clients.
- Role selection at signup: Client / Rider / SACCO Admin (with approval flow).
- Rider onboarding flow:
  - National ID upload & verification
  - Driving license (Class A/F) upload & expiry tracking
  - PSV/NTSA badge upload (if applicable)
  - Motorcycle logbook / number plate
  - Insurance certificate upload & expiry tracking
  - Profile photo (face match recommended)
  - Bank/M-Pesa details for payouts
  - Admin manual or automated (AI document check) approval before going "online"
- Multi-language support: English & Swahili (i18n from day one).

### 3.2 Real-Time Location & Matching

- Live GPS tracking for online riders (WebSocket/Pusher/Ably or self-hosted via `ws`).
- Geospatial rider discovery (PostGIS extension via Prisma raw queries — find nearest available riders within radius).
- Matching algorithm: proximity + rider rating + acceptance rate + idle time (fairness rotation).
- Auto-expanding search radius if no rider accepts within X seconds.
- Ride request broadcast to multiple nearby riders (first-accept-wins) or sequential dispatch.
- Real-time trip status updates: requested → accepted → arriving → arrived → in-progress → completed/cancelled.
- Live map view for client (rider's live position, ETA) and rider (client pin, route).
- Geofencing for service zones (county/town-based rollout control).

### 3.3 Ride & Delivery Types

- **Boda Ride (Passenger):** single passenger point-to-point.
- **Parcel/Errand Delivery:** send packages, documents, shopping items.
- **Food/Shop Delivery (future-ready schema):** integration point for merchants.
- **Scheduled Rides:** book in advance (date/time).
- **Multi-stop trips:** add stops along a route (extra fare per stop).

### 3.4 Pricing & Fare Engine

- Base fare + per-km + per-minute pricing, configurable per zone/county.
- Surge pricing during peak hours/weather/demand spikes (admin-configurable multipliers).
- Upfront fare estimate shown before booking.
- Optional fare negotiation mode (common in bodaboda culture) — client/rider can counter-offer within bounds.
- Distance/time calculated via route polyline (Google Maps/Mapbox Directions API).
- Cancellation fee logic (grace period, then fee if cancelled after rider en route).
- Promo codes & referral credits.

### 3.5 Payments

- **M-Pesa STK Push** (Daraja API) — primary payment method.
- Cash payment option (rider confirms receipt in-app).
- In-app wallet for clients (top-up, pay from balance) and riders (earnings balance).
- Rider payout/withdrawal to M-Pesa (B2C) — scheduled or on-demand, with minimum threshold.
- Commission auto-deduction per completed ride (configurable % per rider tier/SACCO).
- Transaction ledger (immutable record of all money movements) for reconciliation & audit.
- Invoice/receipt generation per trip (PDF, sent via SMS/email).
- Tipping feature.

### 3.6 Communication

- In-app masked chat (client ↔ rider) — phone numbers hidden until trip accepted.
- In-app masked calling (via Africa's Talking/Twilio number masking) — optional.
- Push notifications (trip status, promos, payout confirmations) via FCM/OneSignal.
- SMS fallback notifications for users without smartphones/low connectivity (Africa's Talking).
- Automated status messages (e.g., "Your rider is 3 mins away").

### 3.7 Safety Features

- SOS/Emergency button (shares live location with trusted contacts + platform safety team).
- Trip sharing (client can share live trip link with a friend/family).
- Rider identity verification badge displayed to client (photo, name, plate number, rating).
- Trip recording metadata (start/end GPS trail) stored for dispute resolution.
- Two-way rating & review system (1-5 stars + tags: "safe driving", "polite", "fast", etc.) — low ratings trigger review.
- Report/block user functionality.
- Helmet-verification reminder/checklist at onboarding (compliance nudge, not enforced via hardware).
- Night-mode safety alerts (optional check-ins for late trips).

### 3.8 Ratings, Reviews & Trust

- Post-trip rating (both directions).
- Aggregate rider score affects matching priority and tier eligibility.
- Badge system: "Verified", "Top Rated", "5-Star Streak", "SACCO Certified".
- Dispute flagging tied to specific trips.

### 3.9 Rider Dashboard (App/Web)

- Online/Offline toggle with status (Available, On Trip, Break).
- Incoming request cards with accept/decline + countdown timer.
- Earnings summary: today, week, month; breakdown by trip.
- Trip history with details and client ratings received.
- Withdrawal/payout requests + history.
- Performance stats: acceptance rate, completion rate, average rating, total distance.
- Document expiry alerts (license, insurance renewal reminders).
- Heatmap of demand zones (helps riders position themselves).

### 3.10 Client Dashboard (App/Web)

- Book ride/delivery (set pickup, destination, type).
- Live tracking map with rider ETA and details.
- Fare estimate before confirming.
- Payment method selection (M-Pesa, wallet, cash).
- Trip history with receipts.
- Saved places (Home, Work, frequent destinations).
- Favorite/preferred riders list.
- Promo codes & referral program (invite friends, earn credit).
- Support/help center & ticket submission.

### 3.11 SACCO / Fleet Management Module

- Onboard and manage a roster of riders under a SACCO.
- Set custom commission splits per rider or fleet-wide.
- View fleet-wide analytics: active riders, trips completed, total revenue, top performers.
- Bulk rider document verification queue.
- Stage/zone assignment for riders (e.g., assign riders to specific stages/towns).
- Payout management for affiliated riders (SACCO can manage disbursement or delegate to platform).
- Compliance reporting (license/insurance status across fleet).

### 3.12 Admin Panel (Web)

- User management (clients, riders, SACCOs) — view, suspend, verify, delete.
- Document verification queue (approve/reject rider documents with reason).
- Live operations map — view all active trips/riders across the country/zones.
- Pricing & zone configuration (base fares, surge rules, service areas).
- Promo code management (create, set limits, expiry, target segments).
- Dispute & support ticket management.
- Financial dashboard: total transaction volume, commission revenue, payout liabilities.
- Broadcast notifications (e.g., "Roadblock on Thika Rd — expect delays").
- Audit logs for all admin actions.
- Analytics: DAU/MAU, trip completion rate, average trip time, churn, retention cohorts.

### 3.13 Notifications System

- Push (FCM), SMS (Africa's Talking), in-app, and email channels.
- Event-driven triggers: ride matched, rider arriving, trip completed, payment received, document expiring, promo available, payout processed.
- User notification preferences (opt-in/out per channel where legally allowed).

### 3.14 Search, History & Receipts

- Trip history with filters (date range, type, status).
- Downloadable PDF receipts per trip.
- Full-text/location search for past pickup/dropoff addresses.

### 3.15 Referral & Growth

- Referral codes for both clients and riders (sign-up bonuses, ride credits).
- In-app promotions/banners (admin-managed).
- Loyalty points (optional future module — redeemable for ride discounts).

### 3.16 Monetization (SaaS Revenue Streams)

- Commission per completed trip (default model).
- Subscription tiers for riders (e.g., reduced commission for monthly subscribers — "Pikii Pro").
- SACCO/Fleet subscription plans (per-seat pricing for fleet management tools).
- In-app advertising/sponsored placements (local businesses targeting riders/clients by zone).
- Premium client features (priority matching, scheduled rides, multiple saved riders) — optional "Client Plus" tier.

### 3.17 Compliance & Localization

- NTSA-aligned document checklist for riders.
- KRA-ready transaction records (export for tax purposes).
- Data protection aligned with Kenya's Data Protection Act, 2019 (consent management, data export/delete requests).
- Swahili/English toggle throughout the app.
- Offline-tolerant UX patterns (graceful handling of poor connectivity — common in rural zones).

---

## 4. Technical Architecture

### 4.1 Stack

- **Frontend/Backend:** Next.js 16+ (App Router, Server Actions, Route Handlers for API).
- **State Management:** Zustand (client-side state: active trip, map state, UI state, auth session cache).
- **Database:** PostgreSQL with PostGIS extension (geospatial queries).
- **ORM:** Prisma 7+ (with `previewFeatures` for native PostGIS support or raw SQL via `$queryRaw` for geo queries until first-class support matures).
- **Real-time:** WebSocket layer (Pusher Channels, Ably, or self-hosted Socket.IO/`ws` server alongside Next.js) for live location & trip status.
- **Maps & Routing:** Google Maps Platform or Mapbox (Directions, Distance Matrix, Geocoding).
- **Payments:** Safaricom Daraja API (M-Pesa STK Push, B2C).
- **SMS/USSD:** Africa's Talking.
- **Push Notifications:** Firebase Cloud Messaging or OneSignal.
- **File Storage:** S3-compatible bucket (rider documents, profile photos) — e.g., Cloudflare R2 or AWS S3.
- **Auth:** NextAuth.js / Auth.js with phone-OTP custom provider + Google OAuth.
- **Background Jobs:** Queue system (BullMQ + Redis) for payouts, notification dispatch, document-expiry checks.
- **Hosting:** Vercel (frontend/API) + managed Postgres (Supabase/Neon/RDS with PostGIS) + Redis (Upstash).

### 4.2 High-Level Data Model (Prisma — entity overview)

- `User` (base identity: phone, email, role, status)
- `RiderProfile` (linked to User: vehicle info, documents, verification status, current location, online status, rating, SACCO link)
- `ClientProfile` (linked to User: saved places, preferred payment method)
- `SaccoOrg` (SACCO/fleet entity: name, commission rules, members)
- `Trip` (pickup/dropoff coords & addresses, type, status, fare breakdown, timestamps, rider/client refs)
- `TripStop` (multi-stop support, ordered list per trip)
- `Payment` (transaction record: method, amount, status, M-Pesa receipt ref, linked to Trip)
- `Wallet` (balance per User — client or rider)
- `WalletTransaction` (ledger entries: credit/debit, reason, reference)
- `Payout` (rider withdrawal requests: amount, status, M-Pesa B2C ref)
- `Rating` (trip-linked, bidirectional)
- `PromoCode` / `Redemption`
- `Notification` (in-app log)
- `Document` (rider compliance docs: type, file URL, expiry date, verification status)
- `Zone` (service area/geofence config, pricing rules)
- `SupportTicket` / `TicketMessage`
- `AuditLog` (admin actions)

### 4.3 Real-Time Flow (Trip Lifecycle)

1. Client submits trip request (pickup, dropoff, type) → fare estimate calculated.
2. Server queries nearby online riders (PostGIS radius query) ranked by score.
3. Request broadcast via WebSocket to candidate riders; countdown timer per rider.
4. First rider to accept is assigned; others notified "request taken".
5. Trip status updates pushed in real time to client (rider location stream begins).
6. On arrival/start/completion, status transitions trigger payment flow + notifications.
7. Post-trip: rating prompts, receipt generation, wallet/commission updates.

### 4.4 Zustand State Slices (suggested)

- `useAuthStore` — session, role, onboarding status.
- `useTripStore` — active trip state, status, polyline, ETA.
- `useLocationStore` — current device location, rider online status.
- `useMapStore` — map viewport, markers.
- `useNotificationStore` — unread counts, toast queue.
- `useWalletStore` — balance, recent transactions.

---

## 5. Non-Functional Requirements

- **Performance:** Trip-matching response < 5s in urban zones with adequate rider density.
- **Scalability:** Architecture must support county-by-county rollout without re-architecture.
- **Reliability:** Payment operations must be idempotent (handle M-Pesa callback retries safely).
- **Security:** All PII encrypted at rest; rider documents in private buckets with signed URLs; rate-limiting on OTP endpoints.
- **Offline resilience:** Queue location updates and retry on reconnect (common with patchy rural connectivity).
- **Accessibility:** Large-tap-target UI (riders often use mid-range Android devices with one hand while on a boda).

---

## 6. Phased Roadmap

### Phase 1 — MVP (Launch in 1-2 towns)

- Auth (phone OTP), rider onboarding & verification, client/rider apps, basic ride request & matching, live tracking, fare estimate, cash payment, ratings, push/SMS notifications, basic admin panel.

### Phase 2 — Payments & Growth

- M-Pesa STK Push + wallet, commission engine, payouts (B2C), promo codes/referrals, parcel delivery type, in-app chat, SOS button.

### Phase 3 — Scale & Fleet Tools

- SACCO module, surge pricing, scheduled rides, multi-stop trips, heatmaps, subscription tiers (rider Pro, SACCO plans), advanced admin analytics, multi-county expansion.

### Phase 4 — Ecosystem

- Merchant/food delivery integration, loyalty points, in-app ads/sponsorships, AI-assisted document verification, demand forecasting.

---

## 7. Success Metrics (KPIs)

- Weekly active riders & clients per zone.
- Trip completion rate (target >85%).
- Average matching time.
- Rider acceptance rate.
- GMV (gross merchandise value) and commission revenue.
- Rider retention (30/60/90-day).
- Client repeat-ride rate.
- Average rating (riders & clients).
- Dispute rate per 1,000 trips.

---

## 8. Open Questions / Decisions Needed

- Default pricing model: metered fare vs. negotiation-first vs. hybrid (toggle per zone)?
- Initial launch zone(s) and rider acquisition strategy (SACCO partnerships vs. individual sign-ups)?
- Helmet/safety gear — informational only or tied to a verification gate?
- Cash vs. cashless mix expected at launch — affects payout/commission collection design (cash trips still owe commission, requiring a "debt" ledger against rider wallet).
- Real-time infra choice: managed (Pusher/Ably cost at scale) vs. self-hosted Socket.IO (ops overhead).
