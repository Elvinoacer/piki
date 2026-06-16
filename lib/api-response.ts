import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Locale } from "@/app/generated/prisma/client";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { MESSAGES, t, type MessageCode } from "@/lib/i18n/messages";

// -------------------------------------------------------------------------------------
// API Response Helpers
// -------------------------------------------------------------------------------------
// Standard envelope:
//   Success: { ok: true, data: <payload> }
//   Error:   { ok: false, error: { code, message } [, details?] }
//
// `message` is localized server-side based on the request's resolved locale
// (defaults to EN if unknown), so clients can render it directly. `code` is
// stable and machine-readable for client-side re-localization or branching.
// -------------------------------------------------------------------------------------

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export class ApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: MessageCode,
    public readonly locale?: Locale,
    public readonly details?: unknown
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/**
 * Central error handler for route handlers. Wrap your handler body in
 * try/catch and call `return errorResponse(err, locale)` in the catch
 * block, OR use {@link withErrorHandling}.
 */
export function errorResponse(err: unknown, locale: Locale = "EN" as Locale): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: err.code, message: t(err.locale ?? locale, err.code), details: err.details },
      },
      { status: err.httpStatus }
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR" satisfies MessageCode,
          message: t(locale, "VALIDATION_ERROR"),
          details: err.flatten(),
        },
      },
      { status: 422 }
    );
  }

  if (err instanceof UnauthorizedError) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: t(locale, "UNAUTHORIZED") } },
      { status: 401 }
    );
  }

  if (err instanceof ForbiddenError) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: t(locale, "FORBIDDEN") } },
      { status: 403 }
    );
  }

  // eslint-disable-next-line no-console
  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL_ERROR", message: t(locale, "INTERNAL_ERROR") } },
    { status: 500 }
  );
}

/**
 * Resolves the locale to use for an error/notification response. Priority:
 * 1. Explicit locale (e.g. from an already-loaded User record)
 * 2. `X-Locale` request header (sent by the frontend based on device/app language)
 * 3. Default "EN"
 */
export function resolveLocale(headerLocale: string | null | undefined): Locale {
  const normalized = headerLocale?.toUpperCase();
  if (normalized === "SW" || normalized === "EN") return normalized as Locale;
  return "EN" as Locale;
}

export { MESSAGES };
