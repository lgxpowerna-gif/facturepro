// Minimal dependency-free unit tests: transpile lib/*.ts with the project's TypeScript and assert.
// Run: npm test
import ts from "typescript";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "libtest-"));
async function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"'); // lib-relative imports -> transpiled siblings
  const file = path.join(tmp, path.basename(rel).replace(/\.ts$/, ".mjs"));
  fs.writeFileSync(file, out);
  return import(pathToFileURL(file).href);
}

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n", e.message); process.exitCode = 1; }
};

const tax = await load("lib/tax.ts");
const plan = await load("lib/plan.ts");

console.log("tax");
await test("default preset is Québec TPS+TVQ", () => {
  const p = tax.TAX_PRESETS.find((x) => x.id === tax.DEFAULT_TAX_PRESET);
  assert.deepEqual(p.components.map((c) => [c.label.fr, c.rate]), [["TPS", 5], ["TVQ", 9.975]]);
});
await test("100 $ -> TPS 5,00 + TVQ 9,98 = 114,98", () => {
  const r = tax.computeTaxes(100, tax.DEFAULT_TAX_PRESET, "fr");
  assert.deepEqual(r.lines.map((l) => [l.label, l.amount]), [["TPS", 5], ["TVQ", 9.98]]);
  assert.equal(r.totalTax, 14.98);
  assert.equal(r.total, 114.98);
});
await test("1 234,56 $ -> TPS 61,73 + TVQ 123,15 = 1 419,44", () => {
  const r = tax.computeTaxes(1234.56, tax.DEFAULT_TAX_PRESET, "fr");
  assert.deepEqual(r.lines.map((l) => l.amount), [61.73, 123.15]);
  assert.equal(r.total, 1419.44);
});
await test("TVQ is not charged on TPS", () => {
  const r = tax.computeTaxes(1000, tax.DEFAULT_TAX_PRESET, "fr");
  assert.equal(r.lines[1].amount, 99.75);
});
await test("English labels GST/QST", () => {
  const r = tax.computeTaxes(10, tax.DEFAULT_TAX_PRESET, "en");
  assert.deepEqual(r.lines.map((l) => l.label), ["GST", "QST"]);
});
await test("Ontario HST 13 % single line", () => {
  const id = tax.TAX_PRESETS.find((p) => p.components.length === 1 && p.components[0].rate === 13).id;
  const r = tax.computeTaxes(200, id, "fr");
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].label, "TVH");
  assert.equal(r.total, 226);
});
await test("no tax / custom / negative input", () => {
  const none = tax.TAX_PRESETS.find((p) => p.id === "none").id;
  assert.equal(tax.computeTaxes(50, none).total, 50);
  assert.equal(tax.computeTaxes(100, "custom", "fr", 8).total, 108);
  assert.equal(tax.computeTaxes(-20, tax.DEFAULT_TAX_PRESET).total, 0);
});
await test("formatRate fr/en", () => {
  assert.equal(tax.formatRate(9.975, "fr"), "9,975 %");
  assert.equal(tax.formatRate(9.975, "en"), "9.975%");
});

console.log("plan");
await test("legacy Pro migration keeps old Pro users until 2027-01-01 (Toronto)", () => {
  assert.equal(plan.migrateLegacyPlan("pro", null), "legacy");
  assert.equal(plan.migrateLegacyPlan("pro", "sub_1PqRsTuVwXyZ"), "none");
  assert.equal(plan.migrateLegacyPlan("free", null), "none");
  assert.equal(plan.migrateLegacyPlan(null, null), "none");
  assert.equal(plan.legacyProActive("1", Date.UTC(2026, 11, 31, 12)), true);
  assert.equal(plan.legacyProActive("1", Date.UTC(2027, 0, 1, 6)), false);
  assert.equal(plan.legacyProActive(null, Date.UTC(2026, 9, 1)), false);
});

