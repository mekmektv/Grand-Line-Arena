// GRAND LINE ARENA — insère les réglages de la Brique 6 (Twitch en live) : taux du tirage
// premium (§5bis) et gains de présence (§3).
//
//   node server/scripts/maj-config-twitch.ts
//
// Passe par l'API REST : `config` est une table de valeurs, pas du DDL (règle d'or CLAUDE.md).
// Le DDL correspondant (colonnes players + twitch_live_etat) est dans
// supabase/A_APPLIQUER_twitch.sql, à coller à la main.
import '../src/load-env.ts';
import { supabaseUpsert } from '../src/supabase.ts';

// Même pool de persos que le tirage normal, meilleurs taux — jamais de contenu exclusif.
// Comparaison avec les taux normaux (drop_rate_*) : Commun 70→41, Peu commun 22→36,
// Rare 7,5→21, Épique 0,5→2 (×4). Toujours pas garanti, cohérent avec un coffre déjà rare
// à obtenir (1000 pts de chaîne, 1×/viewer/live). Épique volontairement plafonné à 2 % (décidé
// le 22/07/2026, la première proposition à 5 % a été jugée trop généreuse).
const TAUX_PREMIUM = [
  ['drop_rate_premium_commun', 0.41, 'Taux de tirage premium — rareté Commun'],
  ['drop_rate_premium_peu_commun', 0.36, 'Taux de tirage premium — rareté Peu commun'],
  ['drop_rate_premium_rare', 0.21, 'Taux de tirage premium — rareté Rare'],
  ['drop_rate_premium_epique', 0.02, 'Taux de tirage premium — rareté Épique (se partage si plusieurs Épiques)'],
] as const;

const somme = TAUX_PREMIUM.reduce((s, [, v]) => s + v, 0);
if (Math.abs(somme - 1) > 0.001) {
  throw new Error(`Les taux premium ne totalisent pas 100 % (somme = ${(somme * 100).toFixed(2)} %).`);
}

// Chiffres déjà fixés dans le §3 GAME_DESIGN.md, pas une invention de cette Brique.
const PRESENCE = [
  ['gain_presence_tranche', 40, 'Berrys par tranche de 30 min de présence en live détectée (§3)'],
  ['gain_bonus_connexion_live', 20, 'Berrys, une fois par live, à la première présence détectée (§3)'],
] as const;

const REGLAGES = [...TAUX_PREMIUM, ...PRESENCE];

for (const [cle, valeur, description] of REGLAGES) {
  await supabaseUpsert('config', { cle, valeur, description });
  console.log(`  ${cle.padEnd(28)} ← ${valeur}`);
}

console.log(`\n  ✅ ${REGLAGES.length} réglages écrits.`);
