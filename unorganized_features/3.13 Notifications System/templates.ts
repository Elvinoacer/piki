import { NotificationChannel } from "@prisma/client";

export type SupportedLocale = "en" | "sw";

/**
 * A template renders to channel-specific copy. SMS/push need to be short;
 * email/in-app can be longer. `title` is unused for SMS.
 *
 * Variables use `{{var}}` interpolation — see render() below.
 */
export interface ChannelTemplate {
  title?: string; // used by PUSH, IN_APP, EMAIL
  body: string; // used by all channels
  emailSubject?: string; // overrides title for EMAIL if present
}

export type TemplateSet = Record<
  SupportedLocale,
  Partial<Record<NotificationChannel, ChannelTemplate>>
>;

/**
 * Templates keyed by `templateKey` (see events.ts).
 *
 * Fallback rule when rendering: if a channel-specific template is missing,
 * fall back to IN_APP for that locale, then to "en" for that channel, then
 * to "en" IN_APP. See render().
 */
export const NOTIFICATION_TEMPLATES: Record<string, TemplateSet> = {
  ride_matched: {
    en: {
      PUSH: {
        title: "Rider matched!",
        body: "{{riderName}} is on the way ({{vehiclePlate}}). ETA {{etaMinutes}} min.",
      },
      SMS: {
        body: "Pikii: {{riderName}} ({{vehiclePlate}}) is coming to pick you up. ETA {{etaMinutes}} min.",
      },
      IN_APP: {
        title: "Rider matched",
        body: "{{riderName}} is heading to your pickup point. Estimated arrival in {{etaMinutes}} minutes.",
      },
    },
    sw: {
      PUSH: {
        title: "Dereva amepatikana!",
        body: "{{riderName}} anakuja kukuchukua ({{vehiclePlate}}). Atafika baada ya dakika {{etaMinutes}}.",
      },
      SMS: {
        body: "Pikii: {{riderName}} ({{vehiclePlate}}) anakuja kukuchukua. Atafika baada ya dakika {{etaMinutes}}.",
      },
      IN_APP: {
        title: "Dereva amepatikana",
        body: "{{riderName}} anaelekea sehemu ya kuchukua. Atafika baada ya dakika {{etaMinutes}}.",
      },
    },
  },

  rider_arriving: {
    en: {
      PUSH: {
        title: "Rider arriving soon",
        body: "{{riderName}} is {{etaMinutes}} min away.",
      },
      IN_APP: {
        title: "Rider arriving soon",
        body: "{{riderName}} is approaching your pickup point — about {{etaMinutes}} minutes away.",
      },
    },
    sw: {
      PUSH: {
        title: "Dereva anakaribia",
        body: "{{riderName}} atafika baada ya dakika {{etaMinutes}}.",
      },
      IN_APP: {
        title: "Dereva anakaribia",
        body: "{{riderName}} anakaribia sehemu yako ya kuchukua — dakika {{etaMinutes}} zaidi.",
      },
    },
  },

  rider_arrived: {
    en: {
      PUSH: {
        title: "Your rider has arrived",
        body: "{{riderName}} is waiting at the pickup point.",
      },
      SMS: {
        body: "Pikii: Your rider {{riderName}} has arrived and is waiting for you.",
      },
      IN_APP: {
        title: "Rider has arrived",
        body: "{{riderName}} is waiting at the pickup point.",
      },
    },
    sw: {
      PUSH: {
        title: "Dereva amefika",
        body: "{{riderName}} anakusubiri mahali pa kuchukua.",
      },
      SMS: {
        body: "Pikii: Dereva wako {{riderName}} amefika na anakusubiri.",
      },
      IN_APP: {
        title: "Dereva amefika",
        body: "{{riderName}} anakusubiri mahali pa kuchukua.",
      },
    },
  },

  trip_started: {
    en: {
      PUSH: { title: "Trip started", body: "Your trip to {{destination}} has begun. Have a safe ride!" },
      IN_APP: { title: "Trip started", body: "Your trip to {{destination}} has begun." },
    },
    sw: {
      PUSH: { title: "Safari imeanza", body: "Safari yako kuelekea {{destination}} imeanza. Safari njema!" },
      IN_APP: { title: "Safari imeanza", body: "Safari yako kuelekea {{destination}} imeanza." },
    },
  },

  trip_completed: {
    en: {
      PUSH: {
        title: "Trip completed",
        body: "You've arrived at {{destination}}. Total fare: {{currency}} {{amount}}.",
      },
      SMS: {
        body: "Pikii: Trip completed. Fare {{currency}} {{amount}}. Receipt: {{receiptUrl}}",
      },
      IN_APP: {
        title: "Trip completed",
        body: "Trip to {{destination}} completed. Total fare: {{currency}} {{amount}}. Rate your trip!",
      },
      EMAIL: {
        emailSubject: "Your Pikii receipt — {{currency}} {{amount}}",
        title: "Trip receipt",
        body: "Thanks for riding with Pikii. Your trip to {{destination}} is complete. Total fare: {{currency}} {{amount}}. Download your receipt: {{receiptUrl}}",
      },
    },
    sw: {
      PUSH: {
        title: "Safari imekamilika",
        body: "Umefika {{destination}}. Nauli jumla: {{currency}} {{amount}}.",
      },
      SMS: {
        body: "Pikii: Safari imekamilika. Nauli {{currency}} {{amount}}. Risiti: {{receiptUrl}}",
      },
      IN_APP: {
        title: "Safari imekamilika",
        body: "Safari kuelekea {{destination}} imekamilika. Nauli jumla: {{currency}} {{amount}}. Tathmini safari yako!",
      },
      EMAIL: {
        emailSubject: "Risiti yako ya Pikii — {{currency}} {{amount}}",
        title: "Risiti ya safari",
        body: "Asante kwa kutumia Pikii. Safari yako kuelekea {{destination}} imekamilika. Nauli jumla: {{currency}} {{amount}}. Pakua risiti: {{receiptUrl}}",
      },
    },
  },

  trip_cancelled: {
    en: {
      PUSH: { title: "Trip cancelled", body: "{{cancelledBy}} cancelled the trip. {{feeNote}}" },
      SMS: { body: "Pikii: Your trip was cancelled by {{cancelledBy}}. {{feeNote}}" },
      IN_APP: { title: "Trip cancelled", body: "{{cancelledBy}} cancelled the trip. {{feeNote}}" },
    },
    sw: {
      PUSH: { title: "Safari imesitishwa", body: "{{cancelledBy}} amesitisha safari. {{feeNote}}" },
      SMS: { body: "Pikii: Safari yako imesitishwa na {{cancelledBy}}. {{feeNote}}" },
      IN_APP: { title: "Safari imesitishwa", body: "{{cancelledBy}} amesitisha safari. {{feeNote}}" },
    },
  },

  payment_received: {
    en: {
      PUSH: { title: "Payment received", body: "{{currency}} {{amount}} received via {{method}}." },
      SMS: { body: "Pikii: Payment of {{currency}} {{amount}} received via {{method}}. Ref: {{reference}}" },
      IN_APP: { title: "Payment received", body: "{{currency}} {{amount}} received via {{method}}. Ref: {{reference}}" },
    },
    sw: {
      PUSH: { title: "Malipo yamepokelewa", body: "{{currency}} {{amount}} imepokelewa kupitia {{method}}." },
      SMS: { body: "Pikii: Malipo ya {{currency}} {{amount}} yamepokelewa kupitia {{method}}. Ref: {{reference}}" },
      IN_APP: { title: "Malipo yamepokelewa", body: "{{currency}} {{amount}} imepokelewa kupitia {{method}}. Ref: {{reference}}" },
    },
  },

  payment_failed: {
    en: {
      PUSH: { title: "Payment failed", body: "We couldn't process your {{method}} payment of {{currency}} {{amount}}. {{reasonNote}}" },
      SMS: { body: "Pikii: Payment of {{currency}} {{amount}} via {{method}} failed. {{reasonNote}}" },
      IN_APP: { title: "Payment failed", body: "We couldn't process your {{method}} payment of {{currency}} {{amount}}. {{reasonNote}} Tap to retry." },
    },
    sw: {
      PUSH: { title: "Malipo hayajafanikiwa", body: "Tumeshindwa kuchakata malipo ya {{currency}} {{amount}} kupitia {{method}}. {{reasonNote}}" },
      SMS: { body: "Pikii: Malipo ya {{currency}} {{amount}} kupitia {{method}} hayajafanikiwa. {{reasonNote}}" },
      IN_APP: { title: "Malipo hayajafanikiwa", body: "Tumeshindwa kuchakata malipo ya {{currency}} {{amount}} kupitia {{method}}. {{reasonNote}} Bonyeza kujaribu tena." },
    },
  },

  payout_processed: {
    en: {
      PUSH: { title: "Payout sent", body: "{{currency}} {{amount}} sent to your M-Pesa ({{phoneLast4}})." },
      SMS: { body: "Pikii: Payout of {{currency}} {{amount}} sent to M-Pesa ending {{phoneLast4}}. Ref: {{reference}}" },
      IN_APP: { title: "Payout processed", body: "{{currency}} {{amount}} has been sent to your M-Pesa account ending {{phoneLast4}}." },
      EMAIL: {
        emailSubject: "Payout confirmation — {{currency}} {{amount}}",
        title: "Payout processed",
        body: "Your withdrawal of {{currency}} {{amount}} has been sent to M-Pesa ending {{phoneLast4}}. Reference: {{reference}}.",
      },
    },
    sw: {
      PUSH: { title: "Malipo yametumwa", body: "{{currency}} {{amount}} imetumwa kwenye M-Pesa yako ({{phoneLast4}})." },
      SMS: { body: "Pikii: Malipo ya {{currency}} {{amount}} yametumwa kwa M-Pesa inayoishia {{phoneLast4}}. Ref: {{reference}}" },
      IN_APP: { title: "Malipo yamefanyika", body: "{{currency}} {{amount}} imetumwa kwenye akaunti yako ya M-Pesa inayoishia {{phoneLast4}}." },
      EMAIL: {
        emailSubject: "Uthibitisho wa malipo — {{currency}} {{amount}}",
        title: "Malipo yamefanyika",
        body: "Uondoaji wako wa {{currency}} {{amount}} umetumwa kwa M-Pesa inayoishia {{phoneLast4}}. Kumbukumbu: {{reference}}.",
      },
    },
  },

  document_expiring: {
    en: {
      PUSH: { title: "Document expiring soon", body: "Your {{documentType}} expires on {{expiryDate}}. Renew to avoid going offline." },
      IN_APP: { title: "Document expiring soon", body: "Your {{documentType}} expires on {{expiryDate}}. Please upload a renewed copy before this date." },
      EMAIL: {
        emailSubject: "Action needed: {{documentType}} expiring",
        title: "Document expiring soon",
        body: "Your {{documentType}} on Pikii expires on {{expiryDate}}. Please log in and upload a renewed copy to keep your account active.",
      },
    },
    sw: {
      PUSH: { title: "Hati inakaribia kuisha", body: "{{documentType}} yako itaisha {{expiryDate}}. Isasishe usisitishwe kufanya kazi." },
      IN_APP: { title: "Hati inakaribia kuisha", body: "{{documentType}} yako itaisha {{expiryDate}}. Tafadhali pakia nakala mpya kabla ya tarehe hii." },
      EMAIL: {
        emailSubject: "Hatua inahitajika: {{documentType}} inakaribia kuisha",
        title: "Hati inakaribia kuisha",
        body: "{{documentType}} yako kwenye Pikii itaisha {{expiryDate}}. Tafadhali ingia na upakie nakala mpya ili akaunti yako ibaki hai.",
      },
    },
  },

  document_expired: {
    en: {
      PUSH: { title: "Document expired", body: "Your {{documentType}} has expired. You've been taken offline until renewed." },
      SMS: { body: "Pikii: Your {{documentType}} has expired and you are now offline. Renew it in the app to resume." },
      IN_APP: { title: "Document expired — you're offline", body: "Your {{documentType}} expired on {{expiryDate}}. Upload a renewed copy to go back online." },
      EMAIL: {
        emailSubject: "Account paused: {{documentType}} expired",
        title: "Document expired",
        body: "Your {{documentType}} expired on {{expiryDate}} and your account has been paused. Upload a renewed copy to resume accepting trips.",
      },
    },
    sw: {
      PUSH: { title: "Hati imeisha muda", body: "{{documentType}} yako imeisha muda. Umewekwa nje ya mtandao hadi uisasishe." },
      SMS: { body: "Pikii: {{documentType}} yako imeisha muda na sasa umewekwa nje ya mtandao. Isasishe kwenye programu kuendelea." },
      IN_APP: { title: "Hati imeisha — uko nje ya mtandao", body: "{{documentType}} yako iliisha {{expiryDate}}. Pakia nakala mpya kurudi mtandaoni." },
      EMAIL: {
        emailSubject: "Akaunti imesimamishwa: {{documentType}} imeisha",
        title: "Hati imeisha muda",
        body: "{{documentType}} yako iliisha {{expiryDate}} na akaunti yako imesimamishwa. Pakia nakala mpya kuendelea kupokea safari.",
      },
    },
  },

  promo_available: {
    en: {
      PUSH: { title: "{{promoTitle}}", body: "{{promoBody}}" },
      IN_APP: { title: "{{promoTitle}}", body: "{{promoBody}} Use code {{promoCode}}." },
    },
    sw: {
      PUSH: { title: "{{promoTitle}}", body: "{{promoBody}}" },
      IN_APP: { title: "{{promoTitle}}", body: "{{promoBody}} Tumia msimbo {{promoCode}}." },
    },
  },

  sos_triggered: {
    en: {
      PUSH: { title: "🚨 SOS Alert", body: "{{triggeredByName}} triggered an SOS during a trip. Location shared with safety team." },
      SMS: { body: "PIKII SOS: {{triggeredByName}} triggered an emergency alert on trip {{tripId}}. Last known location: {{locationUrl}}" },
      IN_APP: { title: "🚨 SOS Alert", body: "{{triggeredByName}} triggered an SOS during trip {{tripId}}. Live location shared with the safety team." },
    },
    sw: {
      PUSH: { title: "🚨 Tahadhari ya SOS", body: "{{triggeredByName}} ametuma tahadhari ya dharura wakati wa safari. Mahali kumeshirikishwa na timu ya usalama." },
      SMS: { body: "PIKII SOS: {{triggeredByName}} ametuma tahadhari ya dharura kwenye safari {{tripId}}. Mahali pa mwisho: {{locationUrl}}" },
      IN_APP: { title: "🚨 Tahadhari ya SOS", body: "{{triggeredByName}} ametuma tahadhari ya SOS kwenye safari {{tripId}}. Mahali kumeshirikishwa na timu ya usalama." },
    },
  },

  broadcast: {
    en: {
      PUSH: { title: "{{broadcastTitle}}", body: "{{broadcastBody}}" },
      IN_APP: { title: "{{broadcastTitle}}", body: "{{broadcastBody}}" },
    },
    sw: {
      PUSH: { title: "{{broadcastTitle}}", body: "{{broadcastBody}}" },
      IN_APP: { title: "{{broadcastTitle}}", body: "{{broadcastBody}}" },
    },
  },
};

