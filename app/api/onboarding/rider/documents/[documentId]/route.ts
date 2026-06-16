import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { runAiDocumentCheck, runFaceMatchCheck } from "@/lib/services/ai-document-check";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";

// =====================================================================================
// PATCH /api/onboarding/rider/documents/[documentId]
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER, must own the document)
//
// Called by the client after successfully PUTting file bytes to the
// pre-signed S3 URL returned by POST /api/onboarding/rider/documents.
// Confirms the upload, then:
//   - dispatches an AI document check (no-op if AI_DOC_CHECK_ENABLED=false)
//   - if this was the PROFILE_PHOTO and a NATIONAL_ID document already
//     exists, also dispatches the face-match check
//
// Document status transitions to AI_REVIEW (if AI enabled) or stays PENDING
// (awaiting manual admin review) otherwise.
// =====================================================================================

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);
    const { documentId } = await params;

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.riderId !== rider.id) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    // Trigger AI check (updates status internally; no-op if disabled).
    await runAiDocumentCheck(documentId);

    if (document.type === "PROFILE_PHOTO") {
      await runFaceMatchCheck(rider.id);
    }

    const refreshed = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

    return ok({
      document: {
        id: refreshed.id,
        type: refreshed.type,
        status: refreshed.status,
        rejectionReason: refreshed.rejectionReason,
      },
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

// -------------------------------------------------------------------------------------
// DELETE /api/onboarding/rider/documents/[documentId]
// -------------------------------------------------------------------------------------
// Allows a rider to remove a document they uploaded BEFORE it's been
// approved (e.g. uploaded the wrong file). Approved documents cannot be
// deleted this way — they must go through a fresh upload (POST) which
// automatically deactivates the old one, preserving audit history instead
// of destroying it.
// -------------------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);
    const { documentId } = await params;

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.riderId !== rider.id) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    if (document.status === "APPROVED") {
      throw new ApiError(409, "VALIDATION_ERROR", session.locale, {
        message: "Approved documents cannot be deleted directly; upload a replacement instead.",
      });
    }

    await prisma.document.update({ where: { id: documentId }, data: { isActive: false } });

    return ok({ deleted: true });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
