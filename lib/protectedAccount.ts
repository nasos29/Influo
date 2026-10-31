/** The demo account named "test" must never be deleted from the admin. */

export function isProtectedTestAccount(row: {
  display_name?: string | null;
  brand_name?: string | null;
  contact_email?: string | null;
}): boolean {
  const name = (row.display_name || row.brand_name || "").trim().toLowerCase();
  const email = (row.contact_email || "").trim().toLowerCase();
  const local = email.split("@")[0] || "";
  return name === "test" || local === "test";
}
