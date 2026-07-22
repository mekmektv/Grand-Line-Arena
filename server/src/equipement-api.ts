// GRAND LINE ARENA — branche la logique pure de equipement.ts sur la vraie base. §4ter.
// equipement.ts lui-même ne touche jamais Supabase et ne change pas quand ce fichier change.
//
// LES TROIS RÈGLES DE GAMEPLAY QUE CE FICHIER FAIT RESPECTER (décidées le 21/07/2026) :
//
//  1. L'équipement est PAR PERSO. `equipment.collection_id` NULL = l'objet dort dans
//     l'inventaire global du joueur ; renseigné = il est soudé à ce perso.
//
//  2. Un objet équipé ne revient JAMAIS à l'inventaire. Pour libérer un slot, il faut
//     RECYCLER ce qu'il contient. C'est pour ça qu'`equiper()` refuse un slot occupé au lieu
//     de déplacer l'ancien objet : le joueur doit passer explicitement par `recycler()`, et
//     donc voir ce qu'il détruit. L'index unique `idx_equipment_slot_unique` en base tient
//     la même règle si jamais un bug d'appel passait à travers.
//
//  3. Le SACRIFICE détruit N objets de l'INVENTAIRE (jamais des objets portés) pour ouvrir un
//     coffre garanti dans la rareté au-dessus. Les objets en trop sont la monnaie : il n'y a
//     aucune ressource intermédiaire à stocker.

import { chargerConfig } from './index.ts';
import {
  ouvrirCoffre, recyclerObjet, sacrificesPossibles, bonusEquipement, validerSacrifice,
} from './equipement.ts';
import type { SacrificePossible } from './equipement.ts';
import type { Config, ObjetEquipement, RareteEquipement } from './types.ts';
import {
  supabaseSelect, supabaseSelectUn, supabaseInsert, supabaseUpdate, supabaseDelete,
} from './supabase.ts';

interface LigneEquipement {
  id: number;
  player_id: string;
  collection_id: number | null;
  cle: string;
  type: string;
}

/** Un objet réellement possédé : sa définition (catalogue) + où il se trouve. */
export interface ObjetPossede extends ObjetEquipement {
  /** `equipment.id` en base — c'est cet identifiant que le front renvoie pour agir dessus. */
  id: number;
  /** null = dans l'inventaire · sinon l'entrée de collection sur laquelle il est soudé. */
  collection_id: number | null;
}

/** Ce que le front envoie à `POST /coffre`. */
export type PaiementRequete =
  | { mode: 'berrys' }
  | { mode: 'sacrifice'; ids: number[] };

// ---------------------------------------------------------------------------
// Lectures de base, réutilisées par tout le fichier
// ---------------------------------------------------------------------------

async function chargerConfigJeu(): Promise<Config> {
  const lignes = await supabaseSelect('config', { select: 'cle,valeur' });
  return chargerConfig(lignes as { cle: string; valeur: unknown }[]);
}

/**
 * Retrouve la définition d'un objet à partir de la clé stockée en base.
 * Une clé inconnue = le catalogue a changé sans qu'on migre les objets déjà distribués :
 * on plante clairement plutôt que de servir un objet fantôme à 0 PV.
 */
function definition(cle: string, config: Config): ObjetEquipement {
  const objet = config.equipement_catalogue.find((o) => o.cle === cle);
  if (!objet) {
    throw new Error(
      `Équipement : la clé "${cle}" est en base mais absente de config.equipement_catalogue. ` +
      `Ne retire jamais un objet du catalogue tant que des joueurs le possèdent.`,
    );
  }
  return objet;
}

function versPossede(l: LigneEquipement, config: Config): ObjetPossede {
  return { ...definition(l.cle, config), id: l.id, collection_id: l.collection_id };
}

async function lireObjets(playerId: string, config: Config): Promise<ObjetPossede[]> {
  const lignes = await supabaseSelect<LigneEquipement>('equipment', {
    player_id: `eq.${playerId}`, select: '*', order: 'id.asc',
  });
  return lignes.map((l) => versPossede(l, config));
}

