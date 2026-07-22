// GRAND LINE ARENA — la prime (bounty) du classement. §8 point 7.
//
// Remplace le tri par Berrys, qui classait en réalité les joueurs par leur RÉSERVE : un joueur
// qui dépensait tout en tirages dégringolait, et thésauriser était la meilleure façon de
// monter. On classait la richesse, pas les exploits.
//
// Trois règles, décidées le 22/07/2026 :
//   1. La prime ne fait que MONTER. Jamais de perte — c'est ainsi dans One Piece, et voir son
//      chiffre baisser en direct est décourageant.
//   2. Elle est pondérée par la FORCE de l'adversaire battu : battre un Épique niveau 3 ne
//      vaut pas battre un Commun niveau 1.
//   3. Les victoires contre un BOT ne rapportent rien. Sinon l'anti-frustration (§4bis, bot
//      faible garanti après N défaites) deviendrait une machine à prime : enchaîner les
//      défaites serait le moyen le plus rentable de monter au classement.
//
// Logique pure, comme combat.ts et gacha.ts : aucune base, aucune horloge. Tout ce qui chiffre
// vient de `config`.

import type { Config, Rarete } from './types.ts';

/**
 * Ce que rapporte une victoire, avant la règle « bot = 0 ».
 *
 * La pondération par niveau réutilise le chiffre d'équilibrage déjà établi ailleurs dans le
 * projet — un niveau vaut environ +40 % de puissance — plutôt que d'inventer une échelle de
 * plus. Battre un adversaire niveau 3 vaut donc 1,8× ce que vaut le même adversaire niveau 1.
 */
export function gainPrime(rareteAdversaire: Rarete, niveauAdversaire: number, config: Config): number {
  const base = config.prime_par_rarete[rareteAdversaire];
  if (base === undefined) {
    throw new Error(
      `prime : aucune valeur de prime pour la rareté "${rareteAdversaire}" en config `
      + '(clé prime_par_rarete_*). Ajoute-la plutôt que de laisser un adversaire ne rien rapporter.',
    );
  }
  const multiplicateurNiveau = 1 + config.prime_bonus_niveau * (niveauAdversaire - 1);
  return Math.round(base * multiplicateurNiveau);
}

/**
 * La prime après un combat.
 *
 * @param contreVraiJoueur  false pour un bot : la prime ne bouge pas d'un point.
 */
export function primeApresCombat(params: {
  primeAvant: number;
  gagne: boolean;
  contreVraiJoueur: boolean;
  rareteAdversaire: Rarete;
  niveauAdversaire: number;
  config: Config;
}): { prime: number; gain: number } {
  const { primeAvant, gagne, contreVraiJoueur, rareteAdversaire, niveauAdversaire, config } = params;

  if (!gagne || !contreVraiJoueur) return { prime: primeAvant, gain: 0 };

  const gain = gainPrime(rareteAdversaire, niveauAdversaire, config);
  return { prime: primeAvant + gain, gain };
}
