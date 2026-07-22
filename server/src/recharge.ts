// ONE PIECE ARENA — recharge de l'énergie (quotidienne) et des changements de perso
// (hebdomadaire). §3 / §4 GAME_DESIGN.md.
//
// ⚠️ Ce fichier comble un TROU RÉEL, pas une amélioration : la colonne `derniere_recharge`
// existait depuis le schéma initial, mais aucun code ne la lisait ni ne l'écrivait. Le message
// d'erreur du combat promettait « reviens après la recharge quotidienne » alors qu'aucune
// recharge n'existait — chaque joueur avait donc 10 combats À VIE. Idem pour les 3 changements
// de perso "par semaine", qui n'étaient jamais rendus.
//
// La partie calcul est pure (aucun accès base), comme gacha.ts et progression.ts.

import type { Config } from './types.ts';

/** Les composantes année/mois/jour d'un instant, LUES DANS LE FUSEAU DU JEU. */
function partiesLocales(instant: Date, fuseau: string): { annee: number; mois: number; jour: number } {
  // en-CA formate en YYYY-MM-DD, ce qui évite d'avoir à deviner l'ordre des composantes.
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant).split('-').map(Number);
  return { annee: parties[0], mois: parties[1], jour: parties[2] };
}

/**
 * La "journée de jeu" à laquelle appartient un instant, sous forme de clé comparable.
 *
 * Le décalage par `heure_reset` est l'astuce qui permet une remise à zéro ailleurs qu'à minuit
 * sans calcul d'horaire compliqué : si la recharge est à 4 h, on retire 4 h avant de lire la
 * date, donc 3 h du matin retombe sur la veille — exactement le comportement voulu.
 */
export function cleJour(instant: Date, config: Config): string {
  const decale = new Date(instant.getTime() - config.heure_reset * 3_600_000);
  const { annee, mois, jour } = partiesLocales(decale, config.fuseau_horaire);
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** La "semaine de jeu", identifiée par la date de sa dernière remise à zéro hebdomadaire. */
export function cleSemaine(instant: Date, config: Config): string {
  const decale = new Date(instant.getTime() - config.heure_reset * 3_600_000);
  const { annee, mois, jour } = partiesLocales(decale, config.fuseau_horaire);
  // Arithmétique en UTC sur une date déjà "locale" : on ne manipule plus que des jours
  // calendaires, donc aucun risque de décalage horaire ou d'heure d'été ici.
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  const recul = (d.getUTCDay() - config.jour_reset_hebdo + 7) % 7;
  d.setUTCDate(d.getUTCDate() - recul);
  return d.toISOString().slice(0, 10);
}

/**
 * Le prix du PROCHAIN changement de perso actif (§3).
 *
 * `changements_restants` descend sous zéro une fois le quota gratuit épuisé : c'est ce compteur
 * négatif qui mémorise combien de changements payants ont déjà eu lieu cette semaine, sans
 * nécessiter de colonne supplémentaire. La remise à zéro hebdomadaire le repasse au quota et
 * efface donc l'escalade, comme voulu.
 *
 *   restants  3, 2, 1 → gratuit
 *   restants  0        → 1er payant  → paliers[0]
 *   restants -1        → 2e payant   → paliers[1]
 *   restants -2        → 3e payant   → paliers[2]
 *   restants -3 et au-delà           → dernier palier (plafond)
 *
 * @returns 0 si le changement est encore gratuit.
 */
export function prixProchainChangement(changementsRestants: number, config: Config): number {
  if (changementsRestants > 0) return 0;
  const paliers = config.changement_prix_paliers;
  const indice = Math.min(-changementsRestants, paliers.length - 1);
  return paliers[indice];
}

export interface ResultatRecharge {
  energie: number;
  changements_restants: number;
  /** true si une des deux valeurs a changé — l'appelant n'écrit en base que dans ce cas. */
  doitEcrire: boolean;
}

/**
 * Calcule l'état après recharge. Pur : ne touche ni la base, ni l'horloge (l'instant est passé
 * en paramètre), donc entièrement testable.
 *
 * La recharge REMET À la valeur maximale, elle n'ajoute pas : §4 dit "10 combats par jour",
 * pas "+10 par jour". Un joueur qui n'a rien consommé ne cumule donc pas de réserve.
 */
export function calculerRecharges(params: {
  maintenant: Date;
  derniereRechargeEnergie: Date;
  derniereRechargeChangements: Date;
  energieActuelle: number;
  changementsActuels: number;
  config: Config;
}): ResultatRecharge {
  const {
    maintenant, derniereRechargeEnergie, derniereRechargeChangements,
    energieActuelle, changementsActuels, config,
  } = params;

  const jourEcoule = cleJour(maintenant, config) !== cleJour(derniereRechargeEnergie, config);
  const semaineEcoulee = cleSemaine(maintenant, config) !== cleSemaine(derniereRechargeChangements, config);

  return {
    energie: jourEcoule ? config.energie_max : energieActuelle,
    changements_restants: semaineEcoulee ? config.changements_par_semaine : changementsActuels,
    doitEcrire: jourEcoule || semaineEcoulee,
  };
}
