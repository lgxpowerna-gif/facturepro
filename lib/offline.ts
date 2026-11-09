/**
 * Offline mode for FacturePro Pro.
 *
 * Business data already lives in this browser (there is no invoice database on the server).
 * Pro subscribers can keep reading and editing it without a network. Changes go into a local
 * queue and are committed, in order, when the connection returns. If the stored copy moved
 * in the meantime, the newer timestamp wins and the loser is reported — nothing is merged blindly.
 *
 * Free / unpaid browsers do not get this. A raw `fp_plan=pro` flag is ignored; offline entitlement
 * is the same server-confirmed Pro grace already used by `resolvePro` (or the legacy Pro window).
 * The service worker must not cache `/api/*` (Stripe) or its own script.
 */
import { isValidSubscriptionId, legacyProActive, resolvePro } from "./plan";

/** Bump the suffix when the cached shell must be discarded. Keep public/sw.js in sync. */
export const SW_CACHE_NAME = "facturepro-shell-v1";

export const OFFLINE_KEYS = {
  invoices: "fp_invoice_docs",
  clients: "fp_clients",
  products: "fp_products",
  outbox: "fp_outbox",
} as const;

export type EntityName = "invoice" | "client" | "product";

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceRecord = {
  id: string;
  number: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  notes: string;
  items: InvoiceItem[];
  total: number;
  taxPreset: string;
  customTaxRate: number;
  discountPct: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientRecord = {
  id: string;
  name: string;
  address: string;
  city: string;
  email: string;
  updatedAt: string;
};

export type ProductRecord = {
  id: string;
  name: string;
  unitPrice: number;
  updatedAt: string;
};

export type AnyRecord = InvoiceRecord | ClientRecord | ProductRecord;

export type OutboxOp = {
  opId: string;
  entity: EntityName;
  entityId: string;
  action: "upsert" | "delete";
  /** updatedAt we edited from. null = created locally, the row did not exist yet. */
  baseUpdatedAt: string | null;
  queuedAt: string;
  record: AnyRecord | null;
};

export type OfflineStore = {
  invoices: InvoiceRecord[];
  clients: ClientRecord[];
  products: ProductRecord[];
  outbox: OutboxOp[];
};

export type InvoiceSummary = {
  id: string;
  number: string;
  clientName: string;
  total: number;
  date: string;
  createdAt: string;
};

export type SyncConflict = {
  opId: string;
  entity: EntityName;
  entityId: string;
  resolution: "kept-pending" | "kept-stored";
};

export type SyncReport = {
  store: OfflineStore;
  applied: string[];
  dropped: string[];
  conflicts: SyncConflict[];
};

const MAX_DOCS = 1000;
const MAX_ITEMS = 80;

export function emptyStore(): OfflineStore {
  return { invoices: [], clients: [], products: [], outbox: [] };
}

/** Open the workspace, or lock it. Offline is a Pro benefit — never a way around the free plan. */
export function offlineMode(input: { online: boolean; pro: boolean }): "open" | "locked" {
  if (input.online) return "open";
  return input.pro ? "open" : "locked";
}

/**
 * Snapshot entitlement readable with no network.
 * Ignores the old client-writable `fp_plan` value. A paid user keeps offline access only while
 * the server-confirmed grace (or the legacy Pro window) is still valid.
 */
export function offlineEntitled(get: (key: string) => string | null, now: number = Date.now()): boolean {
  if (legacyProActive(get("fp_legacy_pro"), now)) return true;
  if (!isValidSubscriptionId(get("fp_sub"))) return false;
  const last = Number(get("fp_pro_confirmed_at"));
  if (!Number.isFinite(last)) return false;
  return resolvePro(null, last, now);
}

/** Paths the service worker is allowed to store. Mirrors the guards in public/sw.js. */
export function isCacheableRequest(method: string, pathname: string, search = ""): boolean {
  if (method !== "GET") return false;
  if (!pathname.startsWith("/")) return false;
  if (pathname === "/sw.js" || pathname.startsWith("/api/")) return false;
  if (search.includes("_rsc=") || search.includes("__next")) return false;
  return true;
}

export function stableId(prefix: string, name: string): string {
  const s = name.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return `${prefix}_${(h >>> 0).toString(36)}`;
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const stamp = (v: unknown): string | null => {
  const s = str(v, 40);
  return s ? s : null;
};

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function sanitizeInvoice(v: unknown): InvoiceRecord | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 80);
  const number = str(o.number, 80);
  const updatedAt = stamp(o.updatedAt);
  const createdAt = stamp(o.createdAt) ?? updatedAt;
  const total = num(o.total);
  if (!id || !number || !updatedAt || !createdAt || total === null) return null;
  const itemsIn = Array.isArray(o.items) ? o.items.slice(0, MAX_ITEMS) : [];
  const items: InvoiceItem[] = [];
  for (const raw of itemsIn) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const itemId = str(it.id, 80);
    if (!itemId) continue;
    items.push({
      id: itemId,
      description: str(it.description, 300),
      quantity: num(it.quantity) ?? 0,
      unitPrice: num(it.unitPrice) ?? 0,
    });
  }
  return {
    id,
    number,
    clientName: str(o.clientName, 300),
    clientAddress: str(o.clientAddress, 300),
    clientCity: str(o.clientCity, 300),
    clientEmail: str(o.clientEmail, 300),
    date: str(o.date, 40),
    dueDate: str(o.dueDate, 40),
    notes: str(o.notes, 2000),
    items,
    total,
    taxPreset: str(o.taxPreset, 40),
    customTaxRate: num(o.customTaxRate) ?? 0,
    discountPct: num(o.discountPct) ?? 0,
    currency: str(o.currency, 8),
    createdAt,
    updatedAt,
  };
}

