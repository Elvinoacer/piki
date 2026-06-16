// lib/payments/daraja.ts
// Safaricom Daraja API client
// Handles: OAuth token, STK Push, B2C payout, query status

import {
  MpesaSTKPushRequest,
  MpesaSTKPushResponse,
  MpesaB2CRequest,
  MpesaB2CResponse,
} from "@/types/payments";

const DARAJA_BASE =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ----------------------------------------------------------------
// OAuth — cached in-memory (tokens last 1 hour)
// ----------------------------------------------------------------
let _token: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const key = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  if (!res.ok) {
    throw new Error(`Daraja OAuth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s buffer
  return _token!;
}

// ----------------------------------------------------------------
// STK Push — prompt client's phone with payment request
// ----------------------------------------------------------------
export async function stkPush(
  input: MpesaSTKPushRequest
): Promise<MpesaSTKPushResponse> {
  const token = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/mpesa-stk`;

  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
    "base64"
  );

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(input.amount), // M-Pesa only accepts integers
    PartyA: input.phone,
    PartyB: shortcode,
    PhoneNumber: input.phone,
    CallBackURL: callbackUrl,
    AccountReference: input.accountReference,
    TransactionDesc: input.transactionDesc,
  };

  const res = await fetch(
    `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (data.ResponseCode !== "0") {
    throw new Error(
      `STK Push failed: ${data.ResponseDescription || JSON.stringify(data)}`
    );
  }

  return data as MpesaSTKPushResponse;
}

// ----------------------------------------------------------------
// STK Push Query — poll payment status (fallback if callback missed)
// ----------------------------------------------------------------
export async function stkQuery(checkoutRequestId: string): Promise<{
  resultCode: string;
  resultDesc: string;
}> {
  const token = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
    "base64"
  );

  const res = await fetch(
    `${DARAJA_BASE}/mpesa/stkpushquery/v1/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    }
  );

  const data = await res.json();
  return { resultCode: data.ResultCode, resultDesc: data.ResultDesc };
}

// ----------------------------------------------------------------
// B2C — pay out to rider's M-Pesa
// ----------------------------------------------------------------
export async function b2cPayout(
  input: MpesaB2CRequest
): Promise<MpesaB2CResponse> {
  const token = await getAccessToken();
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/mpesa-b2c`;
  const timeoutUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/mpesa-b2c-timeout`;

  const body = {
    InitiatorName: process.env.MPESA_INITIATOR_NAME!,
    SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL!,
    CommandID: "BusinessPayment",
    Amount: Math.ceil(input.amount),
    PartyA: process.env.MPESA_SHORTCODE!,
    PartyB: input.phone,
    Remarks: input.remarks,
    QueueTimeOutURL: timeoutUrl,
    ResultURL: callbackUrl,
    Occasion: input.occasion ?? "",
  };

  const res = await fetch(`${DARAJA_BASE}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.ResponseCode !== "0") {
    throw new Error(
      `B2C failed: ${data.ResponseDescription || JSON.stringify(data)}`
    );
  }

  return data as MpesaB2CResponse;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
}

/** Normalise phone to 254XXXXXXXXX */
export function normaliseMpesaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10)
    return "254" + digits.slice(1);
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
  throw new Error(`Invalid Kenyan phone number: ${raw}`);
}
