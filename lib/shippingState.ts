export const SHIPPING_STATUSES = ["pending_address", "address_submitted", "shipped", "received"] as const;
export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];

export type ShippingRow = {
  status: ShippingStatus;
  recipient_name?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
  courier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
};

export function shippingNeedsProduct(compensation: string | null | undefined): boolean {
  const c = String(compensation || "").toLowerCase();
  return c === "product" || c === "both";
}

export function canEditShippingAddress(row: ShippingRow | null | undefined): boolean {
  if (!row) return true;
  return row.status === "pending_address" || row.status === "address_submitted";
}

export function canMarkShipped(row: ShippingRow | null | undefined): boolean {
  return row?.status === "address_submitted";
}

export function canConfirmReceipt(row: ShippingRow | null | undefined): boolean {
  return row?.status === "shipped";
}

/** RLS note: collaboration_shipping has REVOKE ALL; only service-role APIs read/write rows. */
export const SHIPPING_RLS_NOTE =
  "collaboration_shipping: RLS enabled, no grants to anon/authenticated; party checks in server APIs only.";