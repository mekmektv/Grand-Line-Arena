// ONE PIECE ARENA — crédite manuellement des coffres premium à un compte, pour tester le roll
// premium sans attendre une vraie redemption Twitch en live.
//
//   node server/scripts/crediter-coffre-premium.ts <twitch_id> <quantite>
import '../src/load-env.ts';
import { supabaseSelectUn, supabaseUpdate } from '../src/supabase.ts';

const [twitchId, quantiteBrute] = process.argv.slice(2);
const quantite = Number(quantiteBrute);
if (!twitchId || !Number.isInteger(quantite) || quantite <= 0) {
  throw new Error('Usage : node server/scripts/crediter-coffre-premium.ts <twitch_id> <quantite>');
}

const joueur = await supabaseSelectUn<{ id: string; pseudo: string; coffres_premium_perso: number }>(
  'players', { twitch_id: `eq.${twitchId}`, select: 'id,pseudo,coffres_premium_perso' },
);
if (!joueur) throw new Error(`Aucun joueur avec twitch_id="${twitchId}".`);

const nouveauStock = joueur.coffres_premium_perso + quantite;
await supabaseUpdate('players', { id: `eq.${joueur.id}` }, { coffres_premium_perso: nouveauStock });

console.log(`  ${joueur.pseudo} : ${joueur.coffres_premium_perso} → ${nouveauStock} coffres premium.`);
