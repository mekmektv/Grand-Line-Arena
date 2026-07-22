// GRAND LINE ARENA — crédite manuellement des Berrys de présence EN ATTENTE à un compte, pour
// tester le rond d'encaissement de l'accueil sans attendre un vrai live.
//
//   node server/scripts/crediter-presence.ts <twitch_id> <montant>
import '../src/load-env.ts';
import { supabaseSelectUn, supabaseUpdate } from '../src/supabase.ts';

const [twitchId, montantBrut] = process.argv.slice(2);
const montant = Number(montantBrut);
if (!twitchId || !Number.isInteger(montant) || montant <= 0) {
  throw new Error('Usage : node server/scripts/crediter-presence.ts <twitch_id> <montant>');
}

const joueur = await supabaseSelectUn<{ id: string; pseudo: string; presence_berrys_en_attente: number }>(
  'players', { twitch_id: `eq.${twitchId}`, select: 'id,pseudo,presence_berrys_en_attente' },
);
if (!joueur) throw new Error(`Aucun joueur avec twitch_id="${twitchId}".`);

const nouveauMontant = joueur.presence_berrys_en_attente + montant;
await supabaseUpdate('players', { id: `eq.${joueur.id}` }, { presence_berrys_en_attente: nouveauMontant });

console.log(`  ${joueur.pseudo} : ${joueur.presence_berrys_en_attente} → ${nouveauMontant} Berrys de présence en attente.`);
