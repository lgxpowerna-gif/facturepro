const TEMPLATES = [
  {
    id: "general",
    label: { en: "General", fr: "Général", es: "General" },
    desc: { en: "Any business", fr: "Toute entreprise", es: "Cualquier negocio" },
    items: [{ description: { en: "Professional services", fr: "Services professionnels", es: "Servicios profesionales" }, quantity: 1, unitPrice: 0 }],
  },
  {
    id: "consultant",
    label: { en: "Consultant", fr: "Consultant", es: "Consultor" },
    desc: { en: "Hourly / retainer", fr: "Horaire / forfait", es: "Por hora / retainer" },
    items: [{ description: { en: "Consulting services (hourly)", fr: "Services-conseils (taux horaire)", es: "Consultoría (por hora)" }, quantity: 10, unitPrice: 95 }],
  },
  {
    id: "trades",
    label: { en: "Trades", fr: "Métiers", es: "Oficios" },
    desc: { en: "Labour + materials", fr: "Main-d'œuvre + matériaux", es: "Mano de obra + materiales" },
    items: [
      { description: { en: "Labour", fr: "Main-d'œuvre", es: "Mano de obra" }, quantity: 1, unitPrice: 0 },
      { description: { en: "Materials", fr: "Matériaux", es: "Materiales" }, quantity: 1, unitPrice: 0 },
    ],
  },
  {
    id: "creative",
    label: { en: "Creative", fr: "Créatif", es: "Creativo" },
    desc: { en: "Deposit / milestone", fr: "Acompte / jalon", es: "Depósito / hito" },
    items: [{ description: { en: "Project deposit (50%)", fr: "Acompte du projet (50 %)", es: "Depósito del proyecto (50%)" }, quantity: 1, unitPrice: 0 }],
  },
];

export { TEMPLATES };
