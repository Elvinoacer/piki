import { NextRequest, NextResponse } from "next/server";
import { getWalletBalance, getWalletLedger, creditWallet } from "@/lib/payments/wallet";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const includeLedger = req.nextUrl.searchParams.get("includeLedger") === "true";
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const balance = await getWalletBalance(userId);

    if (includeLedger) {
      const ledger = await getWalletLedger(userId, { page });
      return NextResponse.json({ balance, ledger });
    }

    return NextResponse.json({ balance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Note: In production, top-ups should use M-Pesa STK Push. This is a simplified direct credit for testing.
    const { userId, amount, referenceId } = await req.json();

    if (!userId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tx = await creditWallet({
      userId,
      amount: Number(amount),
      reason: "TOP_UP",
      referenceId,
      description: "Wallet Top Up",
    });

    return NextResponse.json({ success: true, transactionId: tx.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
