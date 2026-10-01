# Branche feat/quebec-fr-tps-tvq — résumé

- Français par défaut : une préférence enregistrée reste prioritaire. `<html lang="fr-CA">`, métadonnées en français, montants en format fr-CA (1 234,56 $).
- Taxes : `lib/tax.ts`. Préréglage par défaut **Québec : TPS 5 % + TVQ 9,975 %**. Chaque taxe est calculée séparément sur le montant avant taxes (pas de taxe sur la taxe) et arrondie au cent. Les taxes apparaissent sur des lignes séparées dans l'aperçu et dans le PDF. Champs N° TPS/TVH et **N° TVQ** imprimés sur le PDF.
- Tarifs : vraies pages `/tarifs` (FR) et `/pricing` (EN), avec FAQ et un lien vers `/?view=pricing` pour le paiement. Liens dans le pied de page. Prix affichés à 9 $/mois et 79 $/an : ils doivent correspondre aux prix Stripe.
- Pro : vérifié côté serveur via `/api/subscription-status` (Stripe). `fp_plan` dans localStorage est ignoré. Le compteur gratuit se remet à zéro chaque mois. Voir `money-plan/08-plan-pro-serveur.md` pour la phase 2.
- **Build : l'étape `prebuild` et les morceaux `scripts/page.gz.b64.*` ont été retirés.** `app/page.tsx` est maintenant le vrai code source, versionné normalement.
- Tests : `npm test` (`scripts/test.mjs`, sans dépendance ajoutée).
