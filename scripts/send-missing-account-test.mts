/**
 * One-off test send of the "missing social account" creator email.
 * Recipient is hard-wired to the owner's test inbox; no DB writes except email_log.
 * Run in the app container:
 *   node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/send-missing-account-test.mts
 */
import { buildCreatorMail } from "../lib/missingAccountMail.ts";
import { sendChecked } from "../lib/proposalMail.ts";

const TEST_TO = "nd.6@hotmail.com";
const mail = buildCreatorMail("Nasos (test)", "influo_test_handle");
const outcome = await sendChecked("missing_social_account_test", TEST_TO, `[TEST] ${mail.subject}`, mail.html, {
  party: "test",
});
console.log(JSON.stringify({ outcome }));
await new Promise((r) => setTimeout(r, 1500)); // let email_log write finish
process.exit(outcome === "ok" ? 0 : 1);
