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
  }).outputText;
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


fs.rmSync(tmp, { recursive: true, force: true });
console.log(process.exitCode ? "FAILED" : `\n${passed} tests passed`);
