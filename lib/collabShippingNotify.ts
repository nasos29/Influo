import { creatorContact } from "@/lib/campaignNotify";
import { send } from "@/lib/proposalMail";
import { sendCheckedCreator } from "@/lib/collabCreatorMail";
import { sendPushToBrand, sendPushToInfluencer } from "@/lib/push";

export async function notifyShippingEvent(args: {
  kind: "address_submitted" | "shipped" | "received";
  applicationId: string;
  influencerId: string;
  campaignTitle?: string | null;
  brandEmail?: string | null;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string | null;
}): Promise<void> {
  const title = args.campaignTitle || "Καμπάνια";
  const person = await creatorContact(args.influencerId);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
  const creatorUrl = `${base}/dashboard?tab=campaigns&application=${encodeURIComponent(args.applicationId)}`;
  const brandUrl = `${base}/brand/dashboard?tab=campaigns&application=${encodeURIComponent(args.applicationId)}`;

  if (args.kind === "address_submitted" && args.brandEmail) {
    const subject = `Διεύθυνση αποστολής — ${title}`.slice(0, 180);
    const html = `<p>Ο creator υπέβαλε διεύθυνση για αποστολή προϊόντος στην καμπάνια «${title}».</p><p><a href="${brandUrl}">Άνοιγμα στο dashboard</a></p>`;
    await send("shipping_address_submitted", args.brandEmail, subject, html);
    await sendPushToBrand(args.brandEmail, {
      title: "Διεύθυνση αποστολής",
      body: title.slice(0, 120),
      url: brandUrl,
      tag: `ship-addr-${args.applicationId}`,
    }).catch(() => undefined);
    return;
  }

  if (args.kind === "shipped" && person?.email) {
    const subject = `Το προϊόν εστάλη — ${title}`.slice(0, 180);
    const lines = [
      `Courier: ${args.courier || "—"}`,
      `Tracking: ${args.trackingNumber || "—"}`,
      args.trackingUrl ? `URL: ${args.trackingUrl}` : "",
    ]
      .filter(Boolean)
      .join("<br/>");
    const html = `<p>Το brand σήμανε αποστολή για «${title}».</p><p>${lines}</p><p><a href="${creatorUrl}">Λεπτομέρειες</a></p>`;
    await sendCheckedCreator(args.influencerId, "shipping_shipped", person.email, subject, html);
    await sendPushToInfluencer(args.influencerId, {
      title: "Προϊόν σε μεταφορά",
      body: `${args.courier || ""} ${args.trackingNumber || ""}`.trim().slice(0, 120),
      url: creatorUrl,
      tag: `ship-out-${args.applicationId}`,
    }).catch(() => undefined);
    return;
  }

  if (args.kind === "received" && args.brandEmail) {
    const subject = `Παράδοση προϊόντος — ${title}`.slice(0, 180);
    const html = `<p>Ο creator επιβεβαίωσε παραλαβή για «${title}».</p><p><a href="${brandUrl}">Dashboard</a></p>`;
    await send("shipping_received", args.brandEmail, subject, html);
    await sendPushToBrand(args.brandEmail, {
      title: "Παραλαβή προϊόντος",
      body: title.slice(0, 120),
      url: brandUrl,
      tag: `ship-recv-${args.applicationId}`,
    }).catch(() => undefined);
  }
}