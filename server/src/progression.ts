// ONE PIECE ARENA — l'XP et la montée de niveau d'un perso. §3 GAME_DESIGN.md.
//
// Logique pure, comme gacha.ts et combat.ts : ce fichier ne touche jamais la base. Il prend
// l'XP actuelle d'un perso et l'issue d'un combat, et rend le nouvel état. C'est à l'appelant
// (combat-api.ts) d'écrire le résultat.
//
// Rien n'est en dur : le gain par combat et les deux seuils viennent de `config`. Le niveau
// maximum, lui, est structurel et non configurable — `characters` ne stocke des stats que pour
// 3 niveaux (pv_niv1..3), et le type Niveau du moteur vaut 1 | 2 | 3.

import type { Config, Niveau } from './types.ts';

/** Le niveau maximum d'un perso. Structurel (§3) : `characters` n'a de stats que jusqu'à 3. */
export const NIVEAU_MAX: Niveau = 3;

/**
 * Le niveau correspondant à une XP cumulée.
 * Les seuils de config sont cumulés : 140 XP au total → niveau 2, 420 XP au total → niveau 3.
 */
export function niveauPourXp(xp: number, config: Config): Niveau {
  if (xp >= config.xp_niveau_3) return 3;
  if (xp >= config.xp_niveau_2) return 2;
  return 1;
}

/** L'XP cumulée nécessaire pour atteindre un niveau donné (0 pour le niveau 1, de départ). */
export function seuilDuNiveau(niveau: Niveau, config: Config): number {
  if (niveau === 3) return config.xp_niveau_3;
  if (niveau === 2) return config.xp_niveau_2;
  return 0;
}

export interface GainXp {
  xp_gagnee: number;
  xp_avant: number;
  xp_apres: number;
  niveau_avant: Niveau;
  niveau_apres: Niveau;
  /** true si ce combat a fait passer un palier — c'est ce que le front met en scène. */
  niveau_gagne: boolean;
  /** Progression vers le niveau suivant, 0..1. Vaut 1 au niveau max (barre pleine, pas vide). */
  progression_pct: number;
  /** XP restante avant le prochain palier. null au niveau max. */
  xp_avant_prochain_niveau: number | null;
}

/**
 * Applique le gain d'XP d'un combat.
 *
 * @param xpActuelle  l'XP cumulée du perso avant le combat (collection.xp)
 * @param gagne       le joueur a-t-il gagné ce combat ?
 * @param config      la config, chargée via chargerConfig()
 */
export function appliquerXpCombat(xpActuelle: number, gagne: boolean, config: Config): GainXp {
  const xpGagnee = gagne ? config.xp_combat_gagne : config.xp_combat_perdu;
  const xpAvant = Math.max(0, Math.round(xpActuelle));
  const niveauAvant = niveauPourXp(xpAvant, config);

  // Au niveau max l'XP cesse de monter : la laisser gonfler indéfiniment n'aurait aucun effet
  // de jeu et fausserait toute lecture future de la barre de progression.
  const plafond = config.xp_niveau_3;
  const xpApres = Math.min(plafond, xpAvant + xpGagnee);
  const niveauApres = niveauPourXp(xpApres, config);

  return {
    xp_gagnee: xpApres - xpAvant,
    xp_avant: xpAvant,
    xp_apres: xpApres,
    niveau_avant: niveauAvant,
    niveau_apres: niveauApres,
    niveau_gagne: niveauApres > niveauAvant,
    ...detaillerProgression(xpApres, niveauApres, config),
  };
}

/** La barre de progression telle que le front l'affiche (fiche perso, écran de fin de combat). */
export function detaillerProgression(xp: number, niveau: Niveau, config: Config): {
  progression_pct: number; xp_avant_prochain_niveau: number | null;
} {
  if (niveau >= NIVEAU_MAX) return { progression_pct: 1, xp_avant_prochain_niveau: null };
  const seuilBas = seuilDuNiveau(niveau, config);
  const seuilHaut = seuilDuNiveau((niveau + 1) as Niveau, config);
  const etendue = seuilHaut - seuilBas;
  return {
    progression_pct: Math.min(1, Math.max(0, (xp - seuilBas) / etendue)),
    xp_avant_prochain_niveau: Math.max(0, seuilHaut - xp),
  };
}
