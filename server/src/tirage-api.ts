// GRAND LINE ARENA — branche la logique pure de gacha.ts sur la vraie base (lecture des
// soldes/collection, écriture du résultat). gacha.ts lui-même ne change jamais.
//
// Simplification ASSUMÉE : en cas de doublon, le recyclage est appliqué AUTOMATIQUEMENT
// (comme le fait déjà onboarding.ts) plutôt que de demander une confirmation dans une 2e
// requête — posséder un doublon sans le recycler n'a aucun intérêt en l'état du jeu, ça
// évite un aller-retour et un état "proposition en attente" à gérer entre deux requêtes.

import { chargerConfig, chargerPerso, tirer, tirerCommunGaranti, accepterRecyclage, calculerStats } from './index.ts';
import { describeCompetence } from './collection.ts';
import { ETAPE_TUTO_ACCUEIL } from './onboarding.ts';
import { supabaseSelect, supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';
import { urlPublique } from './assets.ts';
import type { Config, Perso } from './types.ts';

// Exportés pour tirage-premium-api.ts (Brique 6) : même rendu de résultat que le tirage
// normal, la révélation en cascade de l'écran de tirage ne doit pas se comporter différemment.
export interface LigneCharacterAvecId {
  id: number;
  nom: string;
  classe: string;
  rarete: string;
  profil: string;
  cout_kit_pct: number;
  resistance: number | null;
  competence_nom: string | null;
  competence_type: string | null;
  competence_declencheur: string | null;
  // Le même type que `LigneCharacter` (config.ts), et non `unknown` : ces lignes sont
  // passées telles quelles à chargerPerso(), donc les deux déclarations doivent concorder.
  // Avec `unknown`, TypeScript refusait l'appel — une erreur qui dormait depuis le début du
  // projet, `server/` n'ayant jamais été vérifié faute de tsconfig.json.
  competence_effet?: string | Record<string, unknown> | null;
  sprite_folder: string;
  image_menu: string | null;
}

interface LigneJoueur {
  id: string;
  berrys: number;
}

export interface ResultatTiragePersiste {
  /** Les stats sont celles du NIVEAU 1 : un perso fraîchement tiré n'a pas d'XP (§3).
   *  Elles servent la révélation en cascade de l'écran de tirage. */
  perso: {
    nom: string; classe: string; rarete: string; image_menu_url: string | null;
    pv: number; attack: number;
    competence_nom: string | null; competence_desc: string | null;
  };
  doublon: boolean;
  recyclage_gagne: number | null;
  collection_id: number | null; // null si doublon (pas de nouvelle ligne)
  berrys_apres: number;
}

/** Assemble la réponse envoyée au front. Commun aux deux tirages, pour que la révélation
 *  en cascade de l'écran de tirage se comporte exactement pareil dans les deux cas. */
export function construireResultat(
  perso: Perso,
  ligne: LigneCharacterAvecId,
  config: Config,
): ResultatTiragePersiste['perso'] {
  const stats = calculerStats(perso, 1, config);
  return {
    nom: perso.nom,
    classe: perso.classe,
    rarete: perso.rarete,
    image_menu_url: ligne.image_menu ? urlPublique(`${ligne.sprite_folder}/${ligne.image_menu}`) : null,
    pv: Math.round(stats.pv),
    attack: Math.round(stats.attack),
    competence_nom: ligne.competence_nom,
    competence_desc: describeCompetence(ligne.competence_effet),
  };
}

/**
 * Le tout premier tirage du joueur (§4, étape 0 de l'onboarding) : un Commun garanti,
 * gratuit, qui devient immédiatement son perso actif.
 *
 * Pas de gestion de doublon ici : la collection est forcément vide à ce stade, c'est la
 * définition même de l'étape 0. Si elle ne l'est pas, c'est un appel en double et on
 * refuse plutôt que d'offrir un 2e perso.
 */
export async function effectuerPremierTirage(playerId: string): Promise<ResultatTiragePersiste> {
  const [lignesConfig, lignesCharacters, lignesCollection, joueur] = await Promise.all([
    supabaseSelect('config', { select: 'cle,valeur' }),
    supabaseSelect<LigneCharacterAvecId>('characters', { select: '*', jouable: 'eq.true' }),
    supabaseSelect<{ id: number }>('collection', { player_id: `eq.${playerId}`, select: 'id' }),
    supabaseSelectUn<LigneJoueur & { onboarding_etape: number }>('players', { id: `eq.${playerId}`, select: '*' }),
  ]);
  if (!joueur) throw new Error('Joueur introuvable.');
  if (lignesCollection.length > 0) {
    throw new Error('Le tirage de départ a déjà été effectué (la collection n\'est pas vide).');
  }

  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);
  const persos = lignesCharacters.map(chargerPerso);
  const persoParNom = new Map(lignesCharacters.map((l) => [l.nom, l]));

  const { perso } = tirerCommunGaranti(persos);
  const ligne = persoParNom.get(perso.nom)!;

  const nouvelleLigne = await supabaseInsert<{ id: number }>('collection', {
    player_id: playerId,
    character_id: ligne.id,
    niveau: 1,
  });

  // Perso actif ET passage à l'étape suivante dans la MÊME écriture : un joueur dont
  // l'étape avancerait sans que son perso soit posé arriverait sur un Accueil vide.
  await supabaseUpdate('players', { id: `eq.${playerId}` }, {
    perso_actif_id: nouvelleLigne.id,
    onboarding_etape: ETAPE_TUTO_ACCUEIL,
  });

  return {
    perso: construireResultat(perso, ligne, config),
    doublon: false,
    recyclage_gagne: null,
    collection_id: nouvelleLigne.id,
    berrys_apres: joueur.berrys,
  };
}

