// ONE PIECE ARENA — validation de l'onboarding (Brique 3), SANS passer par le vrai écran
// Twitch : on simule juste "un twitch_id inconnu vient de se connecter" et on vérifie que
// connecterOuCreerJoueur() fait exactement ce que dit GAME_DESIGN.md §4 :
//   1 perso commun OFFERT + 1 tirage gratuit immédiat, une seule fois par joueur.
//
// Nécessite un vrai projet Supabase avec la migration + les seeds appliqués (server/.env
// rempli, voir server/README.md). Ce script écrit dans TA base puis nettoie derrière lui.
//
// Lancer : node server/scripts/validation-onboarding.ts

import '../src/load-env.ts';
import { connecterOuCreerJoueur } from '../src/onboarding.ts';
import { supabaseSelect, supabaseSelectUn } from '../src/supabase.ts';
import { env } from '../src/env.ts';

const twitchIdTest = `test-onboarding-${Date.now()}`;
let ok = true;

function verifier(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? '✅' : '❌'} ${label}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`);
  if (!condition) ok = false;
}

async function nettoyer(playerId: string) {
  const url = `${env.supabaseUrl}/rest/v1`;
  const headers = {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
  };
  await fetch(`${url}/collection?player_id=eq.${playerId}`, { method: 'DELETE', headers });
  await fetch(`${url}/players?id=eq.${playerId}`, { method: 'DELETE', headers });
}

async function main() {
  console.log(`Onboarding — joueur de test twitch_id="${twitchIdTest}"\n`);

  // 1) Première connexion : doit créer le joueur + onboarding complet.
  const premiere = await connecterOuCreerJoueur(twitchIdTest, 'JoueurTest');
  verifier('nouveau_joueur = true à la 1ère connexion', premiere.nouveau_joueur === true);
  verifier('perso_actif_id est renseigné', premiere.perso_actif_id !== null, premiere.perso_actif_id);

  const collection = await supabaseSelect('collection', { player_id: `eq.${premiere.id}`, select: '*' });
  verifier(
    '1 ou 2 lignes en collection (2 si le tirage gratuit est tombé sur un perso différent du starter)',
    collection.length === 1 || collection.length === 2,
    collection.length,
  );
  verifier(
    'Berrys restants cohérents (0, ou le montant de recyclage si le tirage a fait doublon)',
    premiere.berrys >= 0,
    premiere.berrys,
  );

  // 2) Reconnexion : NE DOIT RIEN redonner (même joueur, pas un 2e onboarding).
  const deuxieme = await connecterOuCreerJoueur(twitchIdTest, 'JoueurTest');
  verifier('nouveau_joueur = false à la reconnexion', deuxieme.nouveau_joueur === false);
  verifier('même id de joueur', deuxieme.id === premiere.id);

  const collectionApres = await supabaseSelect('collection', { player_id: `eq.${premiere.id}`, select: '*' });
  verifier('la reconnexion ne crée pas de perso supplémentaire', collectionApres.length === collection.length, {
    avant: collection.length,
    apres: collectionApres.length,
  });

  const joueurEnBase = await supabaseSelectUn('players', { id: `eq.${premiere.id}`, select: '*' });
  verifier('le joueur existe bien en base', joueurEnBase !== null);

  await nettoyer(premiere.id);
  console.log('\n(joueur de test nettoyé de la base)\n');

  if (!ok) {
    console.error('❌ VALIDATION ÉCHOUÉE — voir les lignes ❌ ci-dessus.');
    process.exit(1);
  }
  console.log('✅ Validation onboarding réussie.');
}

main().catch((e) => {
  console.error('Erreur pendant la validation :', e);
  process.exit(1);
});
