"use client";

export function ConnectionStatus({
  online,
  pending,
  note,
  labelOnline,
  labelOffline,
  banner,
  pendingText,
  syncedText,
  conflictText,
}: {
  online: boolean;
  pending: number;
  note: "synced" | "conflict" | null;
  labelOnline: string;
  labelOffline: string;
  banner: string;
  pendingText: string;
  syncedText: string;
  conflictText: string;
}) {
  const quiet = online && pending === 0 && !note;
  return (
    <div
      data-testid="offline-status"
      role="status"
      aria-live="polite"
      className={
        quiet
          ? "bg-white border-b border-slate-200 text-slate-600 text-sm px-4 py-1.5"
          : online
            ? "bg-emerald-50 border-b border-emerald-200 text-emerald-950 text-sm px-4 py-2"
            : "bg-amber-50 border-b border-amber-200 text-amber-950 text-sm px-4 py-2"
      }
    >
      <p className="max-w-7xl mx-auto">
        <span className={online ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>
          {online ? labelOnline : labelOffline}
        </span>
        {!online && <span>{" — "}{banner}</span>}
        {pending > 0 && (
          <span data-testid="offline-pending">
            {" "}
            {pendingText}
          </span>
        )}
        {note === "synced" && <span data-testid="offline-synced">{" "}{syncedText}</span>}
        {note === "conflict" && <span data-testid="offline-conflict">{" "}{conflictText}</span>}
      </p>
    </div>
  );
}

export function OfflineLock({ title, body, hint }: { title: string; body: string; hint: string }) {
  return (
    <div
      data-testid="offline-lock"
      role="alert"
      className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center mt-6"
    >
      <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
      <p className="text-slate-700 mb-3">{body}</p>
      <p className="text-sm text-slate-500">{hint}</p>
    </div>
  );
}
