// ONE PIECE ARENA — le tirage de perso (gacha). §3bis / §4 GAME_DESIGN.md.
//
// Logique pure, comme combat.ts : ce fichier ne touche jamais la base. Il prend l'état du
// joueur (Berrys, persos déjà possédés) et le catalogue `characters`, et rend le résultat
// d'un tirage. C'est à l'appelant (l'API HTTP, quand elle existera) de lire l'état en base,
// d'appeler `tirer()`, puis d'écrire le résultat (Berrys, collection, perso actif).
//
// Rien n'est en dur ici : les taux, le coût et les récompenses de recyclage viennent tous
// de `config` (chargée par config.ts). Si une clé manque, chargerConfig() plante déjà —
// ce fichier n'a donc jamais à deviner une valeur.

import type { Config, Perso } from './types.ts';
import { creerRng, seedAleatoire } from './rng.ts';

// ---------------------------------------------------------------------------
// Taux par perso
// ---------------------------------------------------------------------------

/**
 * Le taux de tirage de CHAQUE perso, individuellement.
 * §3bis : le taux d'un tier se PARTAGE entre ses persos (7,5 % Rare ÷ 5 persos = 1,5 % chacun).
 * Un perso d'une rareté sans clé de taux en config (Légendaire, aujourd'hui) n'a pas d'entrée
 * ici : il n'est simplement pas tirable.
 */
export function tauxParPerso(persos: Perso[], config: Config): Map<Perso, number> {
  const parRarete = new Map<Perso['rarete'], Perso[]>();
  for (const p of persos) {
    if (config.drop_rates[p.rarete] === undefined) continue; // rareté pas encore tirable
    if (!parRarete.has(p.rarete)) parRarete.set(p.rarete, []);
    parRarete.get(p.rarete)!.push(p);
  }

  const taux = new Map<Perso, number>();
  for (const [rarete, groupe] of parRarete) {
    const tauxGlobal = config.drop_rates[rarete]!;
    const tauxUnitaire = tauxGlobal / groupe.length;
    for (const p of groupe) taux.set(p, tauxUnitaire);
  }
  return taux;
}

/** Tire un perso au hasard selon les taux de `tauxParPerso`. */
function tirerPersoAleatoire(persos: Perso[], config: Config, rng: () => number): Perso {
  const taux = tauxParPerso(persos, config);
  if (taux.size === 0) {
    throw new Error('gacha : aucun perso tirable — vérifie drop_rates en config et le catalogue characters.');
  }

  const tirage = rng();
  let cumul = 0;
  for (const perso of persos) {
    const t = taux.get(perso);
    if (t === undefined) continue;
    cumul += t;
    if (tirage < cumul) return perso;
  }

  // Filet de sécurité : erreurs d'arrondi flottant sur la dernière tranche. Rendre le dernier
  // perso tirable plutôt que de planter un tirage payant pour 1 chance sur des milliards.
  return [...taux.keys()][taux.size - 1];
}

// ---------------------------------------------------------------------------
// Le tirage
// ---------------------------------------------------------------------------

export interface ResultatTirage {
  perso: Perso;
  seed: number;                        // rejouer avec ce seed retire exactement le même perso
  doublon: boolean;
  /** Rempli seulement si `doublon` : le montant à proposer au joueur (§4). */
  recyclage_propose_berrys: number | null;
  /** true seulement pour un nouveau perso : le changement de perso actif est gratuit et ne
   *  consomme PAS le quota des 3 changements/semaine (§3). */
  changement_perso_actif_gratuit: boolean;
  berrys_avant: number;
  berrys_apres: number;
}

/**
 * Effectue un tirage perso.
 *
 * @param berrysDisponibles   solde actuel du joueur
 * @param nomsDejaPossedes    noms des persos déjà dans sa collection (doublon = déjà dedans)
 * @param persos              le catalogue `characters`, chargé via chargerPerso()
 * @param config              la config, chargée via chargerConfig()
 * @param seed                optionnel : impose le tirage (tests, rejouabilité)
 */
export function tirer(params: {
  berrysDisponibles: number;
  nomsDejaPossedes: ReadonlySet<string>;
  persos: Perso[];
  config: Config;
  seed?: number;
}): ResultatTirage {
  const { berrysDisponibles, nomsDejaPossedes, persos, config } = params;
  const cout = config.cout_tirage_perso;

  if (berrysDisponibles < cout) {
    throw new Error(`Tirage impossible : ${cout} Berrys nécessaires, ${berrysDisponibles} disponibles.`);
  }

  const seed = params.seed ?? seedAleatoire();
  const perso = tirerPersoAleatoire(persos, config, creerRng(seed));
  const doublon = nomsDejaPossedes.has(perso.nom);
  const berrysApres = berrysDisponibles - cout;

  return {
    perso,
    seed,
    doublon,
    recyclage_propose_berrys: doublon ? config.recyclage_doublon[perso.rarete]! : null,
    changement_perso_actif_gratuit: !doublon,
    berrys_avant: berrysDisponibles,
    berrys_apres: berrysApres,
  };
}

/**
 * Le tout premier tirage d'un joueur (§4) : un Commun, garanti, tiré uniformément.
 *
 * Fonction à part et NON un paramètre de `tirer()` : forcer une rareté dans le moteur
 * reviendrait à lui faire porter une exception qui n'existe qu'une fois dans la vie d'un
 * compte. Et on ne peut pas non plus se contenter d'appeler `tirer()` en ne lui passant que
 * les Communs : les taux de `config` ne totalisent alors plus 1 (0,60 pour le tier Commun),
 * et tous les tirages au-dessus de 0,60 tomberaient dans le filet de sécurité, c'est-à-dire
 * toujours sur le DERNIER Commun du catalogue.
 *
 * Uniforme et pas pondéré par les taux : à l'intérieur d'un même tier, §3bis partage le taux
 * à parts égales entre les persos — uniforme, c'est donc déjà la bonne distribution.
 */
export function tirerCommunGaranti(persos: Perso[], seed?: number): { perso: Perso; seed: number } {
  const communs = persos.filter((p) => p.rarete === 'Commun');
  if (communs.length === 0) {
    throw new Error('gacha : aucun perso de rareté "Commun" dans le catalogue — le tirage de départ est impossible.');
  }
  const seedUtilise = seed ?? seedAleatoire();
  const rng = creerRng(seedUtilise);
  return { perso: communs[Math.floor(rng() * communs.length)], seed: seedUtilise };
}

/** Si le joueur accepte le recyclage proposé après un doublon : le nouveau solde de Berrys. */
export function accepterRecyclage(berrysDisponibles: number, perso: Perso, config: Config): number {
  const recompense = config.recyclage_doublon[perso.rarete];
  if (recompense === undefined) {
    throw new Error(`gacha : pas de valeur de recyclage pour la rareté "${perso.rarete}" en config.`);
  }
  return berrysDisponibles + recompense;
}
