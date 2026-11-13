// Pilot switches (decision 033). One place to turn features on for everyone.

/**
 * SMS tools of the businesses themselves. Off for the pilot (November–December
 * 2026): Visito sends only automatic SMS (booking confirmations, changes,
 * reminders, review requests) under Visito's own sender name, with texts
 * written by the Visito team in /admin/sms-texts.
 *
 * While false, salons cannot: set their own sender name, edit SMS texts, send a
 * test SMS, send SMS to a client or a group, offer a waitlist time by SMS, or
 * collect marketing consent. They keep the on/off switches for automatic SMS,
 * quiet hours, the balance and the SMS log. Turning this on brings everything
 * back; the data was never deleted.
 */
export const SMS_SALON_TOOLS = false;
