// GRAND LINE ARENA — moteur de combat. Point d'entrée public.
//
// Usage typique côté back (quand l'API existera — elle n'est PAS dans ce lot) :
//
//   import { chargerConfig, chargerPerso, simulerCombat } from './server/src/index.ts';
//
//   const { data: lignesConfig }  = await supabase.from('config').select('cle, valeur');
//   const { data: lignesPersos }  = await supabase.from('characters').select('*');
//
//   const config = chargerConfig(lignesConfig);            // à faire UNE fois au démarrage
//   const croco  = chargerPerso(lignesPersos.find(p => p.nom === 'Crocodile'));
//   const arlong = chargerPerso(lignesPersos.find(p => p.nom === 'Arlong'));
//
//   const resultat = simulerCombat({ perso: croco, niveau: 3 }, { perso: arlong, niveau: 3 }, config);
//   resultat.vainqueur    // 'a' ou 'b'
//   resultat.evenements   // la liste que le front rejoue → à stocker dans fights.log
//   resultat.seed         // rejouer avec ce seed redonne exactement le même combat

export { simulerCombat } from './combat.ts';
export type { OptionsCombat } from './combat.ts';
export { chargerConfig, chargerPerso, lireDeclencheur } from './config.ts';
export type { LigneCharacter, LigneConfig } from './config.ts';
export { budgetEffectif, calculerStats, statsEngage } from './stats.ts';
export type { Stats } from './stats.ts';
export { creerRng, seedAleatoire } from './rng.ts';
export { tauxParPerso, tirer, tirerPremium, tirerCommunGaranti, accepterRecyclage } from './gacha.ts';
export type { ResultatTirage } from './gacha.ts';
export {
  ouvrirCoffre, recyclerObjet, bonusEquipement, budgetObjet, sacrificesPossibles,
  validerSacrifice, peutEquiper, rareteAuDessus, RARETES_EQUIPEMENT, TYPES_EQUIPEMENT,
} from './equipement.ts';
export type {
  BonusEquipement, SacrificePossible, PaiementCoffre, ResultatCoffre, ResultatRecyclage,
} from './equipement.ts';
export {
  appliquerXpCombat, niveauPourXp, seuilDuNiveau, detaillerProgression, NIVEAU_MAX,
} from './progression.ts';
export type { GainXp } from './progression.ts';
export type * from './types.ts';
