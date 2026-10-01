/**
 * Plan / entitlement helpers (pure, unit-tested in scripts/test.mjs).
 *
 * Pro is NO LONGER trusted from localStorage. The browser only keeps the Stripe
 * subscription id returned by /api/verify-session; Pro is granted after the server
 * confirms that subscription with Stripe (/api/subscription-status).
 */
export const FREE_LIMIT = 5;

/** Statuses that keep Pro unlocked (past_due = Stripe is still retrying the card). */
export const ENTITLED_STATUSES = ["active", "trialing", "past_due"] as const;

/** If the status API is unreachable, keep the last confirmed Pro for this long. */
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isEntitled(status: string | null | undefined, subApp: string | null | undefined, app: string): boolean {
  return subApp === app && !!status && (ENTITLED_STATUSES as readonly string[]).includes(status);
}

export function isValidSubscriptionId(id: unknown): id is string {
  return typeof id === "string" && /^sub_[A-Za-z0-9]{8,}$/.test(id);
}

/** "2026-10" — used to reset the free counter every calendar month. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the usable count for this month (0 if the stored count is from another month). */
export function countForThisMonth(storedMonth: string | null, storedCount: string | null, now: Date = new Date()): number {
  if (storedMonth !== monthKey(now)) return 0;
  const n = parseInt(storedCount ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Decide plan from the server answer: true/false = authoritative, null = unknown (offline/misconfigured). */
export function resolvePro(serverPro: boolean | null, lastConfirmedAt: number | null, now: number = Date.now()): boolean {
  if (serverPro === true) return true;
  if (serverPro === false) return false;
  return !!lastConfirmedAt && now - lastConfirmedAt < OFFLINE_GRACE_MS;
}

/**
 * Compatibility for users who were Pro under the old version (plan "pro" stored in the browser,
 * no subscription id). They keep Pro until this date and are asked to link their subscription
 * (restore link /?restore=sub_… sent by email, or contact). After that date, server check only.
 */
export const LEGACY_PRO_UNTIL = Date.UTC(2027, 0, 1, 5, 0, 0); // 2027-01-01 00:00 America/Toronto

export function legacyProActive(flag: string | null, now: number = Date.now()): boolean {
  return flag === "1" && now < LEGACY_PRO_UNTIL;
}

/** One-time migration decision for the old localStorage plan value. */
export function migrateLegacyPlan(oldPlan: string | null, subId: string | null): "legacy" | "none" {
  return oldPlan === "pro" && !isValidSubscriptionId(subId) ? "legacy" : "none";
}