export function sanitizeClient(v: unknown): ClientRecord | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 80);
  const name = str(o.name, 300);
  const updatedAt = stamp(o.updatedAt);
  if (!id || !name || !updatedAt) return null;
  return { id, name, address: str(o.address, 300), city: str(o.city, 300), email: str(o.email, 300), updatedAt };
}

export function sanitizeProduct(v: unknown): ProductRecord | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 80);
  const name = str(o.name, 300);
  const updatedAt = stamp(o.updatedAt);
  const unitPrice = num(o.unitPrice);
  if (!id || !name || !updatedAt || unitPrice === null) return null;
  return { id, name, unitPrice, updatedAt };
}

function isEntity(v: unknown): v is EntityName {
  return v === "invoice" || v === "client" || v === "product";
}

export function sanitizeOp(v: unknown): OutboxOp | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const opId = str(o.opId, 120);
  const entityId = str(o.entityId, 80);
  const queuedAt = stamp(o.queuedAt);
  if (!opId || !isEntity(o.entity) || !entityId || !queuedAt) return null;
  if (o.action !== "upsert" && o.action !== "delete") return null;
  const base = o.baseUpdatedAt == null || o.baseUpdatedAt === "" ? null : stamp(o.baseUpdatedAt);
  if (o.baseUpdatedAt != null && o.baseUpdatedAt !== "" && !base) return null;
  let record: AnyRecord | null = null;
  if (o.action === "upsert") {
    record = o.entity === "invoice" ? sanitizeInvoice(o.record) : o.entity === "client" ? sanitizeClient(o.record) : sanitizeProduct(o.record);
    if (!record || record.id !== entityId) return null;
  }
  return { opId, entity: o.entity, entityId, action: o.action, baseUpdatedAt: base, queuedAt, record };
}

function takeUnique<T extends { id: string }>(list: unknown, sanitize: (v: unknown) => T | null): T[] {
  if (!Array.isArray(list)) return [];
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of list) {
    const clean = sanitize(row);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
    if (out.length >= MAX_DOCS) break;
  }
  return out;
}

export function loadOfflineState(get: (key: string) => string | null): OfflineStore {
  const opsRaw = parseJson(get(OFFLINE_KEYS.outbox));
  const outbox: OutboxOp[] = [];
  const seenOps = new Set<string>();
  if (Array.isArray(opsRaw)) {
    for (const row of opsRaw) {
      const op = sanitizeOp(row);
      if (!op || seenOps.has(op.opId)) continue;
      seenOps.add(op.opId);
      outbox.push(op);
      if (outbox.length >= MAX_DOCS) break;
    }
  }
  return {
    invoices: takeUnique(parseJson(get(OFFLINE_KEYS.invoices)), sanitizeInvoice),
    clients: takeUnique(parseJson(get(OFFLINE_KEYS.clients)), sanitizeClient),
    products: takeUnique(parseJson(get(OFFLINE_KEYS.products)), sanitizeProduct),
    outbox,
  };
}

export function toSummary(doc: InvoiceRecord): InvoiceSummary {
  return {
    id: doc.id,
    number: doc.number,
    clientName: doc.clientName,
    total: doc.total,
    date: doc.date,
    createdAt: doc.createdAt,
  };
}