/**
 * Replace `{{var}}` placeholders in `text` with values from `vars`.
 * Unknown placeholders are left as-is (helps catch missing vars in dev/logs).
 */
function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = vars[key];
    return val === undefined || val === null ? match : String(val);
  });
}

export interface RenderedNotification {
  title?: string;
  body: string;
  emailSubject?: string;
}

/**
 * Render a template for a given templateKey/channel/locale, with fallback:
 *   requested locale + channel
 *   -> requested locale + IN_APP
 *   -> "en" + channel
 *   -> "en" + IN_APP
 * Throws if even the final fallback is missing (programmer error — template
 * registry is incomplete for this templateKey).
 */
export function renderTemplate(
  templateKey: string,
  channel: NotificationChannel,
  locale: SupportedLocale,
  vars: Record<string, string | number> = {},
): RenderedNotification {
  const set = NOTIFICATION_TEMPLATES[templateKey];
  if (!set) {
    throw new Error(`No template registered for templateKey "${templateKey}"`);
  }

  const candidate =
    set[locale]?.[channel] ??
    set[locale]?.IN_APP ??
    set.en[channel] ??
    set.en.IN_APP;

  if (!candidate) {
    throw new Error(
      `Template "${templateKey}" has no usable variant for channel=${channel} locale=${locale} (and no en/IN_APP fallback)`,
    );
  }

  return {
    title: candidate.title ? interpolate(candidate.title, vars) : undefined,
    body: interpolate(candidate.body, vars),
    emailSubject: candidate.emailSubject
      ? interpolate(candidate.emailSubject, vars)
      : undefined,
  };
}
