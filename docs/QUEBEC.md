# Branche feat/quebec-fr-tps-tvq — résumé

- Français par défaut : une préférence enregistrée reste prioritaire. `<html lang="fr-CA">`, métadonnées en français, montants en format fr-CA (1 234,56 $).
- Taxes : `lib/tax.ts`. Préréglage par défaut **Québec : TPS 5 % + TVQ 9,975 %**. Chaque taxe est calculée séparément sur le montant avant taxes (pas de taxe sur la taxe) et arrondie au cent. Les taxes apparaissent sur des lignes séparées dans l'aperçu et dans le PDF. Champs N° TPS/TVH et **N° TVQ** imprimés sur le PDF.
- Tarifs : vraies pages `/tarifs` (FR) et `/pricing` (EN), avec FAQ et un lien vers `/?view=pricing` pour le paiement. Liens dans le pied de page. Prix affichés à 9 $/mois et 79 $/an : ils doivent correspondre aux prix Stripe.
- Pro : vérifié côté serveur via `/api/subscription-status` (Stripe). `fp_plan` dans localStorage est ignoré. Le compteur gratuit se remet à zéro chaque mois. Voir `money-plan/08-plan-pro-serveur.md` pour la phase 2.
- **Build : l'étape `prebuild` et les morceaux `scripts/page.gz.b64.*` ont été retirés.** `app/page.tsx` est maintenant le vrai code source, versionné normalement.
- Tests : `npm test` (`scripts/test.mjs`, sans dépendance ajoutée).

## Ajouts (publication)
- Pages légales FR/EN : `/confidentialite` `/privacy` (Loi 25 ; responsable : le responsable de la protection des renseignements personnels ; lgxpowerna@gmail.com), `/conditions` `/terms`, `/contact` `/contact-us`. Liens dans le pied de page et sous chaque bouton de paiement Pro.
- `POST /api/portal` : ouvre le portail client Stripe (gérer / annuler) pour l'abonnement mémorisé dans le navigateur. Le portail doit être activé une fois dans Stripe (Paramètres → Facturation → Portail client) ; sinon, l'interface affiche l'annulation par courriel.
- Compatibilité : les anciens utilisateurs Pro (ancienne clé `*_plan` = "pro") gardent le Pro jusqu'au 31 déc. 2026, avec un bandeau. Lien de restauration : `/?restore=sub_…` (id de l'abonnement dans Stripe). La langue enregistrée par l'ancienne version (toujours "en") n'est plus imposée ; seul un choix explicite est respecté.