/**
 * Les objets équipés sur un perso donné. C'est ce que le combat consomme (§4ter) —
 * voir `Engage.equipement` dans types.ts.
 */
export async function equipementDuPerso(
  collectionId: number, config: Config,
): Promise<ObjetEquipement[]> {
  const lignes = await supabaseSelect<LigneEquipement>('equipment', {
    collection_id: `eq.${collectionId}`, select: '*',
  });
  return lignes.map((l) => definition(l.cle, config));
}

// ---------------------------------------------------------------------------
// GET /equipement — tout ce dont l'écran a besoin, en une requête
// ---------------------------------------------------------------------------

export interface EtatEquipement {
  inventaire: ObjetPossede[];
  /** Les objets soudés à un perso, groupés par `collection_id`. */
  equipes: Record<number, ObjetPossede[]>;
  /** Les sacrifices ouverts, calculés sur le seul inventaire. */
  sacrifices: SacrificePossible[];
  cout_coffre: number;
  berrys: number;
  /** Le catalogue complet : l'écran peut afficher ce qui existe, y compris non possédé. */
  catalogue: ObjetEquipement[];
}

function repartir(objets: ObjetPossede[]) {
  const equipes: Record<number, ObjetPossede[]> = {};
  const inventaire: ObjetPossede[] = [];
  for (const o of objets) {
    if (o.collection_id === null) inventaire.push(o);
    else (equipes[o.collection_id] ??= []).push(o);
  }
  return { equipes, inventaire };
}

export async function lireEquipement(playerId: string): Promise<EtatEquipement> {
  const config = await chargerConfigJeu();
  const [objets, joueur] = await Promise.all([
    lireObjets(playerId, config),
    supabaseSelectUn<{ berrys: number }>('players', { id: `eq.${playerId}`, select: 'berrys' }),
  ]);
  if (!joueur) throw new Error('Joueur introuvable.');

  const { equipes, inventaire } = repartir(objets);

  return {
    inventaire,
    equipes,
    sacrifices: sacrificesPossibles(inventaire, config),
    cout_coffre: config.cout_coffre_equipement,
    berrys: joueur.berrys,
    catalogue: config.equipement_catalogue,
  };
}

// ---------------------------------------------------------------------------
// POST /coffre — ouvrir un coffre
// ---------------------------------------------------------------------------

export interface ResultatCoffrePersiste {
  objet: ObjetPossede;
  berrys_apres: number;
  rarete_garantie: RareteEquipement;
  /** Les objets détruits par le sacrifice, pour que l'écran puisse les annoncer. */
  sacrifies: ObjetEquipement[];
  sacrifices: SacrificePossible[];
  /** Ce que le perso visé porte déjà dans ce slot, pour l'écran de comparaison.
   *  null si le slot est libre — dans ce cas équiper ne détruit rien. */
  actuel: ObjetPossede | null;
}

/**
 * Ouvre un coffre, payé en Berrys ou par sacrifice, et range l'objet dans l'INVENTAIRE.
 * Rien n'est équipé automatiquement : le joueur compare puis décide (décision du 21/07/2026).
 *
 * @param cibleCollectionId le perso auquel comparer le résultat. Le perso actif par défaut,
 *   mais l'inventaire envoie celui que le joueur est en train de regarder.
 */
