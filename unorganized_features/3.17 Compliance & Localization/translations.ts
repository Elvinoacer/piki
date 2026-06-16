// lib/i18n/translations.ts
// Pikii — English & Swahili translations
// Add keys here first; components consume via useTranslation()

export type Language = "en" | "sw";

export type TranslationKey = keyof typeof en;

const en = {
  // --- Common ---
  app_name: "Pikii",
  save: "Save changes",
  cancel: "Cancel",
  confirm: "Confirm",
  delete: "Delete",
  download: "Download",
  export: "Export",
  loading: "Loading…",
  error_generic: "Something went wrong. Please try again.",
  retry: "Try again",
  offline_banner: "You're offline. Some features may be unavailable.",
  offline_saved: "Saved locally — will sync when you reconnect.",
  back: "Back",
  next: "Next",
  done: "Done",
  yes: "Yes",
  no: "No",

  // --- Language toggle ---
  language_label: "Language",
  language_english: "English",
  language_swahili: "Kiswahili",

  // --- Auth / Onboarding ---
  onboarding_welcome: "Welcome to Pikii",
  onboarding_subtitle: "Kenya's bodaboda platform",
  phone_label: "Phone number",
  phone_placeholder: "+254 7XX XXX XXX",
  otp_label: "Enter the code sent to {{phone}}",
  otp_resend: "Resend code",
  otp_resend_countdown: "Resend in {{seconds}}s",
  role_select_title: "How will you use Pikii?",
  role_client: "Passenger / Sender",
  role_rider: "Rider",
  role_sacco: "SACCO / Fleet Admin",

  // --- NTSA Document Checklist ---
  docs_title: "Rider documents",
  docs_subtitle: "Complete your profile to start taking rides",
  docs_ntsa_badge: "NTSA / PSV badge",
  docs_national_id: "National ID",
  docs_driving_license: "Driving licence (Class A/F)",
  docs_logbook: "Motorcycle logbook",
  docs_insurance: "Insurance certificate",
  docs_photo: "Profile photo",
  docs_status_verified: "Verified",
  docs_status_pending: "Under review",
  docs_status_expired: "Expired",
  docs_status_missing: "Not uploaded",
  docs_expiry_label: "Expires {{date}}",
  docs_expiry_warning: "Expires in {{days}} days — renew soon",
  docs_expiry_critical: "Expired — upload a new copy to stay active",
  docs_upload_cta: "Upload document",
  docs_replace_cta: "Replace document",
  docs_checklist_complete: "All documents verified. You're ready to ride!",
  docs_checklist_incomplete: "{{count}} document(s) still needed",
  docs_admin_note: "Your documents are being reviewed by the Pikii team. You'll be notified when approved.",

  // --- KRA Export ---
  kra_title: "Tax records",
  kra_subtitle: "Download transaction records for KRA filing",
  kra_period_label: "Tax period",
  kra_period_monthly: "Monthly",
  kra_period_quarterly: "Quarterly",
  kra_period_annual: "Annual",
  kra_format_label: "Format",
  kra_format_csv: "CSV",
  kra_format_pdf: "PDF",
  kra_export_cta: "Export records",
  kra_export_success: "Your records are ready — check your downloads.",
  kra_export_error: "Export failed. Please try again.",
  kra_empty: "No transactions found for this period.",
  kra_disclaimer:
    "These records are generated from Pikii transaction data. Consult a tax professional for your filing obligations.",

  // --- Data Protection (Kenya DPA 2019) ---
  dpa_title: "Your data & privacy",
  dpa_subtitle: "You control your personal information",
  dpa_consent_heading: "Data use consent",
  dpa_consent_location: "Allow Pikii to use my location for ride matching",
  dpa_consent_marketing: "Send me promotions and offers",
  dpa_consent_analytics: "Help improve Pikii by sharing anonymous usage data",
  dpa_export_heading: "Request your data",
  dpa_export_body:
    "Download a copy of all personal data Pikii holds about you, including trips, payments, and account details.",
  dpa_export_cta: "Request data export",
  dpa_export_processing: "Your export is being prepared. We'll notify you when it's ready (up to 72 hours).",
  dpa_delete_heading: "Delete my account",
  dpa_delete_body:
    "Permanently remove your account and personal data from Pikii. Active trips and financial records required by law will be retained for the minimum statutory period.",
  dpa_delete_cta: "Request account deletion",
  dpa_delete_confirm_title: "Are you sure?",
  dpa_delete_confirm_body:
    "This action cannot be undone. Your account, ride history, and personal details will be permanently deleted.",
  dpa_delete_confirm_cta: "Yes, delete my account",
  dpa_rights_heading: "Your rights under the Kenya Data Protection Act, 2019",
  dpa_rights_access: "Right to access your data",
  dpa_rights_rectification: "Right to correct inaccurate information",
  dpa_rights_erasure: "Right to delete your data",
  dpa_rights_portability: "Right to receive your data in a portable format",
  dpa_rights_objection: "Right to object to how your data is used",
  dpa_contact: "To exercise any right, email privacy@pikii.co.ke",

  // --- Offline ---
  offline_title: "You're offline",
  offline_body: "Pikii needs a connection to match rides. Your last known location is saved.",
  offline_queue_label: "{{count}} action(s) queued to sync",
  offline_sync_now: "Sync now",
  offline_syncing: "Syncing…",
  offline_sync_done: "All changes synced.",
  offline_trip_unavailable: "New rides can't be requested while offline.",
  offline_history_available: "Your trip history is available offline.",
} as const;

