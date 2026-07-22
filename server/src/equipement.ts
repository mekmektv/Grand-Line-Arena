// ONE PIECE ARENA — l'équipement : coffres, bonus, recyclage, sacrifice. §4ter.
//
// Logique pure, comme combat.ts et gacha.ts : ce fichier ne touche jamais la base. Il reçoit
// l'état du joueur (Berrys, objets possédés) et rend le résultat. C'est `equipement-api.ts`
// qui lit en base, appelle ces fonctions, puis écrit.
//
// Aucun chiffre ici : prix, taux, recyclage, seuils et catalogue viennent tous de `config`.
//
// ---------------------------------------------------------------------------------------
// LE CHIFFRAGE DES OBJETS, pour comprendre ce qu'on manipule (décidé le 21/07/2026)
//
// La formule du §4 d'EQUILIBRAGE_FINAL donne une conversion entre les deux stats :
//
//     1 point de budget = `hp_scale` PV (9 aujourd'hui) = 1 point d'Attack
//
// Ce n'est pas que l'Attack "vaut plus cher" : un point de PV se dépense une fois, un point
// d'Attack resert à chaque tour. Sur un combat de ~8 tours, +1 Attack ≈ +8 dégâts infligés
// ≈ +8 PV encaissés. `hp_scale` est donc à peu près la durée d'un combat.
//
// Chaque objet reçoit un budget selon sa rareté (Gris 2 / Vert 4 / Bleu 6) qu'il répartit
// entre PV et Attack. `budgetObjet()` refait le calcul à l'envers et sert de test.
// Un set Bleu complet = 12 points, soit ~60 % d'un niveau de perso (+20) : monter son perso
// doit rester plus rentable que farmer des coffres.
// ---------------------------------------------------------------------------------------

import type {
  Config, ObjetEquipement, RareteEquipement, TypeEquipement,
} from './types.ts';
import { creerRng, seedAleatoire } from './rng.ts';

/** Du pire au meilleur. L'ordre définit "la rareté au-dessus" pour le sacrifice. */
export const RARETES_EQUIPEMENT: RareteEquipement[] = ['Gris', 'Vert', 'Bleu'];
export const TYPES_EQUIPEMENT: TypeEquipement[] = ['Chapeau', 'Tenue'];

/** La rareté juste au-dessus, ou null si c'est déjà la meilleure. */
export function rareteAuDessus(rarete: RareteEquipement): RareteEquipement | null {
  const i = RARETES_EQUIPEMENT.indexOf(rarete);
  return i >= 0 && i + 1 < RARETES_EQUIPEMENT.length ? RARETES_EQUIPEMENT[i + 1] : null;
}

// ---------------------------------------------------------------------------
// Le bonus apporté par les objets équipés
// ---------------------------------------------------------------------------

export interface BonusEquipement {
  hp: number;
  attack: number;
}

/**
 * Le total des objets équipés sur un perso. C'est ce qui s'ajoute à ses stats.
 * Sans équipement (ou pour un bot), rend 0/0 — donc rien ne change.
 */
export function bonusEquipement(objets: readonly ObjetEquipement[] | undefined): BonusEquipement {
  let hp = 0, attack = 0;
  for (const o of objets ?? []) { hp += o.hp; attack += o.attack; }
  return { hp, attack };
}

/**
 * Le coût d'un objet en points de budget, recalculé depuis ses stats.
 * Sert de vérification : il doit retomber EXACTEMENT sur le budget de sa rareté
 * (2 / 4 / 6). Un écart = une faute de frappe dans le catalogue en base.
 */
export function budgetObjet(objet: ObjetEquipement, config: Config): number {
  return objet.hp / config.hp_scale + objet.attack;
}

// ---------------------------------------------------------------------------
// Le sacrifice : N objets d'une rareté → 1 coffre garanti au-dessus
// ---------------------------------------------------------------------------

/**
 * Ce que l'écran d'inventaire propose, rareté par rareté.
 *
 * Le joueur SÉLECTIONNE lui-même les objets à détruire (décidé le 21/07/2026) : il n'y a
 * aucun compteur qui se remplit dans son dos. Les objets en trop SONT la monnaie, ce qui
 * évite d'inventer une seconde ressource et garde la décision entre ses mains — il voit
 * exactement ce qu'il détruit.
 */
