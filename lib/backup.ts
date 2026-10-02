/**
 * Local backup (export / import) of FacturePro data. Pure helpers, unit-tested in scripts/test.mjs.
 *
 * Everything stays on the user's device: the backup file is built in the browser and downloaded,
 * and an import only reads a file chosen by the user. Nothing is sent to a server.
 *
 * Exported: invoice history, business details, language, currency, the Stripe subscription id (so Pro
 * carries over; it is re-verified with Stripe on the server at each load) and this month's free usage.
 * NOT exported/imported: fp_pro_confirmed_at, fp_legacy_pro, fp_plan (the server check decides),
 * fp_last_export / fp_backup_snooze (device-specific).
 * Usage counter: an import can only RAISE this month's counter (max of current vs file), never lower it,
 * so a backup can't be used to reset the free monthly quota.
 */
import { isValidSubscriptionId, monthKey } from "./plan";

export const BACKUP_FORMAT = "facturepro-backup";
/** Format name used by TradeQuote backups (rejected here with a specific message). */
export const TRADEQUOTE_FORMAT = "tradequote-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024; // 5 MB
/** Invoices kept in the browser (was 50 for everyone). The free plan still only DISPLAYS the latest FREE_HISTORY_VISIBLE. */
export const MAX_HISTORY = 1000;
export const FREE_HISTORY_VISIBLE = 50;
export const LAST_EXPORT_KEY = "fp_last_export";
export const BACKUP_SNOOZE_KEY = "fp_backup_snooze";
export const REMINDER_DAYS = 30;
const DAY_MS = 86_400_000;

export type SavedInvoice = { id: string; number: string; clientName: string; total: number; date: string; createdAt: string };
export const COMPANY_FIELDS = ["name", "address", "city", "email", "phone", "bn", "gst", "qst", "interac"] as const;
export type Company = Record<(typeof COMPANY_FIELDS)[number], string>;
export const LANGS = ["fr", "en", "es"] as const;
export type BackupLang = (typeof LANGS)[number];
export const CURRENCIES = ["CAD", "USD", "EUR"] as const;
export type BackupCurrency = (typeof CURRENCIES)[number];

export type BackupData = {
  invoices: SavedInvoice[];
  company: Partial<Company>;
  lang?: BackupLang;
  langChoice?: boolean;
  currency?: BackupCurrency;
  sub?: string;
  usage?: { month: string; count: number };
};
export type Backup = { format: typeof BACKUP_FORMAT; app: "FacturePro"; version: number; exportedAt: string; data: BackupData };

export type BackupError = "tooLarge" | "empty" | "notJson" | "wrongApp" | "tradeQuoteFile" | "newerVersion" | "badShape";
export type ParseResult = { ok: true; backup: Backup; skipped: number } | { ok: false; error: BackupError };

type Getter = (key: string) => string | null;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const safeJson = (s: string | null): unknown => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};
const isLang = (v: unknown): v is BackupLang => typeof v === "string" && (LANGS as readonly string[]).includes(v);
const isCurrency = (v: unknown): v is BackupCurrency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** Validates/normalizes one invoice entry; returns null when unusable. */
export function sanitizeInvoice(v: unknown): SavedInvoice | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "number" && Number.isFinite(o.id) ? String(o.id) : str(o.id, 100);
  const number = str(o.number, 100);
  const total = typeof o.total === "number" && Number.isFinite(o.total) ? o.total : null;
  if (!id || number === null || total === null) return null;
  return { id, number, clientName: str(o.clientName, 300) ?? "", total, date: str(o.date, 40) ?? "", createdAt: str(o.createdAt, 40) ?? "" };
}

export function sanitizeInvoices(v: unknown): { docs: SavedInvoice[]; skipped: number } {
  if (!Array.isArray(v)) return { docs: [], skipped: 0 };
  const docs: SavedInvoice[] = [];
  let skipped = 0;
  for (const x of v) { const d = sanitizeInvoice(x); if (d) docs.push(d); else skipped++; }
  return { docs, skipped };
}

export function sanitizeCompany(v: unknown): Partial<Company> {
  const out: Partial<Company> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  const o = v as Record<string, unknown>;
  for (const k of COMPANY_FIELDS) { const s = str(o[k], 300); if (s !== null) out[k] = s; }
  return out;
}

