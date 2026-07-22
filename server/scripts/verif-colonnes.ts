// Vérifie si les colonnes de A_APPLIQUER_onboarding.sql sont bien en base.
//   node server/scripts/verif-colonnes.ts
import '../src/load-env.ts';
import { supabaseSelect } from '../src/supabase.ts';

for (const colonne of ['onboarding_etape', 'avatar_url']) {
  try {
    await supabaseSelect('players', { select: `id,${colonne}`, limit: '1' });
    console.log(`  ${colonne} : PRÉSENTE`);
  } catch (e) {
    console.log(`  ${colonne} : ABSENTE — ${(e as Error).message.slice(0, 100)}`);
  }
}

const joueurs = await supabaseSelect<{ id: string; twitch_id: string; pseudo: string }>(
  'players', { select: 'id,twitch_id,pseudo' },
);
console.log('\n  Joueurs en base :');
for (const j of joueurs) console.log(`    ${j.pseudo}  (twitch_id=${j.twitch_id})`);
