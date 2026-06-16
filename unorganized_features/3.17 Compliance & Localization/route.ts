// app/api/rider/documents/route.ts
// GET  /api/rider/documents         — list all compliance documents for the rider
// POST /api/rider/documents         — upload a new document (presigned URL flow)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NTSA_DOCUMENT_TYPES, type NtsaDocumentType, deriveDocumentStatus } from "@/lib/compliance/ntsa";
import { getPresignedUploadUrl } from "@/lib/storage"; // S3/R2 presign helper

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await prisma.document.findMany({
    where: { riderId: session.user.id },
    orderBy: { uploadedAt: "desc" },
  });

  // Build a complete checklist — one entry per required type
  const checklist = NTSA_DOCUMENT_TYPES.map((type) => {
    const doc = raw.find((d) => d.type === type);
    return {
      type,
      status: doc
        ? deriveDocumentStatus({
            fileUrl: doc.fileUrl,
            verifiedAt: doc.verifiedAt,
            expiresAt: doc.expiresAt,
          })
        : "missing",
      fileUrl: doc?.fileUrl ?? null,
      expiresAt: doc?.expiresAt?.toISOString() ?? null,
      verifiedAt: doc?.verifiedAt?.toISOString() ?? null,
      uploadedAt: doc?.uploadedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json(checklist);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, fileName, mimeType, expiresAt } = body as {
    type: NtsaDocumentType;
    fileName: string;
    mimeType: string;
    expiresAt?: string;
  };

  if (!NTSA_DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid document type: ${type}` }, { status: 400 });
  }

  const key = `riders/${session.user.id}/docs/${type}/${Date.now()}-${fileName}`;

  // Get a presigned upload URL (Cloudflare R2 / AWS S3)
  const { uploadUrl, publicUrl } = await getPresignedUploadUrl({ key, mimeType });

  // Upsert the document record — mark as pending until admin verifies
  await prisma.document.upsert({
    where: { riderId_type: { riderId: session.user.id, type } },
    update: {
      fileUrl: publicUrl,
      uploadedAt: new Date(),
      verifiedAt: null, // Reset verification on re-upload
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    create: {
      riderId: session.user.id,
      type,
      fileUrl: publicUrl,
      uploadedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ uploadUrl, publicUrl });
}