/** Builds the backup object from this browser's localStorage (getter injected for tests). */
export function buildBackup(get: Getter, now: Date = new Date()): Backup {
  const data: BackupData = {
    invoices: sanitizeInvoices(safeJson(get("fp_invoices"))).docs,
    company: sanitizeCompany(safeJson(get("fp_company"))),
  };
  const lang = get("fp_lang");
  if (isLang(lang)) data.lang = lang;
  if (get("fp_lang_choice") === "1") data.langChoice = true;
  const cur = get("fp_currency");
  if (isCurrency(cur)) data.currency = cur;
  const sub = get("fp_sub");
  if (isValidSubscriptionId(sub)) data.sub = sub;
  const month = get("fp_count_month");
  const count = parseInt(get("fp_count") ?? "", 10);
  if (month && /^\d{4}-\d{2}$/.test(month) && Number.isFinite(count) && count > 0) data.usage = { month, count };
  return { format: BACKUP_FORMAT, app: "FacturePro", version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

/** Local date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function backupFileName(lang: BackupLang = "fr", d: Date = new Date()): string {
  const word = lang === "fr" ? "sauvegarde" : lang === "es" ? "respaldo" : "backup";
  return `facturepro-${word}-${localDate(d)}.json`;
}

/** Parses and validates a backup file's text. `byteSize` = File.size when known. */
export function parseBackup(text: string, byteSize?: number): ParseResult {
  if ((byteSize ?? 0) > MAX_BACKUP_BYTES || text.length > MAX_BACKUP_BYTES) return { ok: false, error: "tooLarge" };
  if (!text.trim()) return { ok: false, error: "empty" };
  let raw: unknown;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { return { ok: false, error: "notJson" }; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "wrongApp" };
  const o = raw as Record<string, unknown>;
  if (o.format === TRADEQUOTE_FORMAT) return { ok: false, error: "tradeQuoteFile" };
  if (o.format !== BACKUP_FORMAT) return { ok: false, error: "wrongApp" };
  if (typeof o.version !== "number" || !Number.isInteger(o.version) || o.version < 1) return { ok: false, error: "badShape" };
  if (o.version > BACKUP_VERSION) return { ok: false, error: "newerVersion" };
  const d = o.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, error: "badShape" };
  if (d.invoices !== undefined && !Array.isArray(d.invoices)) return { ok: false, error: "badShape" };
  if (d.company !== undefined && (typeof d.company !== "object" || d.company === null || Array.isArray(d.company))) return { ok: false, error: "badShape" };
  const { docs, skipped } = sanitizeInvoices(d.invoices);
  const data: BackupData = { invoices: docs, company: sanitizeCompany(d.company) };
  if (isLang(d.lang)) data.lang = d.lang;
  if (d.langChoice === true) data.langChoice = true;
  if (isCurrency(d.currency)) data.currency = d.currency;
  if (isValidSubscriptionId(d.sub)) data.sub = d.sub;
  const u = d.usage as Record<string, unknown> | undefined;
  if (u && typeof u.month === "string" && /^\d{4}-\d{2}$/.test(u.month) && typeof u.count === "number" && Number.isFinite(u.count) && u.count > 0)
    data.usage = { month: u.month, count: Math.floor(u.count) };
  const exportedAt = typeof o.exportedAt === "string" && !isNaN(Date.parse(o.exportedAt)) ? o.exportedAt : "";
  return { ok: true, backup: { format: BACKUP_FORMAT, app: "FacturePro", version: o.version, exportedAt, data }, skipped };
}

const numKey = (d: SavedInvoice) => d.number.trim().toLowerCase();
const invTime = (d: SavedInvoice) => {
  const t = Date.parse(d.createdAt) || Date.parse(d.date);
  return Number.isFinite(t) ? t : 0;
};

/**
 * Merges invoice lists without duplicates. An invoice is a duplicate when it has the same id, or the same
 * number (case-insensitive, trimmed) as one already present. On conflict the CURRENT browser's copy wins.
 * Result is sorted newest first and capped at MAX_HISTORY.
 */
export function mergeInvoices(current: SavedInvoice[], incoming: SavedInvoice[]): { invoices: SavedInvoice[]; added: number; duplicates: number } {
  const ids = new Set(current.map((d) => d.id));
  const nums = new Set(current.map(numKey).filter(Boolean));
  const out = [...current];
  let added = 0, duplicates = 0;
  for (const d of incoming) {
    const k = numKey(d);
    if (ids.has(d.id) || (k && nums.has(k))) { duplicates++; continue; }
    ids.add(d.id); if (k) nums.add(k); out.push(d); added++;
  }
  out.sort((a, b) => invTime(b) - invTime(a) || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
  return { invoices: out.slice(0, MAX_HISTORY), added, duplicates };
}

/** Merge: fields already filled in this browser are kept; empty ones are filled from the file. */
export function mergeCompany(current: Partial<Company>, incoming: Partial<Company>): Partial<Company> {
  const out: Partial<Company> = { ...current };
  for (const k of COMPANY_FIELDS) if (!(current[k] ?? "").trim() && incoming[k]) out[k] = incoming[k];
  return out;
}

export type ImportMode = "merge" | "replace";
export type ImportPlan = {
  set: Record<string, string>;
  remove: string[];
  invoices: SavedInvoice[];
  company: Partial<Company>;
  lang: BackupLang | null;
  currency: BackupCurrency | null;
  count: number;
  subChanged: boolean;
  added: number;
  duplicates: number;
};

/** Computes what an import writes, from the current localStorage (getter) and a parsed backup. */
export function planImport(get: Getter, backup: Backup, mode: ImportMode, now: Date = new Date()): ImportPlan {
  const curInvoices = sanitizeInvoices(safeJson(get("fp_invoices"))).docs;
  const curCompany = sanitizeCompany(safeJson(get("fp_company")));
  const d = backup.data;

  let invoices: SavedInvoice[], added: number, duplicates = 0;
  if (mode === "replace") { invoices = mergeInvoices([], d.invoices).invoices; added = invoices.length; }
  else ({ invoices, added, duplicates } = mergeInvoices(curInvoices, d.invoices));
  const company = mode === "replace" ? { ...d.company } : mergeCompany(curCompany, d.company);

  const set: Record<string, string> = { fp_invoices: JSON.stringify(invoices), fp_company: JSON.stringify(company) };
  const remove: string[] = [];

  // Language: replace -> the file's; merge -> only if this browser has no explicit choice yet.
  let lang: BackupLang | null = null;
  if (d.lang && (mode === "replace" || get("fp_lang_choice") !== "1")) {
    lang = d.lang; set.fp_lang = d.lang;
    if (d.langChoice) set.fp_lang_choice = "1";
  }
  // Currency: replace -> the file's; merge -> only on a fresh browser (no invoices yet, or no currency stored).
  // (The app always stores a currency, CAD by default, so "stored" alone can't tell a real choice apart.)
  let currency: BackupCurrency | null = null;
  if (d.currency && (mode === "replace" || !isCurrency(get("fp_currency")) || curInvoices.length === 0)) { currency = d.currency; set.fp_currency = d.currency; }

  // Free-plan counter: only ever raised (never reset by an import).
  const thisMonth = monthKey(now);
  const curCountRaw = parseInt(get("fp_count") ?? "0", 10);
  const curCount = get("fp_count_month") === thisMonth && Number.isFinite(curCountRaw) && curCountRaw > 0 ? curCountRaw : 0;
  const fileCount = d.usage && d.usage.month === thisMonth ? d.usage.count : 0;
  const count = Math.max(curCount, fileCount);
  set.fp_count = String(count); set.fp_count_month = thisMonth;

  // Subscription id: carried over so Pro follows; always re-verified with Stripe by the server.
  const curSub = get("fp_sub");
  let subChanged = false;
  if (d.sub && d.sub !== curSub && (mode === "replace" || !isValidSubscriptionId(curSub))) {
    set.fp_sub = d.sub; subChanged = true;
    remove.push("fp_pro_confirmed_at");
  }
  return { set, remove, invoices, company, lang, currency, count, subChanged, added, duplicates };
}

/** Gentle reminder: data older than REMINDER_DAYS and no export (or "later") in the last REMINDER_DAYS. */
export function exportReminderDue(opts: { lastExport: string | null; snoozedAt: string | null; invoices: SavedInvoice[]; now?: number }): boolean {
  const now = opts.now ?? Date.now();
  if (!opts.invoices.length) return false;
  const n = (s: string | null) => { const x = parseInt(s ?? "", 10); return Number.isFinite(x) && x > 0 ? x : 0; };
  let oldest = now;
  for (const d of opts.invoices) {
    const t = /^\d{12,14}$/.test(d.id) ? Number(d.id) : invTime(d) || now;
    if (t < oldest) oldest = t;
  }
  return now - Math.max(n(opts.lastExport), n(opts.snoozedAt), oldest) > REMINDER_DAYS * DAY_MS;
}
