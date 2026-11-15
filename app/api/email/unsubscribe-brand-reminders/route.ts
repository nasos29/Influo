/**
 * One-click unsubscribe for brand campaign reminder emails (not transactional events).
 * Sets brands.reminders_email_opted_out = true when the signed token is valid.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseBrandReminderUnsubToken } from "@/lib/brandCampaignReminderMail";

export const runtime = "nodejs";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function htmlPage(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
  <body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#0f172a;line-height:1.5;">
  <h1 style="font-size:1.25rem;">${title}</h1>
  <p>${body}</p>
  <p style="margin-top:2rem;font-size:0.875rem;color:#64748b;"><a href="https://influo.gr">influo.gr</a></p>
  </body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const parsed = parseBrandReminderUnsubToken(token);
  if (!parsed) {
    return htmlPage("Μη έγκυρος σύνδεσμος", "Ο σύνδεσμος διαγραφής δεν είναι έγκυρος ή έχει λήξει.");
  }

  const { error } = await admin()
    .from("brands")
    .update({ reminders_email_opted_out: true })
    .eq("id", parsed.brandId)
    .ilike("contact_email", parsed.email);

  if (error) {
    if (/reminders_email_opted_out|PGRST204|42703/i.test(error.message || "")) {
      return htmlPage(
        "Δεν είναι ακόμα διαθέσιμο",
        "Η διαγραφή υπενθυμίσεων θα ενεργοποιηθεί μετά την εφαρμογή του migration. Επικοινωνήστε στο support@influo.gr."
      );
    }
    console.error("[unsubscribe-brand-reminders]", error.message);
    return htmlPage("Σφάλμα", "Κάτι πήγε στραβά. Δοκιμάστε ξανά ή γράψτε στο support@influo.gr.");
  }

  return htmlPage(
    "Διαγραφή υπενθυμίσεων",
    "Δεν θα λαμβάνετε πλέον υπενθυμίσεις πρόχειρων καμπανιών / nudges δημιουργίας καμπάνιας. Τα σημαντικά transactional emails (π.χ. νέες αιτήσεις) συνεχίζουν κανονικά."
  );
}