const sw: Record<TranslationKey, string> = {
  // --- Common ---
  app_name: "Pikii",
  save: "Hifadhi mabadiliko",
  cancel: "Ghairi",
  confirm: "Thibitisha",
  delete: "Futa",
  download: "Pakua",
  export: "Hamisha",
  loading: "Inapakia…",
  error_generic: "Hitilafu imetokea. Tafadhali jaribu tena.",
  retry: "Jaribu tena",
  offline_banner: "Huna mtandao. Baadhi ya huduma hazitapatikana.",
  offline_saved: "Imehifadhiwa mtandaoni — itasawazishwa unapounganishwa.",
  back: "Rudi",
  next: "Endelea",
  done: "Imekamilika",
  yes: "Ndiyo",
  no: "Hapana",

  // --- Language toggle ---
  language_label: "Lugha",
  language_english: "English",
  language_swahili: "Kiswahili",

  // --- Auth / Onboarding ---
  onboarding_welcome: "Karibu Pikii",
  onboarding_subtitle: "Jukwaa la bodaboda Kenya",
  phone_label: "Nambari ya simu",
  phone_placeholder: "+254 7XX XXX XXX",
  otp_label: "Weka msimbo uliotumwa kwa {{phone}}",
  otp_resend: "Tuma tena msimbo",
  otp_resend_countdown: "Tuma tena baada ya sekunde {{seconds}}",
  role_select_title: "Utatumia Pikii vipi?",
  role_client: "Abiria / Mtumaji",
  role_rider: "Dereva (Boda)",
  role_sacco: "Msimamizi wa SACCO / Gari",

  // --- NTSA Document Checklist ---
  docs_title: "Nyaraka za dereva",
  docs_subtitle: "Kamilisha wasifu wako ili uanze kupokea safari",
  docs_ntsa_badge: "Beji ya NTSA / PSV",
  docs_national_id: "Kitambulisho cha Taifa",
  docs_driving_license: "Leseni ya udereva (Darasa A/F)",
  docs_logbook: "Kitabu cha pikipiki",
  docs_insurance: "Cheti cha bima",
  docs_photo: "Picha ya wasifu",
  docs_status_verified: "Imethibitishwa",
  docs_status_pending: "Inakaguliwa",
  docs_status_expired: "Imekwisha muda",
  docs_status_missing: "Haijapakiwa",
  docs_expiry_label: "Inaisha {{date}}",
  docs_expiry_warning: "Inaisha baada ya siku {{days}} — fanya upya hivi karibuni",
  docs_expiry_critical: "Imekwisha muda — pakia nakala mpya ili uendelee",
  docs_upload_cta: "Pakia hati",
  docs_replace_cta: "Badilisha hati",
  docs_checklist_complete: "Nyaraka zote zimethibitishwa. Uko tayari kusafiri!",
  docs_checklist_incomplete: "Nyaraka {{count}} bado zinahitajika",
  docs_admin_note: "Nyaraka zako zinakaguliwa na timu ya Pikii. Utajulishwa ukithibitishwa.",

  // --- KRA Export ---
  kra_title: "Kumbukumbu za kodi",
  kra_subtitle: "Pakua kumbukumbu za miamala kwa ajili ya KRA",
  kra_period_label: "Kipindi cha kodi",
  kra_period_monthly: "Kila mwezi",
  kra_period_quarterly: "Kila robo mwaka",
  kra_period_annual: "Kwa mwaka",
  kra_format_label: "Muundo",
  kra_format_csv: "CSV",
  kra_format_pdf: "PDF",
  kra_export_cta: "Hamisha kumbukumbu",
  kra_export_success: "Kumbukumbu zako ziko tayari — angalia upakuaji wako.",
  kra_export_error: "Uhamishaji umeshindwa. Tafadhali jaribu tena.",
  kra_empty: "Hakuna miamala iliyopatikana kwa kipindi hiki.",
  kra_disclaimer:
    "Kumbukumbu hizi zinatokana na data ya miamala ya Pikii. Wasiliana na mtaalamu wa kodi kwa wajibu wako wa kuwasilisha.",

  // --- Data Protection (Kenya DPA 2019) ---
  dpa_title: "Data yako na faragha",
  dpa_subtitle: "Unasimamia taarifa zako binafsi",
  dpa_consent_heading: "Idhini ya matumizi ya data",
  dpa_consent_location: "Ruhusu Pikii kutumia eneo langu kulinganisha safari",
  dpa_consent_marketing: "Nitumie matangazo na matoleo maalum",
  dpa_consent_analytics: "Nisaidie kuboresha Pikii kwa kushiriki data ya matumizi bila kutambulika",
  dpa_export_heading: "Omba data yako",
  dpa_export_body:
    "Pakua nakala ya data yako yote ya kibinafsi iliyohifadhiwa na Pikii, ikiwemo safari, malipo, na maelezo ya akaunti.",
  dpa_export_cta: "Omba usafirishaji wa data",
  dpa_export_processing:
    "Usafirishaji wako unaandaliwa. Tutakujulisha utakapokuwa tayari (hadi masaa 72).",
  dpa_delete_heading: "Futa akaunti yangu",
  dpa_delete_body:
    "Ondoa akaunti yako na data yako binafsi kutoka Pikii milele. Safari za sasa na kumbukumbu za fedha zinazohitajika kisheria zitahifadhiwa kwa muda wa chini wa kisheria.",
  dpa_delete_cta: "Omba ufutaji wa akaunti",
  dpa_delete_confirm_title: "Una uhakika?",
  dpa_delete_confirm_body:
    "Kitendo hiki hakiwezi kutendeka upya. Akaunti yako, historia ya safari, na maelezo yako ya kibinafsi yatafutwa milele.",
  dpa_delete_confirm_cta: "Ndiyo, futa akaunti yangu",
  dpa_rights_heading: "Haki zako chini ya Sheria ya Ulinzi wa Data ya Kenya, 2019",
  dpa_rights_access: "Haki ya kupata data yako",
  dpa_rights_rectification: "Haki ya kurekebisha taarifa zisizo sahihi",
  dpa_rights_erasure: "Haki ya kufuta data yako",
  dpa_rights_portability: "Haki ya kupokea data yako katika muundo unaoweza kuhamishwa",
  dpa_rights_objection: "Haki ya kupinga jinsi data yako inavyotumika",
  dpa_contact: "Ili kutumia haki yoyote, tuma barua pepe kwa privacy@pikii.co.ke",

  // --- Offline ---
  offline_title: "Huna mtandao",
  offline_body: "Pikii inahitaji muunganisho kulinganisha safari. Eneo lako la mwisho limehifadhiwa.",
  offline_queue_label: "Vitendo {{count}} vimesubiri kusawazishwa",
  offline_sync_now: "Sawazisha sasa",
  offline_syncing: "Inasawazisha…",
  offline_sync_done: "Mabadiliko yote yamesawazishwa.",
  offline_trip_unavailable: "Safari mpya haiwezi kuombiwa ukiwa nje ya mtandao.",
  offline_history_available: "Historia yako ya safari inapatikana nje ya mtandao.",
};

export const translations: Record<Language, typeof en> = { en, sw: sw as typeof en };

/** Interpolate {{key}} placeholders in a translation string */
export function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}
