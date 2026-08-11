const TEMPLATES = [
  {
    id: "general",
    label: { en: "General", fr: "Général", es: "General" },
    desc: { en: "Any business", fr: "Toute entreprise", es: "Cualquier negocio" },
    items: [{ description: "Professional services", quantity: 1, unitPrice: 0 }],
  },
  {
    id: "consultant",
    label: { en: "Consultant", fr: "Consultant", es: "Consultor" },
    desc: { en: "Hourly / retainer", fr: "Horaire / forfait", es: "Por hora / retainer" },
    items: [{ description: "Consulting services – 10 hours @ $95/hr", quantity: 10, unitPrice: 95 }],
  },
  {
    id: "trades",
    label: { en: "Trades", fr: "Métiers", es: "Oficios" },
    desc: { en: "Labour + materials", fr: "Main-d'œuvre + matériaux", es: "Mano de obra + materiales" },
    items: [
      { description: "Labour", quantity: 1, unitPrice: 0 },
      { description: "Materials", quantity: 1, unitPrice: 0 },
    ],
  },
  {
    id: "creative",
    label: { en: "Creative", fr: "Créatif", es: "Creativo" },
    desc: { en: "Deposit / milestone", fr: "Acompte / jalon", es: "Depósito / hito" },
    items: [{ description: "Project deposit (50%)", quantity: 1, unitPrice: 0 }],
  },
];

export { TEMPLATES };
