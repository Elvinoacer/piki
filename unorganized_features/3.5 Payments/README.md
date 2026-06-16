# Pikii — Payments Feature

Complete implementation of Section 3.5 of the PRD.

---

## What's included

| Area | Files |
|---|---|
| **Schema** | `prisma/schema.payments.prisma` — append to your main `schema.prisma` |
| **Types** | `types/payments.ts` |
| **Daraja client** | `lib/payments/daraja.ts` — STK Push, B2C, OAuth token |
| **Wallet service** | `lib/payments/wallet.ts` — balance, credit, debit, ledger |
| **Commission engine** | `lib/payments/commission.ts` — per-rider/SACCO rates, cash debt handling |
| **Receipt generator** | `lib/payments/receipt.ts` — PDF via pdfkit |
| **Receipt dispatcher** | `lib/payments/receipt-dispatcher.ts` — SMS (Africa's Talking) + email (Resend) |
| **Background jobs** | `lib/payments/jobs.ts` — BullMQ: payout queue, receipt queue, stuck-payout retry |
| **API: M-Pesa initiate** | `app/api/payments/mpesa/initiate/route.ts` |
| **API: M-Pesa status** | `app/api/payments/mpesa/status/route.ts` |
| **API: STK webhook** | `app/api/payments/webhook/mpesa-stk/route.ts` |
| **API: B2C webhook** | `app/api/payments/webhook/mpesa-b2c/route.ts` |
| **API: Wallet** | `app/api/payments/wallet/route.ts` — GET balance/ledger, POST top-up |
| **API: Wallet pay** | `app/api/payments/wallet/pay/route.ts` — pay trip from balance |
| **API: Payout** | `app/api/payments/payout/route.ts` — GET history, POST withdraw |
| **API: Cash confirm** | `app/api/payments/cash/confirm/route.ts` — rider confirms cash receipt |
| **API: Tip** | `app/api/payments/tip/route.ts` — client tips rider |
| **API: Receipt PDF** | `app/api/receipts/[tripId]/route.ts` — serve PDF |
| **Zustand store** | `store/walletStore.ts` |
| **UI: Payment modal** | `components/payments/PaymentModal.tsx` |
| **UI: Wallet panel** | `components/payments/WalletPanel.tsx` |
| **UI: Payout panel** | `components/payments/PayoutPanel.tsx` |
| **Env example** | `.env.payments.example` |

---

## Schema additions required

In your existing Prisma `Trip` model, ensure these fields exist:
```prisma
model Trip {
  // ... existing fields ...
  fare             Decimal?  @db.Decimal(12, 2)
  distanceKm       Decimal?  @db.Decimal(8, 2)
  durationMinutes  Int?
  completedAt      DateTime?
  payment          Payment?

  pickupAddress    String
  dropoffAddress   String
  clientId         String
  riderId          String?
  client           User     @relation("ClientTrips", fields: [clientId], references: [id])
  rider            User?    @relation("RiderTrips", fields: [riderId], references: [id])
}
```

In your `RiderProfile` model, add:
```prisma
model RiderProfile {
  // ... existing fields ...
  commissionRateOverride Decimal? @db.Decimal(5, 4)
  mpesaPhone             String?
  plateNumber            String?
  saccoId                String?
  sacco                  SaccoOrg? @relation(fields: [saccoId], references: [id])
}
```

In your `SaccoOrg` model, add:
```prisma
model SaccoOrg {
  // ... existing fields ...
  commissionRate  Decimal? @db.Decimal(5, 4)
  riders          RiderProfile[]
}
```

After appending `schema.payments.prisma` contents, run:
```bash
npx prisma migrate dev --name add-payments
```

---

## Required packages

```bash
npm install pdfkit @types/pdfkit bullmq ioredis
```

---

## Webhook registration (Daraja Dashboard)

Register these URLs in your Safaricom Daraja app:

| Webhook | URL |
|---|---|
| STK Push callback | `https://your-domain.com/api/payments/webhook/mpesa-stk` |
| B2C Result URL | `https://your-domain.com/api/payments/webhook/mpesa-b2c` |
| B2C Timeout URL | `https://your-domain.com/api/payments/webhook/mpesa-b2c-timeout` |

For local development, use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
# Then update NEXT_PUBLIC_APP_URL in .env.local
```

---

## Payment flow (M-Pesa)

```
Client completes trip
  → POST /api/payments/mpesa/initiate   (creates Payment PENDING, fires STK Push)
  → Client sees "Check your phone" UI
  → Client enters PIN on phone
  → Safaricom POSTs to /api/payments/webhook/mpesa-stk
  → Webhook marks Payment COMPLETED, credits rider wallet, sends receipt
```

## Payment flow (Wallet)

```
Client completes trip
  → POST /api/payments/wallet/pay
  → Debit client wallet, create Payment COMPLETED, credit rider wallet, send receipt
```

## Payout flow

```
Rider requests withdrawal
  → POST /api/payments/payout
  → Debit rider wallet, create Payout PENDING, fire B2C
  → Safaricom POSTs to /api/payments/webhook/mpesa-b2c
  → Payout marked COMPLETED (or FAILED + wallet refunded)
```
