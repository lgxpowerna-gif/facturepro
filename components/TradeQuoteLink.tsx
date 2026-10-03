const TRADEQUOTE_URL = "https://tradequote.faitle.net";

export const TRADEQUOTE_TEXT =
  "Entrepreneur en construction? Essayez TradeQuote : soumissions et factures avec votre licence RBQ.";

export function TradeQuoteLink({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-500 ${className}`}>
      <a
        href={TRADEQUOTE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {TRADEQUOTE_TEXT}
      </a>
    </p>
  );
}
