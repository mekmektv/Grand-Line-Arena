// ONE PIECE ARENA — logique PURE des quêtes (§8). Aucun accès base, aucune horloge cachée :
// l'instant et les mesures sont passés en paramètres, donc entièrement testable (voir
// server/scripts/validation-quetes.ts). Le branchement base est dans quetes-api.ts.
//
// Séparation volontaire, comme recharge.ts / recharge-api.ts : ici on décide QUELLE quête est
// active et SI elle est accomplie ; là-bas on va chercher les chiffres en base et on verse les
// Berrys.

import type { Config, QueteDef } from './types.ts';
import { cleJour, cleSemaine } from './recharge.ts';

/**
 * Tout ce qu'il faut mesurer pour évaluer n'importe quelle quête, calculé une fois en base.
 * Les compteurs de combat existent en deux versions (jour / semaine) car la même quête de
 * combat peut vivre dans l'une ou l'autre catégorie et ne doit compter que sur SA période.
 */
export interface MesuresQuetes {
  combats_joues_jour: number;
  combats_gagnes_jour: number;
  coffres_ouverts_jour: number;
  combats_joues_semaine: number;
  combats_gagnes_semaine: number;
  coffres_ouverts_semaine: number;
  /** Par classe : combien de persos DISTINCTS le joueur possède, sur combien existent. */
  collection_classe: Record<string, { possede: number; total: number }>;
  /** Idem par rareté. */
  collection_rarete: Record<string, { possede: number; total: number }>;
}

/** Un numéro de jour stable et croissant à partir d'une clé 'YYYY-MM-DD'. Sert à faire tourner
 *  la quête du jour de façon déterministe : le même jour donne la même quête pour tout le monde. */
function indexJour(cle: string): number {
  const [a, m, j] = cle.split('-').map(Number);
  return Math.floor(Date.UTC(a, m - 1, j) / 86_400_000);
}

/** Choisit un élément d'une liste par rotation déterministe sur l'index de jour. */
function parRotation<T>(liste: T[], index: number): T | null {
  if (liste.length === 0) return null;
  return liste[((index % liste.length) + liste.length) % liste.length];
}

/** La quête du jour du moment : une seule, choisie par rotation parmi les quêtes 'jour' actives
 *  (§8 : "1 quête/jour, reset quotidien"). null si le catalogue n'en contient aucune active. */
export function queteDuJour(config: Config, instant: Date): QueteDef | null {
  const pool = config.quetes_catalogue.filter((q) => q.categorie === 'jour' && q.actif);
  return parRotation(pool, indexJour(cleJour(instant, config)));
}

/** La quête de la semaine du moment, même principe que la quête du jour mais sur l'horloge
 *  hebdomadaire. null si aucune quête 'semaine' active. */
export function queteDeLaSemaine(config: Config, instant: Date): QueteDef | null {
  const pool = config.quetes_catalogue.filter((q) => q.categorie === 'semaine' && q.actif);
  return parRotation(pool, indexJour(cleSemaine(instant, config)));
}

/** Toutes les quêtes de collection actives (succès permanents). Pas de rotation : elles sont
 *  toutes proposées en même temps. */
export function quetesCollection(config: Config): QueteDef[] {
  return config.quetes_catalogue.filter((q) => q.categorie === 'collection' && q.actif);
}

/** La "période" à laquelle se rattache une réclamation, clé de déduplication en base :
 *  la journée pour une quête du jour (donc réclamable à nouveau demain), la semaine pour une
 *  hebdo, et 'permanent' pour un succès de collection (réclamable une seule fois à vie). */
export function periodeQuete(def: QueteDef, instant: Date, config: Config): string {
  if (def.categorie === 'jour') return cleJour(instant, config);
  if (def.categorie === 'semaine') return cleSemaine(instant, config);
  return 'permanent';
}

export interface EvaluationQuete {
  /** Où en est le joueur (ex: 2 combats gagnés). */
  progression: number;
  /** Le palier à atteindre (dynamique pour la collection : nb de persos concernés). */
  objectif: number;
  /** Vrai dès que la progression atteint l'objectif — condition nécessaire pour réclamer. */
  accomplie: boolean;
}

/**
 * Évalue une quête à partir des mesures. Pur : ne décide pas si elle est réclamable (ça dépend
 * de l'historique de réclamations, qui est en base) — seulement si elle est ACCOMPLIE.
 *
 * Pour une quête de collection, l'objectif est le nombre total de persos concernés à l'instant T
 * (ex: le nombre d'Épiques en base). Un total de 0 (aucun perso de cette classe/rareté) ne peut
 * jamais être "accompli" : sinon on offrirait la récompense d'un set vide.
 */
export function evaluerQuete(def: QueteDef, mesures: MesuresQuetes): EvaluationQuete {
  const surPeriode = def.categorie === 'semaine' ? '_semaine' : '_jour';

  switch (def.type) {
    case 'combats_joues':
    case 'combats_gagnes':
    case 'coffres_ouverts': {
      const cle = `${def.type === 'combats_joues' ? 'combats_joues'
        : def.type === 'combats_gagnes' ? 'combats_gagnes' : 'coffres_ouverts'}${surPeriode}` as keyof MesuresQuetes;
      const progression = mesures[cle] as number;
      const objectif = def.objectif ?? 0;
      return { progression, objectif, accomplie: objectif > 0 && progression >= objectif };
    }
    case 'collection_classe':
    case 'collection_rarete': {
      const source = def.type === 'collection_classe' ? mesures.collection_classe : mesures.collection_rarete;
      const entree = (def.filtre && source[def.filtre]) || { possede: 0, total: 0 };
      return {
        progression: entree.possede,
        objectif: entree.total,
        accomplie: entree.total > 0 && entree.possede >= entree.total,
      };
    }
  }
}