export async function ouvrirCoffreJoueur(
  playerId: string, paiement: PaiementRequete, cibleCollectionId?: number | null,
): Promise<ResultatCoffrePersiste> {
  const config = await chargerConfigJeu();
  const joueur = await supabaseSelectUn<{ berrys: number; perso_actif_id: number | null }>('players', {
    id: `eq.${playerId}`, select: 'berrys,perso_actif_id',
  });
  if (!joueur) throw new Error('Joueur introuvable.');

  // --- Le sacrifice : on VALIDE tout avant de détruire quoi que ce soit ---
  let aDetruire: ObjetPossede[] = [];
  if (paiement.mode === 'sacrifice') {
    const ids = [...new Set(paiement.ids)];
    if (ids.length !== paiement.ids.length) {
      throw new Error('Le même objet ne peut pas être sacrifié deux fois.');
    }
    // Filtré sur le joueur ET sur l'inventaire : un objet porté par un perso n'est jamais
    // sacrifiable directement, il faut d'abord le recycler (§4ter).
    const lignes = await supabaseSelect<LigneEquipement>('equipment', {
      id: `in.(${ids.join(',')})`, player_id: `eq.${playerId}`, collection_id: 'is.null', select: '*',
    });
    if (lignes.length !== ids.length) {
      throw new Error('Un des objets sélectionnés n\'est plus dans ton inventaire.');
    }
    aDetruire = lignes.map((l) => versPossede(l, config));
    validerSacrifice(aDetruire, config);   // plante avec un message clair si le lot est invalide
  }

  const resultat = ouvrirCoffre({
    berrysDisponibles: joueur.berrys,
    paiement: paiement.mode === 'berrys' ? { mode: 'berrys' } : { mode: 'sacrifice', objets: aDetruire },
    config,
  });

  // On débite AVANT de créditer l'objet : si l'insertion échoue ensuite, le joueur a perdu
  // sa mise mais n'a pas d'objet — l'inverse (objet gratuit) serait exploitable en boucle.
  if (paiement.mode === 'berrys') {
    await supabaseUpdate('players', { id: `eq.${playerId}` }, { berrys: resultat.berrys_apres });
  } else {
    // La suppression fait foi et refiltre sur le joueur : si elle ne retire pas exactement le
    // compte attendu (double requête simultanée sur les mêmes objets), on s'arrête avant de
    // livrer le coffre plutôt que de l'offrir.
    const supprimees = await supabaseDelete<LigneEquipement>('equipment', {
      id: `in.(${aDetruire.map((o) => o.id).join(',')})`,
      player_id: `eq.${playerId}`,
      collection_id: 'is.null',
    });
    if (supprimees.length !== aDetruire.length) {
      throw new Error('Les objets à sacrifier ont changé entre-temps — recommence la sélection.');
    }
  }

  const ligne = await supabaseInsert<LigneEquipement>('equipment', {
    player_id: playerId,
    collection_id: null,          // toujours l'inventaire : le joueur choisira
    cle: resultat.objet.cle,
    type: resultat.objet.type,
  });

  // Ce que porte le perso visé dans le même slot, pour l'écran de comparaison.
  const cible = cibleCollectionId ?? joueur.perso_actif_id;
  let actuel: ObjetPossede | null = null;
  if (cible !== null && cible !== undefined) {
    const porte = await supabaseSelect<LigneEquipement>('equipment', {
      collection_id: `eq.${cible}`, type: `eq.${resultat.objet.type}`, select: '*',
    });
    actuel = porte[0] ? versPossede(porte[0], config) : null;
  }

  const { inventaire } = repartir(await lireObjets(playerId, config));

  return {
    objet: versPossede(ligne, config),
    berrys_apres: resultat.berrys_apres,
    rarete_garantie: resultat.rarete_garantie,
    sacrifies: aDetruire,
    sacrifices: sacrificesPossibles(inventaire, config),
    actuel,
  };
}

// ---------------------------------------------------------------------------
// POST /equipement/equiper
// ---------------------------------------------------------------------------

export interface ResultatEquiper {
  objet: ObjetPossede;
  /** Les objets portés par le perso après l'opération, et leur bonus total. */
  equipes: ObjetPossede[];
  bonus: { hp: number; attack: number };
}

/**
 * Soude un objet de l'inventaire sur un perso de la collection.
 *
 * Refuse si le slot est déjà pris : le joueur doit d'abord recycler l'objet en place (§4ter).
 * L'erreur nomme l'objet à détruire pour que le front puisse afficher la confirmation.
 */
