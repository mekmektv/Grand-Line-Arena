// GRAND LINE ARENA — recycler un perso qu'on possède contre des Berrys (§4 GAME_DESIGN.md).
//
// Un seul chemin pour les deux entrées demandées :
//   · juste après un tirage, sur l'écran de révélation (le perso vient d'entrer en collection) ;
//   · depuis la collection, sur la fiche d'un perso déjà possédé.
// Les deux appellent POST /recycler avec le même collection_id — la règle de gain (par rareté,
// via config.recyclage_doublon) et les garde-fous ne vivent donc qu'ici.
//
// Le recyclage automatique des DOUBLONS au tirage (tirage-api.ts) reste inchangé : un doublon
// ne crée pas de ligne de collection, il n'y a donc rien à recycler manuellement.

import { chargerConfig } from './index.ts';
import { supabaseSelect, supabaseSelectUn, supabaseDelete, supabaseUpdate } from './supabase.ts';

export type ResultatRecyclage =
  | { ok: true; berrys_gagnes: number; berrys_total: number; nom: string }
  | { ok: false; erreur: string };

export async function recyclerPerso(playerId: string, collectionId: number): Promise<ResultatRecyclage> {
  const [lignesConfig, joueur, ligne] = await Promise.all([
    supabaseSelect('config', { select: 'cle,valeur' }),
    supabaseSelectUn<{ berrys: number; perso_actif_id: number | null }>(
      'players', { id: `eq.${playerId}`, select: 'berrys,perso_actif_id' },
    ),
    supabaseSelectUn<{ id: number; player_id: string; character_id: number }>(
      'collection', { id: `eq.${collectionId}`, select: 'id,player_id,character_id' },
    ),
  ]);

  if (!joueur) return { ok: false, erreur: 'Joueur introuvable.' };
  // Même message pour "n'existe pas" et "appartient à quelqu'un d'autre" : distinguer les deux
  // dirait à un curieux quels collection_id existent chez les autres joueurs.
  if (!ligne || ligne.player_id !== playerId) {
    return { ok: false, erreur: 'Ce pirate n\'est pas dans ta collection.' };
  }
  if (joueur.perso_actif_id === collectionId) {
    return { ok: false, erreur: 'Impossible de recycler ton pirate actif — incarne-en un autre d\'abord.' };
  }

  const character = await supabaseSelectUn<{ nom: string; rarete: string }>(
    'characters', { id: `eq.${ligne.character_id}`, select: 'nom,rarete' },
  );
  if (!character) return { ok: false, erreur: 'Pirate introuvable au catalogue.' };

  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);
  const gain = config.recyclage_doublon[character.rarete as keyof typeof config.recyclage_doublon];
  if (gain === undefined) {
    return { ok: false, erreur: `Pas de valeur de recyclage pour la rareté "${character.rarete}" en config.` };
  }

  const berrysTotal = joueur.berrys + gain;
  // La suppression d'abord : si elle échoue, le joueur n'a pas été crédité d'un perso qu'il
  // possède encore. L'inverse (créditer puis échouer à supprimer) offrirait des Berrys infinis.
  await supabaseDelete('collection', { id: `eq.${collectionId}` });
  await supabaseUpdate('players', { id: `eq.${playerId}` }, { berrys: berrysTotal });

  return { ok: true, berrys_gagnes: gain, berrys_total: berrysTotal, nom: character.nom };
}
