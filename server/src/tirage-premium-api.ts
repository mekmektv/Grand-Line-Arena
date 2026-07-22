// GRAND LINE ARENA — Brique 6 : ouverture d'un coffre premium (points de chaîne Twitch).
// Même rendu qu'un tirage normal (tirage-api.ts), mais consomme `coffres_premium_perso`
// au lieu de Berrys, et pioche dans `drop_rates_premium` via gacha.ts:tirerPremium().

import { chargerConfig, chargerPerso, tirerPremium, accepterRecyclage } from './index.ts';
import { construireResultat, type LigneCharacterAvecId } from './tirage-api.ts';
import type { ResultatTiragePersiste } from './tirage-api.ts';
import { supabaseSelect, supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';

interface LigneJoueur {
  id: string;
  berrys: number;
  coffres_premium_perso: number;
}

export async function ouvrirCoffrePremium(playerId: string): Promise<ResultatTiragePersiste> {
  const [lignesConfig, lignesCharacters, lignesCollection, joueur] = await Promise.all([
    supabaseSelect('config', { select: 'cle,valeur' }),
    supabaseSelect<LigneCharacterAvecId>('characters', { select: '*', jouable: 'eq.true' }),
    supabaseSelect<{ character_id: number }>('collection', { player_id: `eq.${playerId}`, select: 'character_id' }),
    supabaseSelectUn<LigneJoueur>('players', { id: `eq.${playerId}`, select: '*' }),
  ]);
  if (!joueur) throw new Error('Joueur introuvable.');
  if (joueur.coffres_premium_perso <= 0) {
    throw new Error('Aucun coffre premium disponible.');
  }

  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);
  const persos = lignesCharacters.map(chargerPerso);
  const persoParNom = new Map(lignesCharacters.map((l) => [l.nom, l]));
  const idsPossedes = new Set(lignesCollection.map((c) => c.character_id));
  const nomsDejaPossedes = new Set(
    lignesCharacters.filter((l) => idsPossedes.has(l.id)).map((l) => l.nom),
  );

  const resultat = tirerPremium({ nomsDejaPossedes, persos, config });

  let collectionId: number | null = null;
  let recyclageGagne: number | null = null;
  let berrysApres = joueur.berrys;

  if (resultat.doublon) {
    recyclageGagne = config.recyclage_doublon[resultat.perso.rarete]!;
    berrysApres = accepterRecyclage(joueur.berrys, resultat.perso, config);
  } else {
    const ligne = persoParNom.get(resultat.perso.nom)!;
    const nouvelleLigne = await supabaseInsert<{ id: number }>('collection', {
      player_id: playerId,
      character_id: ligne.id,
      niveau: 1,
    });
    collectionId = nouvelleLigne.id;
  }

  await supabaseUpdate('players', { id: `eq.${playerId}` }, {
    berrys: berrysApres,
    coffres_premium_perso: joueur.coffres_premium_perso - 1,
  });

  return {
    perso: construireResultat(resultat.perso, persoParNom.get(resultat.perso.nom)!, config),
    doublon: resultat.doublon,
    recyclage_gagne: recyclageGagne,
    collection_id: collectionId,
    berrys_apres: berrysApres,
  };
}
