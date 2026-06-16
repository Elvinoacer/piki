// app/api/safety/trusted-contacts/route.ts
// GET  /api/safety/trusted-contacts      — list user's contacts.
// POST /api/safety/trusted-contacts      — add a contact.
// DELETE /api/safety/trusted-contacts/[id] — remove a contact.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTrustedContacts,
  addTrustedContact,
  removeTrustedContact,
} from "@/lib/safety/safety.service";
import { z } from "zod";

const addSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().regex(/^\+254\d{9}$/, "Must be a valid Kenyan number: +254XXXXXXXXX"),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await getTrustedContacts(session.user.id);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const contact = await addTrustedContact(session.user.id, parsed.data);
  return NextResponse.json(contact, { status: 201 });
}

// DELETE handler lives at /api/safety/trusted-contacts/[id]/route.ts below:
// app/api/safety/trusted-contacts/[id]/route.ts

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Extract id from URL: /api/safety/trusted-contacts/:id
  const segments = req.nextUrl.pathname.split("/");
  const contactId = segments[segments.length - 1];

  await removeTrustedContact(session.user.id, contactId);
  return NextResponse.json({ deleted: true });
}