/**
 * @param gratuit  neutralise le coût du tirage sans toucher au moteur : on fait croire à
 *   `tirer()` que le joueur a pile de quoi payer, sa soustraction ramène donc au solde
 *   d'origine. Sert au coffre offert de fin d'onboarding (§4).
 */
export async function effectuerTirage(
  playerId: string,
  { gratuit = false }: { gratuit?: boolean } = {},
): Promise<ResultatTiragePersiste> {
  const [lignesConfig, lignesCharacters, lignesCollection, joueur] = await Promise.all([
    supabaseSelect('config', { select: 'cle,valeur' }),
    supabaseSelect<LigneCharacterAvecId>('characters', { select: '*', jouable: 'eq.true' }),
    supabaseSelect<{ character_id: number }>('collection', { player_id: `eq.${playerId}`, select: 'character_id' }),
    supabaseSelectUn<LigneJoueur>('players', { id: `eq.${playerId}`, select: '*' }),
  ]);
  if (!joueur) throw new Error('Joueur introuvable.');

  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);
  const persos = lignesCharacters.map(chargerPerso);
  const persoParNom = new Map(lignesCharacters.map((l) => [l.nom, l]));
  const idsPossedes = new Set(lignesCollection.map((c) => c.character_id));
  const nomsDejaPossedes = new Set(
    lignesCharacters.filter((l) => idsPossedes.has(l.id)).map((l) => l.nom),
  );

  const berrysPourLeMoteur = gratuit ? joueur.berrys + config.cout_tirage_perso : joueur.berrys;

  // tirer() plante avec un message clair si le solde est insuffisant — laissé remonter tel quel.
  const resultat = tirer({
    berrysDisponibles: berrysPourLeMoteur,
    nomsDejaPossedes,
    persos,
    config,
  });

  let collectionId: number | null = null;
  let recyclageGagne: number | null = null;
  let berrysApres = resultat.berrys_apres;

  if (resultat.doublon) {
    recyclageGagne = config.recyclage_doublon[resultat.perso.rarete]!;
    berrysApres = accepterRecyclage(resultat.berrys_apres, resultat.perso, config);
  } else {
    const ligne = persoParNom.get(resultat.perso.nom)!;
    const nouvelleLigne = await supabaseInsert<{ id: number }>('collection', {
      player_id: playerId,
      character_id: ligne.id,
      niveau: 1,
    });
    collectionId = nouvelleLigne.id;
  }

  await supabaseUpdate('players', { id: `eq.${playerId}` }, { berrys: berrysApres });

  return {
    perso: construireResultat(resultat.perso, persoParNom.get(resultat.perso.nom)!, config),
    doublon: resultat.doublon,
    recyclage_gagne: recyclageGagne,
    collection_id: collectionId,
    berrys_apres: berrysApres,
  };
}