await test("entitled only for this app and active-like statuses", () => {
  assert.equal(plan.isEntitled("active", "APPNAME", "APPNAME"), true);
  assert.equal(plan.isEntitled("trialing", "APPNAME", "APPNAME"), true);
  assert.equal(plan.isEntitled("canceled", "APPNAME", "APPNAME"), false);
  assert.equal(plan.isEntitled("active", "other-app", "APPNAME"), false);
  assert.equal(plan.isEntitled("active", undefined, "APPNAME"), false);
});
await test("subscription id validation", () => {
  assert.equal(plan.isValidSubscriptionId("sub_1PqRsTuVwXyZ"), true);
  assert.equal(plan.isValidSubscriptionId("pro"), false);
  assert.equal(plan.isValidSubscriptionId("sub_../../x"), false);
  assert.equal(plan.isValidSubscriptionId(null), false);
});
await test("free counter resets each month", () => {
  const oct = new Date(2026, 9, 15);
  assert.equal(plan.monthKey(oct), "2026-10");
  assert.equal(plan.countForThisMonth("2026-10", "4", oct), 4);
  assert.equal(plan.countForThisMonth("2026-09", "5", oct), 0);
  assert.equal(plan.countForThisMonth(null, "5", oct), 0);
});
await test("resolvePro: server wins, offline grace 7 days", () => {
  const now = 1_000_000_000_000;
  assert.equal(plan.resolvePro(true, null, now), true);
  assert.equal(plan.resolvePro(false, now, now), false);
  assert.equal(plan.resolvePro(null, now - 86400000, now), true);
  assert.equal(plan.resolvePro(null, now - 8 * 86400000, now), false);
  assert.equal(plan.resolvePro(null, null, now), false);
});


