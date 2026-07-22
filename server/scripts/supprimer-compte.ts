// Supprime un compte pour rejouer l'onboarding de zéro.
//   node server/scripts/supprimer-compte.ts <twitch_id>
//
// ⚠️ `fights` référence players SANS on delete cascade (contrairement à collection,
// equipment et quetes_reclamees) : il faut effacer les combats d'abord, sinon la
// suppression du joueur est refusée par la contrainte de clé étrangère.
import '../src/load-env.ts';
import { supabaseSelectUn, supabaseDelete } from '../src/supabase.ts';

const twitchId = process.argv[2];
if (!twitchId) throw new Error('Usage : node server/scripts/supprimer-compte.ts <twitch_id>');

const joueur = await supabaseSelectUn<{ id: string; pseudo: string }>(
  'players', { twitch_id: `eq.${twitchId}`, select: 'id,pseudo' },
);
if (!joueur) throw new Error(`Aucun joueur avec twitch_id=${twitchId}`);

console.log(`  Suppression de ${joueur.pseudo} (${joueur.id})…`);

// Les trois rôles possibles dans un combat, chacun avec sa propre contrainte.
for (const colonne of ['joueur_a', 'joueur_b', 'vainqueur']) {
  const efface = await supabaseDelete('fights', { [colonne]: `eq.${joueur.id}` });
  console.log(`    fights.${colonne} : ${efface.length} effacé(s)`);
}

await supabaseDelete('players', { id: `eq.${joueur.id}` });
console.log('    players : effacé (collection / equipment / quetes_reclamees suivent en cascade)');

const reste = await supabaseSelectUn('players', { twitch_id: `eq.${twitchId}`, select: 'id' });
console.log(reste ? '\n  ⚠️ Le joueur est TOUJOURS là.' : '\n  ✅ Compte supprimé.');
