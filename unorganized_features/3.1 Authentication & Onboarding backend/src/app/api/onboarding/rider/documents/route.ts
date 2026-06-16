import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { documentUploadRequestSchemaRefined } from "@/lib/validation/onboarding";
import { buildDocumentKey, createUploadUrl, createDownloadUrl } from "@/lib/storage/s3";
import { ok, created, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";

// =====================================================================================
// POST /api/onboarding/rider/documents
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER)
// Body: see documentUploadRequestSchemaRefined —
//   { type, filename, mimeType, fileSizeBytes, documentNumber?, expiresAt? }
//
// Flow:
//   1. Client calls this endpoint with file metadata (NOT the file bytes).
//   2. Server creates a Document row (status=PENDING) and a pre-signed S3
//      PUT URL, marking any prior active Document of the same `type` as
//      inactive (isActive=false) — supports re-upload after rejection or
//      renewal without losing audit history.
//   3. Client PUTs the raw file bytes directly to `uploadUrl`.
//   4. Client calls PATCH /api/onboarding/rider/documents/:documentId to
//      confirm the upload completed, which flips status appropriately and
//      (if enabled) dispatches the AI document check.
//
// This two-step pattern keeps large file bytes off our application server
// entirely (NFR: documents in private buckets with signed URLs).
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const input = documentUploadRequestSchemaRefined.parse(await req.json());

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const fileKey = buildDocumentKey(rider.id, input.type, input.mimeType);

    const { document, uploadUrl, expiresInSeconds } = await prisma.$transaction(async (tx) => {
      // Deactivate any prior active document of this type (re-upload case).
      await tx.document.updateMany({
        where: { riderId: rider.id, type: input.type, isActive: true },
        data: { isActive: false },
      });

      const document = await tx.document.create({
        data: {
          riderId: rider.id,
          type: input.type,
          fileKey,
          originalFilename: input.filename,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          documentNumber: input.documentNumber,
          expiresAt: input.expiresAt,
          status: "PENDING",
          isActive: true,
        },
      });

      const { uploadUrl, expiresInSeconds } = await createUploadUrl(fileKey, input.mimeType);

      return { document, uploadUrl, expiresInSeconds };
    });

    // If this is the PROFILE_PHOTO, mirror the key onto RiderProfile for
    // fast access (e.g. displaying the rider badge per 3.7) once uploaded.
    // Done outside the main transaction since it's a denormalized
    // convenience field, not part of the upload-initiation invariant.
    if (input.type === "PROFILE_PHOTO") {
      await prisma.riderProfile.update({
        where: { id: rider.id },
        data: { profilePhotoUrl: fileKey },
      });
    }

    return created({
      documentId: document.id,
      uploadUrl,
      expiresInSeconds,
      message: t(session.locale, "DOCUMENT_UPLOADED"),
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

// -------------------------------------------------------------------------------------
// GET /api/onboarding/rider/documents
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER)
//
// Lists the caller's currently-active documents (isActive=true), each with
// a fresh short-lived signed GET URL so the rider can view what they
// uploaded (e.g. to confirm the photo isn't blurry).
// -------------------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const documents = await prisma.document.findMany({
      where: { riderId: rider.id, isActive: true },
      orderBy: { uploadedAt: "desc" },
    });

    const withUrls = await Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        documentNumber: doc.documentNumber,
        expiresAt: doc.expiresAt,
        rejectionReason: doc.rejectionReason,
        uploadedAt: doc.uploadedAt,
        viewUrl: await createDownloadUrl(doc.fileKey),
      }))
    );

    return ok({ documents: withUrls });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