export async function equiperObjet(
  playerId: string, equipementId: number, collectionId: number,
): Promise<ResultatEquiper> {
  const config = await chargerConfigJeu();

  // On vérifie l'appartenance des DEUX côtés : sans ça, un joueur pourrait équiper l'objet
  // d'un autre, ou poser le sien sur le perso d'un autre.
  const [ligne, perso] = await Promise.all([
    supabaseSelectUn<LigneEquipement>('equipment', {
      id: `eq.${equipementId}`, player_id: `eq.${playerId}`, select: '*',
    }),
    supabaseSelectUn<{ id: number }>('collection', {
      id: `eq.${collectionId}`, player_id: `eq.${playerId}`, select: 'id',
    }),
  ]);
  if (!ligne) throw new Error('Cet équipement ne vous appartient pas ou n\'existe plus.');
  if (!perso) throw new Error('Ce perso ne vous appartient pas.');
  if (ligne.collection_id !== null) {
    throw new Error('Cet équipement est déjà porté par un perso : il ne peut plus être déplacé, seulement recyclé (§4ter).');
  }

  const objet = definition(ligne.cle, config);
  const occupant = await supabaseSelect<LigneEquipement>('equipment', {
    collection_id: `eq.${collectionId}`, type: `eq.${objet.type}`, select: '*',
  });
  if (occupant[0]) {
    const actuel = definition(occupant[0].cle, config);
    throw new Error(
      `Ce perso porte déjà « ${actuel.nom} ». Recycle-le d'abord (+${config.recyclage_equipement[actuel.rarete]} Berrys) ` +
      `— un équipement porté ne peut pas être retiré autrement (§4ter).`,
    );
  }

  await supabaseUpdate('equipment', { id: `eq.${equipementId}` }, { collection_id: collectionId });

  const portes = (await supabaseSelect<LigneEquipement>('equipment', {
    collection_id: `eq.${collectionId}`, select: '*',
  })).map((l) => versPossede(l, config));

  return { objet: { ...objet, id: ligne.id, collection_id: collectionId }, equipes: portes, bonus: bonusEquipement(portes) };
}

// ---------------------------------------------------------------------------
// POST /equipement/recycler
// ---------------------------------------------------------------------------

export interface ResultatRecyclagePersiste {
  berrys_gagnes: number;
  berrys_apres: number;
  /** true si l'objet détruit était porté par un perso — le slot est donc libéré. */
  etait_equipe: boolean;
  sacrifices: SacrificePossible[];
}

/**
 * Détruit un objet contre des Berrys, qu'il soit dans l'inventaire ou porté par un perso.
 * C'est la seule façon de libérer un slot (§4ter).
 */
export async function recyclerEquipement(
  playerId: string, equipementId: number,
): Promise<ResultatRecyclagePersiste> {
  const config = await chargerConfigJeu();

  const joueur = await supabaseSelectUn<{ berrys: number }>('players', {
    id: `eq.${playerId}`, select: 'berrys',
  });
  if (!joueur) throw new Error('Joueur introuvable.');

  // La SUPPRESSION fait foi, et elle est filtrée sur le joueur. Si elle ne retire aucune
  // ligne (objet déjà recyclé, ou appartenant à quelqu'un d'autre), on ne crédite rien :
  // c'est ce qui empêche deux requêtes simultanées de payer deux fois le même objet.
  const supprimees = await supabaseDelete<LigneEquipement>('equipment', {
    id: `eq.${equipementId}`, player_id: `eq.${playerId}`,
  });
  if (supprimees.length === 0) {
    throw new Error('Cet équipement n\'existe plus ou ne vous appartient pas.');
  }

  const objet = definition(supprimees[0].cle, config);
  const resultat = recyclerObjet(joueur.berrys, objet, config);

  await supabaseUpdate('players', { id: `eq.${playerId}` }, { berrys: resultat.berrys_apres });

  const { inventaire } = repartir(await lireObjets(playerId, config));

  return {
    berrys_gagnes: resultat.berrys_gagnes,
    berrys_apres: resultat.berrys_apres,
    etait_equipe: supprimees[0].collection_id !== null,
    sacrifices: sacrificesPossibles(inventaire, config),
  };
}
