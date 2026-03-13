const STORAGE_KEY = 'influo_visitor_id';

/** Get or create a persistent anonymous visitor ID (for unique-per-user analytics). */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = 'v_' + crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
