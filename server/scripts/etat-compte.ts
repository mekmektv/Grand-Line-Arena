// Inventaire de ce qui est rattaché à un compte, avant suppression.
//   node server/scripts/etat-compte.ts <twitch_id>
import '../src/load-env.ts';
import { supabaseSelect, supabaseSelectUn } from '../src/supabase.ts';

const twitchId = process.argv[2];
if (!twitchId) throw new Error('Usage : node server/scripts/etat-compte.ts <twitch_id>');

const joueur = await supabaseSelectUn<{ id: string; pseudo: string; onboarding_etape: number; avatar_url: string | null }>(
  'players', { twitch_id: `eq.${twitchId}`, select: '*' },
);
if (!joueur) throw new Error(`Aucun joueur avec twitch_id=${twitchId}`);

console.log(`\n  ${joueur.pseudo}  (id=${joueur.id})`);
console.log(`  onboarding_etape = ${joueur.onboarding_etape}`);
console.log(`  avatar_url = ${joueur.avatar_url ?? '(aucun)'}`);

// select=player_id et pas id : quetes_reclamees n'a pas de colonne id (clé composite).
const compte = async (table: string, params: Record<string, string>) =>
  (await supabaseSelect(table, { ...params, select: Object.keys(params)[0] })).length;

console.log('\n  Rattaché à ce compte :');
console.log(`    collection        : ${await compte('collection', { player_id: `eq.${joueur.id}` })}`);
console.log(`    equipment         : ${await compte('equipment', { player_id: `eq.${joueur.id}` })}`);
console.log(`    quetes_reclamees  : ${await compte('quetes_reclamees', { player_id: `eq.${joueur.id}` })}`);
console.log(`    fights (joueur_a) : ${await compte('fights', { joueur_a: `eq.${joueur.id}` })}`);
console.log(`    fights (joueur_b) : ${await compte('fights', { joueur_b: `eq.${joueur.id}` })}`);

// Marque les autres comptes, pour vérifier que le SQL les a bien mis à 3.
const tous = await supabaseSelect<{ pseudo: string; onboarding_etape: number }>(
  'players', { select: 'pseudo,onboarding_etape' },
);
console.log('\n  Étape d\'onboarding de tous les comptes :');
for (const j of tous) console.log(`    ${j.pseudo} → ${j.onboarding_etape}`);