const backup = await load("lib/backup.ts");
console.log("backup");
const store = (o) => (k) => (k in o ? o[k] : null);
const oct = new Date(2026, 9, 2, 12);
const inv = (id, number, date = "2026-10-01", total = 100) => ({ id, number, clientName: "Client " + id, total, date, createdAt: date + "T12:00:00.000Z" });
const fullStore = {
  fp_invoices: JSON.stringify([inv("1790000000001", "FAC-2026-1001"), inv("1790000000002", "FAC-2026-2002", "2026-09-15", 250.5)]),
  fp_company: JSON.stringify({ name: "Atelier Laurier", gst: "123", qst: "456", evil: "<script>" }),
  fp_lang: "en", fp_lang_choice: "1", fp_currency: "USD", fp_sub: "sub_1PqRsTuVwXyZ", fp_count: "3", fp_count_month: "2026-10",
  fp_pro_confirmed_at: "1790000000000", fp_legacy_pro: "1", fp_last_export: "1", fp_backup_snooze: "1", fp_plan: "pro",
};
await test("export: format/version/date, user keys incl. sub + currency; no confirmed_at / legacy / last export", () => {
  const b = backup.buildBackup(store(fullStore), oct);
  assert.equal(b.format, "facturepro-backup");
  assert.notEqual(b.format, "tradequote-backup");
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, oct.toISOString());
  assert.equal(b.data.invoices.length, 2);
  assert.deepEqual(b.data.company, { name: "Atelier Laurier", gst: "123", qst: "456" });
  assert.equal(b.data.lang, "en");
  assert.equal(b.data.langChoice, true);
  assert.equal(b.data.currency, "USD");
  assert.equal(b.data.sub, "sub_1PqRsTuVwXyZ");
  assert.deepEqual(b.data.usage, { month: "2026-10", count: 3 });
  const json = JSON.stringify(b);
  for (const k of ["pro_confirmed", "legacy", "last_export", "snooze", "fp_plan"]) assert.ok(!json.includes(k), k);
});
await test("export from empty browser + file names fr/en/es", () => {
  const b = backup.buildBackup(store({ fp_sub: "pro", fp_invoices: "not json", fp_currency: "GBP" }), oct);
  assert.deepEqual(b.data.invoices, []);
  assert.equal(b.data.sub, undefined);
  assert.equal(b.data.currency, undefined);
  assert.equal(backup.backupFileName("fr", oct), "facturepro-sauvegarde-2026-10-02.json");
  assert.equal(backup.backupFileName("en", oct), "facturepro-backup-2026-10-02.json");
  assert.equal(backup.backupFileName("es", oct), "facturepro-respaldo-2026-10-02.json");
});
await test("round trip: export -> parse", () => {
  const b = backup.buildBackup(store(fullStore), oct);
  const r = backup.parseBackup(JSON.stringify(b, null, 2));
  assert.equal(r.ok, true);
  assert.deepEqual(r.backup.data, b.data);
});
await test("parse: TradeQuote files rejected; clear error codes", () => {
  const ok = { format: "facturepro-backup", version: 1, exportedAt: "2026-10-02T00:00:00Z", data: { invoices: [] } };
  assert.deepEqual(backup.parseBackup(JSON.stringify({ format: "tradequote-backup", version: 1, data: { history: [] } })), { ok: false, error: "tradeQuoteFile" });
  assert.deepEqual(backup.parseBackup("{oops"), { ok: false, error: "notJson" });
  assert.deepEqual(backup.parseBackup(""), { ok: false, error: "empty" });
  assert.deepEqual(backup.parseBackup("[1]"), { ok: false, error: "wrongApp" });
  assert.deepEqual(backup.parseBackup(JSON.stringify({ version: 1, data: {} })), { ok: false, error: "wrongApp" });
  assert.deepEqual(backup.parseBackup(JSON.stringify({ ...ok, version: 2 })), { ok: false, error: "newerVersion" });
  assert.deepEqual(backup.parseBackup(JSON.stringify({ ...ok, version: 0 })), { ok: false, error: "badShape" });
  assert.deepEqual(backup.parseBackup(JSON.stringify({ ...ok, data: { invoices: {} } })), { ok: false, error: "badShape" });
  assert.deepEqual(backup.parseBackup(JSON.stringify({ ...ok, data: { company: "x" } })), { ok: false, error: "badShape" });
  assert.deepEqual(backup.parseBackup("{}", 5 * 1024 * 1024 + 1), { ok: false, error: "tooLarge" });
  assert.equal(backup.parseBackup(JSON.stringify(ok), 5 * 1024 * 1024).ok, true);
});
await test("parse: invalid entries skipped, bad sub/usage/lang/currency dropped", () => {
  const r = backup.parseBackup(JSON.stringify({ format: "facturepro-backup", version: 1, data: {
    invoices: [inv("a", "FAC-1"), { id: "b", number: 5, total: 1 }, "x", { id: 7, number: "FAC-7", total: 7 }],
    sub: "sub_x", usage: { month: "oct", count: 2 }, lang: "de", currency: "GBP" } }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.backup.data.invoices.map((d) => d.id), ["a", "7"]);
  assert.equal(r.skipped, 2);
  for (const k of ["sub", "usage", "lang", "currency"]) assert.equal(r.backup.data[k], undefined, k);
});
await test("merge invoices: no duplicates by id or number, current copy wins, newest first", () => {
  const cur = [inv("1", "FAC-2026-1001", "2026-10-01"), inv("2", "FAC-2026-2002", "2026-09-01")];
  const inc = [inv("1", "FAC-2026-1001", "2026-10-01", 999), inv("99", " fac-2026-1001"), inv("3", "FAC-2026-3003", "2026-09-20"), inv("4", "INV-2026-4004", "2026-08-01")];
  const m = backup.mergeInvoices(cur, inc);
  assert.deepEqual(m.invoices.map((d) => d.id), ["1", "3", "2", "4"]);
  assert.equal(m.invoices[0].total, 100);
  assert.equal(m.added, 2);
  assert.equal(m.duplicates, 2);
  const many = Array.from({ length: backup.MAX_HISTORY + 5 }, (_, i) => inv(String(i), "F-" + i));
  assert.equal(backup.mergeInvoices([], many).invoices.length, backup.MAX_HISTORY);
  assert.ok(backup.MAX_HISTORY > 50);
});
const fileFrom = (data) => backup.parseBackup(JSON.stringify({ format: "facturepro-backup", version: 1, exportedAt: oct.toISOString(), data })).backup;
await test("import merge: keeps filled company fields + explicit lang + stored currency", () => {
  const cur = store({ fp_invoices: JSON.stringify([inv("1", "FAC-1")]), fp_company: JSON.stringify({ name: "Ici", gst: "" }), fp_lang: "fr", fp_lang_choice: "1", fp_currency: "CAD" });
  const p = backup.planImport(cur, fileFrom({ invoices: [inv("2", "FAC-2", "2026-10-02")], company: { name: "Fichier", gst: "999" }, lang: "en", langChoice: true, currency: "EUR" }), "merge", oct);
  assert.deepEqual(p.invoices.map((d) => d.id), ["2", "1"]);
  assert.equal(p.company.name, "Ici");
  assert.equal(p.company.gst, "999");
  assert.equal(p.lang, null);
  assert.equal(p.currency, null);
  assert.equal(p.set.fp_currency, undefined);
  // browser with no invoices yet (app already stored default CAD): file currency applies
  assert.equal(backup.planImport(store({ fp_currency: "CAD" }), fileFrom({ invoices: [], currency: "USD" }), "merge", oct).set.fp_currency, "USD");
  // fresh browser: currency + lang come from the file
  const fresh = backup.planImport(store({}), fileFrom({ invoices: [], lang: "en", currency: "EUR" }), "merge", oct);
  assert.equal(fresh.set.fp_currency, "EUR");
  assert.equal(fresh.set.fp_lang, "en");
});
await test("import replace: file wins for invoices, company, lang, currency", () => {
  const cur = store({ fp_invoices: JSON.stringify([inv("1", "FAC-1")]), fp_company: JSON.stringify({ name: "Ici", phone: "819" }), fp_lang: "fr", fp_lang_choice: "1", fp_currency: "CAD" });
  const p = backup.planImport(cur, fileFrom({ invoices: [inv("2", "FAC-2")], company: { name: "Fichier" }, lang: "es", langChoice: true, currency: "USD" }), "replace", oct);
  assert.deepEqual(p.invoices.map((d) => d.id), ["2"]);
  assert.deepEqual(p.company, { name: "Fichier" });
  assert.equal(p.set.fp_lang, "es");
  assert.equal(p.set.fp_currency, "USD");
});
await test("import never lowers the free monthly counter", () => {
  const f = (usage) => fileFrom({ invoices: [], usage });
  assert.equal(backup.planImport(store({ fp_count: "4", fp_count_month: "2026-10" }), f({ month: "2026-09", count: 1 }), "replace", oct).count, 4);
  assert.equal(backup.planImport(store({ fp_count: "4", fp_count_month: "2026-10" }), f(undefined), "replace", oct).count, 4);
  assert.equal(backup.planImport(store({ fp_count: "4", fp_count_month: "2026-10" }), f({ month: "2026-10", count: 1 }), "merge", oct).count, 4);
  const p = backup.planImport(store({}), f({ month: "2026-10", count: 5 }), "merge", oct);
  assert.equal(p.count, 5);
  assert.equal(p.set.fp_count, "5");
  assert.equal(p.set.fp_count_month, "2026-10");
});
await test("import subscription id: carried over, re-verified; never legacy/confirmed flags", () => {
  const file = fileFrom({ invoices: [], sub: "sub_NEWsubscription1" });
  const p = backup.planImport(store({}), file, "merge", oct);
  assert.equal(p.set.fp_sub, "sub_NEWsubscription1");
  assert.equal(p.subChanged, true);
  assert.deepEqual(p.remove, ["fp_pro_confirmed_at"]);
  for (const k of Object.keys(p.set)) assert.ok(!["fp_pro_confirmed_at", "fp_legacy_pro", "fp_plan", "fp_last_export"].includes(k), k);
  assert.equal(backup.planImport(store({ fp_sub: "sub_OLDsubscription1" }), file, "merge", oct).subChanged, false);
  assert.equal(backup.planImport(store({ fp_sub: "sub_OLDsubscription1" }), file, "replace", oct).set.fp_sub, "sub_NEWsubscription1");
});
await test("export reminder after 30 days only", () => {
  const now = Date.UTC(2026, 9, 2), day = 86400000;
  const old = [inv(String(now - 40 * day), "FAC-1")];
  assert.equal(backup.exportReminderDue({ lastExport: null, snoozedAt: null, invoices: [], now }), false);
  assert.equal(backup.exportReminderDue({ lastExport: null, snoozedAt: null, invoices: [inv(String(now - 5 * day), "FAC-1")], now }), false);
  assert.equal(backup.exportReminderDue({ lastExport: null, snoozedAt: null, invoices: old, now }), true);
  assert.equal(backup.exportReminderDue({ lastExport: String(now - 10 * day), snoozedAt: null, invoices: old, now }), false);
  assert.equal(backup.exportReminderDue({ lastExport: String(now - 31 * day), snoozedAt: String(now - day), invoices: old, now }), false);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(process.exitCode ? "FAILED" : `\n${passed} tests passed`);