export interface SacrificePossible {
  rarete: RareteEquipement;
  rarete_obtenue: RareteEquipement;
  /** Combien d'objets de cette rareté il faut sacrifier (config). */
  requis: number;
  /** Combien il en a de disponibles dans son inventaire. */
  disponibles: number;
  possible: boolean;
}

/**
 * Les sacrifices ouverts au joueur, d'après son seul INVENTAIRE : un objet porté par un perso
 * n'est jamais sacrifiable directement (§4ter — il faut le recycler d'abord, donc le voir
 * disparaître de son perso). Une rareté au seuil 0 en config est simplement absente, ce qui
 * permet d'éteindre la mécanique sans toucher au front.
 */
export function sacrificesPossibles(
  inventaire: readonly ObjetEquipement[], config: Config,
): SacrificePossible[] {
  const sortie: SacrificePossible[] = [];
  for (const rarete of RARETES_EQUIPEMENT) {
    const requis = config.compteur_equipement[rarete] ?? 0;
    const cible = rareteAuDessus(rarete);
    if (requis <= 0 || cible === null) continue;
    const disponibles = inventaire.filter((o) => o.rarete === rarete).length;
    sortie.push({ rarete, rarete_obtenue: cible, requis, disponibles, possible: disponibles >= requis });
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Ouvrir un coffre
// ---------------------------------------------------------------------------

/**
 * Comment le coffre est payé.
 *  - 'berrys'    : le coffre normal à `cout_coffre_equipement`, taux habituels.
 *  - 'sacrifice' : le joueur détruit N objets d'une même rareté (N = config) et obtient un
 *    coffre GARANTI dans la rareté au-dessus.
 */
export type PaiementCoffre =
  | { mode: 'berrys' }
  | { mode: 'sacrifice'; objets: readonly ObjetEquipement[] };

export interface ResultatCoffre {
  objet: ObjetEquipement;
  seed: number;                 // rejouer avec ce seed redonne exactement le même objet
  paiement: PaiementCoffre;
  berrys_avant: number;
  berrys_apres: number;
  /** La rareté plancher garantie par le paiement. Sert à l'affichage ("coffre Vert garanti"). */
  rarete_garantie: RareteEquipement;
}

/** Les objets du catalogue qui correspondent à un type et une rareté (3 profils). */
function objetsPossibles(
  catalogue: readonly ObjetEquipement[], type: TypeEquipement, rarete: RareteEquipement,
): ObjetEquipement[] {
  return catalogue.filter((o) => o.type === type && o.rarete === rarete);
}

/**
 * Vérifie qu'un lot d'objets forme un sacrifice valide et rend la rareté garantie en retour.
 * Exporté à part pour que l'API puisse contrôler AVANT de détruire quoi que ce soit.
 */
export function validerSacrifice(
  objets: readonly ObjetEquipement[], config: Config,
): RareteEquipement {
  if (objets.length === 0) throw new Error('Sacrifice vide : sélectionne des objets à détruire.');

  const rarete = objets[0].rarete;
  if (objets.some((o) => o.rarete !== rarete)) {
    throw new Error('Tous les objets sacrifiés doivent être de la MÊME rareté.');
  }
  const cible = rareteAuDessus(rarete);
  if (cible === null) {
    throw new Error(`Les objets ${rarete} ne sont pas sacrifiables : il n'existe rien au-dessus.`);
  }
  const requis = config.compteur_equipement[rarete] ?? 0;
  if (requis <= 0) {
    throw new Error(
      `Le sacrifice d'objets ${rarete} est désactivé. ` +
      `Vérifie "equipement_compteur_${rarete.toLowerCase()}" en config (0 = désactivé).`,
    );
  }
  if (objets.length !== requis) {
    throw new Error(`Il faut exactement ${requis} objets ${rarete} — ${objets.length} sélectionné(s).`);
  }
  return cible;
}

/**
 * Ouvre un coffre d'équipement.
 *
 * Deux tirages indépendants (§4ter) : le TYPE à 50/50 (Chapeau ou Tenue), puis la RARETÉ
 * selon `drop_rates_equipement` — Chapeau et Tenue partagent le même pool de raretés.
 * Le profil (équilibré / PV / Attack) est ensuite pris au hasard, à parts égales, parmi les
 * objets restants : les trois valent le même budget, ce tirage ne peut donc pas changer la
 * puissance obtenue (même nuance que POIDS_DEFILE côté roulette).
 */
export function ouvrirCoffre(params: {
  berrysDisponibles: number;
  paiement: PaiementCoffre;
  config: Config;
  seed?: number;
}): ResultatCoffre {
  const { berrysDisponibles, paiement, config } = params;
  const catalogue = config.equipement_catalogue;

  let cout = 0;
  let rareteMin: RareteEquipement = RARETES_EQUIPEMENT[0];

  if (paiement.mode === 'berrys') {
    cout = config.cout_coffre_equipement;
    if (berrysDisponibles < cout) {
      throw new Error(`Coffre impossible : ${cout} Berrys nécessaires, ${berrysDisponibles} disponibles.`);
    }
  } else {
    rareteMin = validerSacrifice(paiement.objets, config);
  }

  const seed = params.seed ?? seedAleatoire();
  const rng = creerRng(seed);

  const type = rng() < 0.5 ? TYPES_EQUIPEMENT[0] : TYPES_EQUIPEMENT[1];

  // Raretés possibles : toutes celles à partir du plancher garanti, taux renormalisés.
  const candidates = RARETES_EQUIPEMENT.slice(RARETES_EQUIPEMENT.indexOf(rareteMin));
  const somme = candidates.reduce((s, r) => s + config.drop_rates_equipement[r], 0);
  if (somme <= 0) {
    throw new Error(`config : aucun taux de drop utilisable à partir de la rareté "${rareteMin}".`);
  }
  const de = rng() * somme;
  let cumul = 0;
  let rarete = candidates[candidates.length - 1]; // filet : erreurs d'arrondi sur la dernière tranche
  for (const r of candidates) {
    cumul += config.drop_rates_equipement[r];
    if (de < cumul) { rarete = r; break; }
  }

  const possibles = objetsPossibles(catalogue, type, rarete);
  if (possibles.length === 0) {
    throw new Error(
      `config : aucun objet "${type}" de rareté "${rarete}" dans equipement_catalogue. ` +
      `Le catalogue doit couvrir chaque combinaison type × rareté.`,
    );
  }
  const objet = possibles[Math.min(possibles.length - 1, Math.floor(rng() * possibles.length))];

  return {
    objet,
    seed,
    paiement,
    berrys_avant: berrysDisponibles,
    berrys_apres: berrysDisponibles - cout,
    rarete_garantie: rareteMin,
  };
}

// ---------------------------------------------------------------------------
// Recycler
// ---------------------------------------------------------------------------

export interface ResultatRecyclage {
  berrys_gagnes: number;
  berrys_apres: number;
}

/**
 * Détruit un objet contre des Berrys. §4ter : c'est la SEULE façon de retirer un objet d'un
 * perso — un objet équipé ne peut jamais retourner à l'inventaire.
 *
 * À ne pas confondre avec le SACRIFICE (`validerSacrifice`), qui détruit plusieurs objets de
 * l'inventaire pour obtenir un coffre garanti. Recycler = des Berrys, sacrifier = un coffre.
 */
export function recyclerObjet(
  berrysDisponibles: number, objet: ObjetEquipement, config: Config,
): ResultatRecyclage {
  const gain = config.recyclage_equipement[objet.rarete];
  if (gain === undefined) {
    throw new Error(`config : pas de valeur de recyclage pour la rareté d'équipement "${objet.rarete}".`);
  }
  return { berrys_gagnes: gain, berrys_apres: berrysDisponibles + gain };
}

// ---------------------------------------------------------------------------
// Équiper
// ---------------------------------------------------------------------------

/**
 * Vérifie qu'on peut poser `objet` sur un perso dont le slot correspondant contient déjà
 * `actuel` (ou null s'il est vide).
 *
 * §4ter + décision du 21/07/2026 : un slot occupé doit d'abord être libéré, et la seule
 * façon de le libérer est de RECYCLER ce qu'il contient. L'appelant doit donc enchaîner
 * `recyclerObjet()` puis l'équipement.
 */
export function peutEquiper(
  objet: ObjetEquipement, actuel: ObjetEquipement | null,
): { ok: true } | { ok: false; doit_recycler: ObjetEquipement } {
  if (actuel === null) return { ok: true };
  return { ok: false, doit_recycler: actuel };
}
