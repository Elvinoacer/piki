// -------------------------------------------------------------------------------------
// i18n Message Catalog — Authentication & Onboarding
// -------------------------------------------------------------------------------------
// Per PRD 3.1 ("Multi-language support: English & Swahili from day one") and
// 3.17 ("Swahili/English toggle throughout the app"), all user-facing API
// messages (validation errors, status descriptions, notification text) are
// looked up through this catalog keyed by Locale.
//
// API responses include a stable machine-readable `code` (e.g.
// "OTP_INVALID") AND a localized `message` resolved via `t(locale, code)`,
// so frontends can either display the server's localized string directly or
// re-localize client-side using the same `code`.
// -------------------------------------------------------------------------------------

import type { Locale } from "@prisma/client";

export const MESSAGES = {
  // --- Generic ---------------------------------------------------------------
  VALIDATION_ERROR: {
    EN: "Some of the information provided is invalid.",
    SW: "Baadhi ya taarifa ulizotoa si sahihi.",
  },
  INTERNAL_ERROR: {
    EN: "Something went wrong. Please try again.",
    SW: "Hitilafu imetokea. Tafadhali jaribu tena.",
  },
  UNAUTHORIZED: {
    EN: "You need to be signed in to do that.",
    SW: "Unahitaji kuingia kwanza ili kufanya hivi.",
  },
  FORBIDDEN: {
    EN: "You don't have permission to do that.",
    SW: "Huna ruhusa ya kufanya hivi.",
  },
  NOT_FOUND: {
    EN: "We couldn't find what you're looking for.",
    SW: "Hatukupata kile unachokitafuta.",
  },

  // --- OTP ---------------------------------------------------------------------
  OTP_SENT: {
    EN: "A verification code has been sent to your phone.",
    SW: "Nambari ya uthibitisho imetumwa kwenye simu yako.",
  },
  OTP_INVALID: {
    EN: "The code you entered is incorrect.",
    SW: "Nambari uliyoweka si sahihi.",
  },
  OTP_EXPIRED: {
    EN: "This code has expired. Please request a new one.",
    SW: "Nambari hii imeisha muda wake. Tafadhali omba nyingine.",
  },
  OTP_TOO_MANY_ATTEMPTS: {
    EN: "Too many incorrect attempts. Please request a new code.",
    SW: "Umejaribu mara nyingi bila kufanikiwa. Tafadhali omba nambari mpya.",
  },
  OTP_RATE_LIMITED: {
    EN: "Too many code requests. Please wait before trying again.",
    SW: "Umeomba nambari mara nyingi. Tafadhali subiri kidogo kisha jaribu tena.",
  },
  OTP_COOLDOWN: {
    EN: "Please wait before requesting another code.",
    SW: "Tafadhali subiri kabla ya kuomba nambari nyingine.",
  },

  // --- Auth ------------------------------------------------------------------
  PHONE_ALREADY_REGISTERED: {
    EN: "An account with this phone number already exists. Please log in instead.",
    SW: "Akaunti yenye nambari hii ya simu ipo tayari. Tafadhali ingia badala ya kujisajili.",
  },
  ACCOUNT_NOT_FOUND: {
    EN: "No account found with this phone number.",
    SW: "Hakuna akaunti yenye nambari hii ya simu.",
  },
  INVALID_CREDENTIALS: {
    EN: "Invalid phone number or password.",
    SW: "Nambari ya simu au nenosiri si sahihi.",
  },
  ACCOUNT_SUSPENDED: {
    EN: "Your account has been suspended. Contact support for help.",
    SW: "Akaunti yako imesimamishwa. Wasiliana na huduma kwa wateja kwa msaada.",
  },
  SIGNUP_SUCCESS: {
    EN: "Account created successfully.",
    SW: "Akaunti imefanikiwa kufunguliwa.",
  },
  LOGIN_SUCCESS: {
    EN: "Logged in successfully.",
    SW: "Umeingia kikamilifu.",
  },
  LOGOUT_SUCCESS: {
    EN: "Logged out successfully.",
    SW: "Umetoka kikamilifu.",
  },
  GOOGLE_LOGIN_CLIENT_ONLY: {
    EN: "Google sign-in is currently available for client accounts only.",
    SW: "Kuingia kwa Google kwa sasa kunapatikana kwa akaunti za wateja tu.",
  },

  // --- Onboarding (Rider) -------------------------------------------------------
  DOCUMENT_UPLOADED: {
    EN: "Document uploaded successfully and is pending review.",
    SW: "Hati imepakiwa kikamilifu na inasubiri ukaguzi.",
  },
  DOCUMENT_TYPE_NOT_REQUIRED: {
    EN: "This document type is not required for your vehicle type.",
    SW: "Aina hii ya hati haihitajiki kwa aina ya gari/pikipiki yako.",
  },
  ONBOARDING_INCOMPLETE: {
    EN: "Please complete all required onboarding steps before submitting for review.",
    SW: "Tafadhali kamilisha hatua zote zinazohitajika kabla ya kuwasilisha kwa ukaguzi.",
  },
  ONBOARDING_SUBMITTED: {
    EN: "Your application has been submitted for review. We'll notify you once it's approved.",
    SW: "Maombi yako yamewasilishwa kwa ukaguzi. Tutakujulisha mara yatakapokubaliwa.",
  },
  RIDER_APPROVED: {
    EN: "Congratulations! Your rider account has been approved. You can now go online.",
    SW: "Hongera! Akaunti yako ya rider imekubaliwa. Sasa unaweza kuanza kupokea safari.",
  },
  RIDER_REJECTED: {
    EN: "Your rider application was not approved. Please review the feedback and resubmit.",
    SW: "Maombi yako ya rider hayakukubaliwa. Tafadhali soma maoni na uwasilishe tena.",
  },
  RIDER_NOT_VERIFIED: {
    EN: "Your account is not yet verified, so you can't go online yet.",
    SW: "Akaunti yako bado haijathibitishwa, hivyo bado hauwezi kuwa mtandaoni.",
  },
  PAYOUT_METHOD_ADDED: {
    EN: "Payout method saved successfully.",
    SW: "Njia ya malipo imehifadhiwa kikamilifu.",
  },

  // --- Admin -----------------------------------------------------------------
  RIDER_REVIEW_RECORDED: {
    EN: "Review decision recorded.",
    SW: "Uamuzi wa ukaguzi umerekodiwa.",
  },
} as const;

export type MessageCode = keyof typeof MESSAGES;

/**
 * Resolves a message code to a localized string. Falls back to English if
 * the requested locale is missing for a given code (defensive — all codes
 * above define both EN and SW).
 */
export function t(locale: Locale | undefined, code: MessageCode): string {
  const entry = MESSAGES[code];
  return entry[locale ?? "EN"] ?? entry.EN;
}
