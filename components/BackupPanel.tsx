"use client";
import { useRef, useState } from "react";
import { translations, type Lang } from "@/lib/i18n";
import {
  LAST_EXPORT_KEY, MAX_BACKUP_BYTES, backupFileName, buildBackup, parseBackup, planImport,
  type Backup, type BackupError, type ImportMode, type ImportPlan,
} from "@/lib/backup";

type T = (typeof translations)[Lang];

/** Builds the backup from localStorage and downloads it as a JSON file (100 % local, no network). Returns the export time. */
export function downloadBackup(lang: Lang): number {
  const backup = buildBackup((k) => localStorage.getItem(k));
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(lang);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const now = Date.now();
  try { localStorage.setItem(LAST_EXPORT_KEY, String(now)); } catch { /* ignore */ }
  return now;
}

const ERR: Record<BackupError, keyof T> = {
  tooLarge: "errTooLarge", empty: "errEmpty", notJson: "errNotJson", wrongApp: "errWrongApp", tradeQuoteFile: "errTradeQuote", newerVersion: "errNewerVersion", badShape: "errBadShape",
};

export function BackupPanel({ lang, t, lastExport, onExport, onImported }: {
  lang: Lang;
  t: T;
  lastExport: number | null;
  onExport: () => void;
  onImported: (plan: ImportPlan, summary: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: Backup; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const one = (n: number) => (lang === "fr" ? n <= 1 : n === 1);
  const docs = (n: number) => `${n} ${one(n) ? t.importDoc : t.importDocs}`;
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(lang === "fr" ? "fr-CA" : lang === "es" ? "es" : "en-CA", { year: "numeric", month: "long", day: "numeric" });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    setError(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setError(t.errTooLarge); return; }
    let text: string;
    try { text = await file.text(); } catch { setError(t.errRead); return; }
    const r = parseBackup(text, file.size);
    if (!r.ok) { setError(t[ERR[r.error]] as string); return; }
    setPending({ backup: r.backup, skipped: r.skipped });
  };

  const apply = (mode: ImportMode) => {
    if (!pending) return;
    try {
      const plan = planImport((k) => localStorage.getItem(k), pending.backup, mode);
      plan.remove.forEach((k) => localStorage.removeItem(k));
      Object.entries(plan.set).forEach(([k, v]) => localStorage.setItem(k, v));
      const parts = [`${docs(plan.added)} ${one(plan.added) ? t.importAddedOne : t.importAdded}`];
      if (plan.duplicates) parts.push(`${plan.duplicates} ${t.importDup}`);
      if (pending.skipped) parts.push(`${pending.skipped} ${t.importSkipped}`);
      onImported(plan, `${t.importDone} (${parts.join(", ")})`);
      setPending(null);
    } catch {
      setError(t.errBadShape);
      setPending(null);
    }
  };

  const d = pending?.backup.data;
  return (
    <section id="sauvegarde" className="bg-white border rounded-2xl p-5 mb-6" aria-labelledby="backup-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="backup-title" className="font-semibold">💾 {t.backupTitle}</h3>
          <p className="text-sm text-slate-600 mt-1">{t.backupNote}</p>
          <p className="text-xs text-slate-400 mt-1">{t.backupLast} : {lastExport ? fmtDate(lastExport) : t.backupNever}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExport} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">{t.backupExport}</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="border border-slate-300 hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-lg">{t.backupImport}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} data-testid="backup-file" aria-label={t.backupImport} />
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">{t.backupDetail}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {pending && d && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 id="import-title" className="text-lg font-bold mb-3">{t.importTitle}</h3>
            <ul className="text-sm text-slate-700 space-y-1 mb-4">
              {pending.backup.exportedAt && <li>{t.importFileInfo} {fmtDate(Date.parse(pending.backup.exportedAt))}</li>}
              <li><strong>{d.invoices.length}</strong> {one(d.invoices.length) ? t.importDoc : t.importDocs}</li>
              {d.company.name && <li>{t.importCompany} : <strong>{d.company.name}</strong></li>}
              {d.sub && <li className="text-slate-500 text-xs">{t.importHasSub}</li>}
            </ul>
            <button type="button" onClick={() => apply("merge")} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold">{t.importMerge}</button>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">{t.importMergeHint}</p>
            <button type="button" onClick={() => apply("replace")} className="w-full border border-amber-400 text-amber-800 hover:bg-amber-50 py-2.5 rounded-xl font-semibold">{t.importReplace}</button>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">{t.importReplaceHint}</p>
            <button type="button" onClick={() => setPending(null)} className="w-full text-slate-500 text-sm py-2">{t.importCancel}</button>
          </div>
        </div>
      )}
    </section>
  );
}
