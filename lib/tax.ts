/**
 * Canadian sales-tax presets.
 *
 * Each preset is made of one or more components (e.g. Québec = TPS 5 % + TVQ 9,975 %).
 * Since 2013 the QST/TVQ is computed on the selling price excluding GST/TPS (no tax on tax),
 * and each tax is rounded to the cent separately, which is how it must appear on an invoice.
 */
export type TaxLang = "en" | "fr" | "es";
type L10n = Record<TaxLang, string>;

export interface TaxComponent {
  code: string;
  label: L10n;
  rate: number; // percent
}

export interface TaxPreset {
  id: string;
  label: L10n;
  components: TaxComponent[];
}

const GST: TaxComponent = { code: "gst", label: { en: "GST", fr: "TPS", es: "GST" }, rate: 5 };
const HST = (rate: number): TaxComponent => ({
  code: "hst",
  label: { en: "HST", fr: "TVH", es: "HST" },
  rate,
});

export const TAX_PRESETS: TaxPreset[] = [
  {
    id: "gst-qst-qc",
    label: {
      en: "Québec — GST 5% + QST 9.975%",
      fr: "Québec — TPS 5 % + TVQ 9,975 %",
      es: "Quebec — GST 5% + QST 9,975%",
    },
    components: [GST, { code: "qst", label: { en: "QST", fr: "TVQ", es: "QST" }, rate: 9.975 }],
  },
  {
    id: "gst",
    label: { en: "GST 5% only (AB, territories)", fr: "TPS 5 % seulement (AB, territoires)", es: "Solo GST 5%" },
    components: [GST],
  },
  {
    id: "hst-on",
    label: { en: "Ontario — HST 13%", fr: "Ontario — TVH 13 %", es: "Ontario — HST 13%" },
    components: [HST(13)],
  },
  {
    id: "hst-nb",
    label: {
      en: "HST 15% (NB/NL/NS/PE)",
      fr: "TVH 15 % (N.-B./T.-N.-L./N.-É./Î.-P.-É.)",
      es: "HST 15% (NB/NL/NS/PE)",
    },
    components: [HST(15)],
  },
  {
    id: "gst-pst-bc",
    label: { en: "BC — GST 5% + PST 7%", fr: "C.-B. — TPS 5 % + TVP 7 %", es: "BC — GST 5% + PST 7%" },
    components: [GST, { code: "pst", label: { en: "PST", fr: "TVP", es: "PST" }, rate: 7 }],
  },
  {
    id: "gst-pst-sk",
    label: { en: "SK — GST 5% + PST 6%", fr: "Sask. — TPS 5 % + TVP 6 %", es: "SK — GST 5% + PST 6%" },
    components: [GST, { code: "pst", label: { en: "PST", fr: "TVP", es: "PST" }, rate: 6 }],
  },
  {
    id: "gst-rst-mb",
    label: { en: "MB — GST 5% + RST 7%", fr: "Man. — TPS 5 % + TVD 7 %", es: "MB — GST 5% + RST 7%" },
    components: [GST, { code: "rst", label: { en: "RST", fr: "TVD", es: "RST" }, rate: 7 }],
  },
  { id: "none", label: { en: "No tax", fr: "Aucune taxe", es: "Sin impuesto" }, components: [] },
  { id: "custom", label: { en: "Custom rate", fr: "Taux personnalisé", es: "Tasa personalizada" }, components: [] },
];

/** Default for the Québec market. */
export const DEFAULT_TAX_PRESET = "gst-qst-qc";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface TaxLine {
  code: string;
  label: string;
  rate: number;
  amount: number;
}

export interface TaxResult {
  lines: TaxLine[];
  totalTax: number;
  total: number;
}

/** Compute each tax separately on the taxable amount (rounded to the cent). */
export function computeTaxes(
  taxable: number,
  presetId: string,
  lang: TaxLang = "fr",
  customRate = 0
): TaxResult {
  const base = round2(Math.max(0, Number(taxable) || 0));
  let components: TaxComponent[];
  if (presetId === "custom") {
    components = customRate > 0
      ? [{ code: "custom", label: { en: "Tax", fr: "Taxe", es: "Impuesto" }, rate: customRate }]
      : [];
  } else {
    const preset = TAX_PRESETS.find((p) => p.id === presetId);
    components = preset ? preset.components : [];
  }
  const lines = components.map((c) => ({
    code: c.code,
    label: c.label[lang] ?? c.label.en,
    rate: c.rate,
    amount: round2((base * c.rate) / 100),
  }));
  const totalTax = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, totalTax, total: round2(base + totalTax) };
}

/** "9.975" -> "9,975" in French. */
export function formatRate(rate: number, lang: TaxLang = "fr"): string {
  const s = String(rate);
  return lang === "en" ? `${s}%` : `${s.replace(".", ",")} %`;
}