/** Full documents win over a legacy summary with the same id or invoice number. */
export function mergeHistory(docs: InvoiceRecord[], legacy: InvoiceSummary[], limit = MAX_DOCS): InvoiceSummary[] {
  const fromDocs = docs.map(toSummary);
  const seen = new Set(fromDocs.map((d) => d.id));
  const numbers = new Set(fromDocs.map((d) => d.number.trim().toLowerCase()).filter(Boolean));
  const rest: InvoiceSummary[] = [];
  for (const row of legacy) {
    if (!row || typeof row.id !== "string") continue;
    if (seen.has(row.id)) continue;
    const numKey = (row.number || "").trim().toLowerCase();
    if (numKey && numbers.has(numKey)) continue;
    seen.add(row.id);
    if (numKey) numbers.add(numKey);
    rest.push({
      id: row.id.slice(0, 80),
      number: (row.number || "").slice(0, 80),
      clientName: (row.clientName || "").slice(0, 300),
      total: typeof row.total === "number" && Number.isFinite(row.total) ? row.total : 0,
      date: (row.date || "").slice(0, 40),
      createdAt: (row.createdAt || "").slice(0, 40),
    });
  }
  return [...fromDocs, ...rest]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || b.id.localeCompare(a.id))
    .slice(0, limit);
}

function listKey(entity: EntityName): "invoices" | "clients" | "products" {
  if (entity === "invoice") return "invoices";
  if (entity === "client") return "clients";
  return "products";
}

export function baseStamp(store: OfflineStore, entity: EntityName, id: string): string | null {
  const row = store[listKey(entity)].find((r) => r.id === id);
  return row ? row.updatedAt : null;
}

/** One pending op per record. A later edit keeps the original base so conflicts stay honest. */
export function enqueueOp(store: OfflineStore, op: OutboxOp): OfflineStore {
  const idx = store.outbox.findIndex((o) => o.entity === op.entity && o.entityId === op.entityId);
  if (idx === -1) return { ...store, outbox: [...store.outbox, op] };
  const prev = store.outbox[idx];
  const next = store.outbox.slice();
  next[idx] = { ...op, opId: prev.opId, baseUpdatedAt: prev.baseUpdatedAt, queuedAt: prev.queuedAt };
  return { ...store, outbox: next };
}

export function clientFromInvoice(doc: InvoiceRecord): ClientRecord | null {
  const name = doc.clientName.trim();
  if (!name) return null;
  return {
    id: stableId("cli", name),
    name,
    address: doc.clientAddress,
    city: doc.clientCity,
    email: doc.clientEmail,
    updatedAt: doc.updatedAt,
  };
}

export function productsFromInvoice(doc: InvoiceRecord): ProductRecord[] {
  const out: ProductRecord[] = [];
  const seen = new Set<string>();
  for (const item of doc.items) {
    const name = item.description.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: stableId("prd", name), name, unitPrice: item.unitPrice, updatedAt: doc.updatedAt });
  }
  return out;
}

export function queueInvoice(store: OfflineStore, doc: InvoiceRecord, now: string): OfflineStore {
  let next = enqueueOp(store, {
    opId: `op_invoice_${doc.id}_${now}`,
    entity: "invoice",
    entityId: doc.id,
    action: "upsert",
    baseUpdatedAt: baseStamp(store, "invoice", doc.id),
    queuedAt: now,
    record: doc,
  });
  const client = clientFromInvoice(doc);
  if (client) {
    next = enqueueOp(next, {
      opId: `op_client_${client.id}_${now}`,
      entity: "client",
      entityId: client.id,
      action: "upsert",
      baseUpdatedAt: baseStamp(store, "client", client.id),
      queuedAt: now,
      record: client,
    });
  }
  for (const product of productsFromInvoice(doc)) {
    next = enqueueOp(next, {
      opId: `op_product_${product.id}_${now}`,
      entity: "product",
      entityId: product.id,
      action: "upsert",
      baseUpdatedAt: baseStamp(store, "product", product.id),
      queuedAt: now,
      record: product,
    });
  }
  return next;
}

function sortedOps(outbox: OutboxOp[]): OutboxOp[] {
  return [...outbox].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.opId.localeCompare(b.opId));
}

function matches(record: AnyRecord, entity: EntityName): boolean {
  if (entity === "invoice") return "items" in record;
  if (entity === "client") return "email" in record && !("items" in record);
  return "unitPrice" in record && !("email" in record) && !("items" in record);
}

/**
 * Commit the queue onto the canonical lists.
 * - Same base → pending edit applies (no conflict).
 * - The row changed since we read it → the newer updatedAt wins.
 * - A delete never removes a copy that moved on, and an edit never resurrects a deleted row.
 */
