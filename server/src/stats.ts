// GRAND LINE ARENA — la formule des stats. §4 EQUILIBRAGE_FINAL.md, §3 GAME_DESIGN.md.
//
//   budget_effectif = BUDGET[rareté][niveau] / (1 + coût_kit)
//   h               = 0.40 Bourrin | 0.50 Équilibré | 0.60 Tank
//
//   PV     = hp_scale × (budget_effectif / 2) × √( h / (1 − h) )
//   ATTACK =            (budget_effectif / 2) × √( (1 − h) / h )
//
// ⚠️ LA RACINE CARRÉE EST ESSENTIELLE — NE JAMAIS LA SIMPLIFIER.
// Ce qui décide un combat d'usure, c'est PV × Attack, pas PV + Attack. La racine carrée est
// ce qui rend PV × Attack constant quel que soit le profil. Sans elle, le profil Tank perd
// 25 % de sa puissance gratuitement (c'est ce qui mettait Dalton à 7 % de winrate) et le
// profil devient un piège au lieu d'un choix de style.

import type { Config, Engage, Niveau, ObjetEquipement, Perso } from './types.ts';
import { bonusEquipement } from './equipement.ts';

export interface Stats {
  pv: number;
  attack: number;
}

/**
 * Le budget de puissance d'un perso, une fois son kit payé.
 * Un perso avec un gros spécial (Dalton, +17 %) a moins de budget pour ses stats :
 * c'est comme ça que le spécial est "payé" et que l'équilibre tient.
 */
export function budgetEffectif(perso: Perso, niveau: Niveau, config: Config): number {
  const budget = config.budgets[perso.rarete][niveau - 1];
  if (budget === undefined) {
    throw new Error(`Niveau ${niveau} inconnu pour la rareté ${perso.rarete} (niveaux attendus : 1, 2 ou 3).`);
  }
  return budget / (1 + perso.cout_kit_pct / 100); // cout_kit_pct est en pourcent : 1.1 => 1,1 %
}

/**
 * Les 2 seules stats d'un perso : PV et Attack.
 * L'esquive, le crit, la régén et le tir d'ouverture ne sont PAS ici : ils viennent de la
 * classe et des constantes de `config` (§3 GAME_DESIGN). Un perso ne les stocke pas.
 *
 * Volontairement NON arrondi : le combat calcule en décimales, comme la simulation d'origine.
 * Les entiers de persos.csv (623 PV / 69 ATK) ne sont que l'affichage de ces mêmes nombres.
 *
 * §4ter : `equipement` ajoute ses PV/Attack À LA FIN, une fois la formule appliquée.
 *
 * ⚠️ Ne JAMAIS le faire entrer dans le budget. La racine carrée ci-dessous rend PV × Attack
 * indépendant du profil ; un bonus qui la traverserait vaudrait plus sur un Tank que sur un
 * Bourrin, et les objets cesseraient d'être équivalents entre eux. Le bonus est plat, il
 * s'additionne — c'est tout.
 */
export function calculerStats(
  perso: Perso, niveau: Niveau, config: Config, equipement?: readonly ObjetEquipement[],
): Stats {
  const h = config.profils[perso.profil];
  const moitie = budgetEffectif(perso, niveau, config) / 2;
  const bonus = bonusEquipement(equipement);

  return {
    pv: config.hp_scale * moitie * Math.sqrt(h / (1 - h)) + bonus.hp,
    attack: moitie * Math.sqrt((1 - h) / h) + bonus.attack,
  };
}

/** Raccourci : les stats d'un perso engagé (perso + niveau + son équipement). */
export function statsEngage(engage: Engage, config: Config): Stats {
  return calculerStats(engage.perso, engage.niveau, config, engage.equipement);
}