export function syncOutbox(store: OfflineStore): SyncReport {
  const invoices = new Map(store.invoices.map((r) => [r.id, r]));
  const clients = new Map(store.clients.map((r) => [r.id, r]));
  const products = new Map(store.products.map((r) => [r.id, r]));
  const maps = { invoice: invoices, client: clients, product: products };
  const applied: string[] = [];
  const dropped: string[] = [];
  const conflicts: SyncConflict[] = [];
  const seen = new Set<string>();

  for (const op of sortedOps(store.outbox)) {
    if (seen.has(op.opId)) continue;
    seen.add(op.opId);
    const map = maps[op.entity] as Map<string, AnyRecord>;
    const current = map.get(op.entityId);

    if (op.action === "delete") {
      if (!current) {
        applied.push(op.opId);
        continue;
      }
      if (op.baseUpdatedAt && current.updatedAt === op.baseUpdatedAt) {
        map.delete(op.entityId);
        applied.push(op.opId);
        continue;
      }
      conflicts.push({ opId: op.opId, entity: op.entity, entityId: op.entityId, resolution: "kept-stored" });
      applied.push(op.opId);
      continue;
    }

    const incoming = op.record;
    if (!incoming || incoming.id !== op.entityId || !matches(incoming, op.entity)) {
      dropped.push(op.opId);
      continue;
    }

    if (!current) {
      if (op.baseUpdatedAt) {
        // Edited a row that has since been deleted — do not bring it back.
        conflicts.push({ opId: op.opId, entity: op.entity, entityId: op.entityId, resolution: "kept-stored" });
      } else {
        map.set(op.entityId, incoming);
      }
      applied.push(op.opId);
      continue;
    }

    if (current.updatedAt === op.baseUpdatedAt) {
      map.set(op.entityId, incoming);
      applied.push(op.opId);
      continue;
    }

    if (incoming.updatedAt >= current.updatedAt) {
      map.set(op.entityId, incoming);
      conflicts.push({ opId: op.opId, entity: op.entity, entityId: op.entityId, resolution: "kept-pending" });
    } else {
      conflicts.push({ opId: op.opId, entity: op.entity, entityId: op.entityId, resolution: "kept-stored" });
    }
    applied.push(op.opId);
  }

  const byUpdated = (a: { updatedAt: string; id: string }, b: { updatedAt: string; id: string }) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

  return {
    store: {
      invoices: Array.from(invoices.values()).sort(byUpdated).slice(0, MAX_DOCS) as InvoiceRecord[],
      clients: Array.from(clients.values()).sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id)).slice(0, MAX_DOCS),
      products: Array.from(products.values()).sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id)).slice(0, MAX_DOCS),
      outbox: [],
    },
    applied,
    dropped,
    conflicts,
  };
}

/** What the screen shows: canonical rows with the pending queue painted on top. */
export function projectStore(store: OfflineStore): OfflineStore {
  const view: OfflineStore = {
    invoices: [...store.invoices],
    clients: [...store.clients],
    products: [...store.products],
    outbox: store.outbox,
  };
  const put = (entity: EntityName, record: AnyRecord) => {
    if (entity === "invoice" && "items" in record) {
      const idx = view.invoices.findIndex((r) => r.id === record.id);
      if (idx === -1) view.invoices.unshift(record);
      else view.invoices[idx] = record;
    } else if (entity === "client" && "email" in record && !("items" in record)) {
      const idx = view.clients.findIndex((r) => r.id === record.id);
      if (idx === -1) view.clients.unshift(record);
      else view.clients[idx] = record;
    } else if (entity === "product" && "unitPrice" in record && !("email" in record)) {
      const idx = view.products.findIndex((r) => r.id === record.id);
      if (idx === -1) view.products.unshift(record);
      else view.products[idx] = record;
    }
  };
  for (const op of sortedOps(store.outbox)) {
    if (op.action === "delete") {
      if (op.entity === "invoice") view.invoices = view.invoices.filter((r) => r.id !== op.entityId);
      else if (op.entity === "client") view.clients = view.clients.filter((r) => r.id !== op.entityId);
      else view.products = view.products.filter((r) => r.id !== op.entityId);
      continue;
    }
    if (op.record && op.record.id === op.entityId) put(op.entity, op.record);
  }
  return view;
}

export function saveInvoice(
  store: OfflineStore,
  doc: InvoiceRecord,
  now: string,
  online: boolean
): { store: OfflineStore; report: SyncReport | null } {
  const queued = queueInvoice(store, doc, now);
  if (!online) return { store: queued, report: null };
  const report = syncOutbox(queued);
  return { store: report.store, report };
}
