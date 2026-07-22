// GRAND LINE ARENA — branche la logique pure de quetes.ts sur la base (§8).
//
// Comme la recharge, rien n'est précalculé ni planifié : l'état des quêtes se reconstruit à la
// demande, quand le joueur ouvre l'écran. La progression se LIT directement dans `fights` et
// `collection` — on ne tient AUCUN compteur en base. C'est volontaire : un compteur qui se
// désynchronise (double comptage, combat annulé) est le bug classique des systèmes de quêtes,
// et ici il ne peut pas exister puisqu'on recompte la vérité à chaque fois.
//
// La seule chose stockée, c'est ce qui a été RÉCLAMÉ (table `quetes_reclamees`), pour ne pas
// verser deux fois la même récompense.

import type { Config, QueteDef } from './types.ts';
import { chargerConfig } from './config.ts';
import { cleJour, cleSemaine } from './recharge.ts';
import {
  evaluerQuete, periodeQuete, queteDeLaSemaine, queteDuJour, quetesCollection,
  type MesuresQuetes,
} from './quetes.ts';
import { supabaseSelect, supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';

interface LigneFight {
  vainqueur: string | null;
  date: string;
}

interface LigneCharacterMini {
  id: number;
  classe: string;
  rarete: string;
  jouable: boolean;
}

/** Ce que le front affiche pour une quête. `est_bot`-style : aucun détail interne ne fuit. */
export interface QueteAffichee {
  cle: string;
  categorie: QueteDef['categorie'];
  titre: string;
  recompense: number;
  progression: number;
  objectif: number;
  accomplie: boolean;
  /** Déjà réclamée pour la période courante (aujourd'hui / cette semaine / à vie). */
  reclamee: boolean;
  /** Accomplie ET pas encore réclamée → le bouton "Réclamer" s'affiche. */
  reclamable: boolean;
}

export interface EtatQuetes {
  jour: QueteAffichee | null;
  semaine: QueteAffichee | null;
  collection: QueteAffichee[];
}

/** Fenêtre de combats à charger : 8 jours couvrent la semaine de jeu en cours quelle que soit
 *  l'heure de reset. Un joueur fait ~10 combats/jour, donc ça reste une poignée de lignes. */
const FENETRE_JOURS = 8;

/** Reconstruit toutes les mesures nécessaires à l'évaluation des quêtes, en base. */
async function construireMesures(
  playerId: string, config: Config, maintenant: Date,
): Promise<MesuresQuetes> {
  const depuis = new Date(maintenant.getTime() - FENETRE_JOURS * 86_400_000).toISOString();

  const [fights, collection, characters] = await Promise.all([
    supabaseSelect<LigneFight>('fights', {
      joueur_a: `eq.${playerId}`, date: `gte.${depuis}`, select: 'vainqueur,date',
    }),
    supabaseSelect<{ character_id: number }>('collection', {
      player_id: `eq.${playerId}`, select: 'character_id',
    }),
    supabaseSelect<LigneCharacterMini>('characters', { select: 'id,classe,rarete,jouable' }),
  ]);

  const jourCourant = cleJour(maintenant, config);
  const semaineCourante = cleSemaine(maintenant, config);

  let cjJour = 0; let cgJour = 0; let cjSem = 0; let cgSem = 0;
  for (const f of fights) {
    const d = new Date(f.date);
    const memeJour = cleJour(d, config) === jourCourant;
    const memeSemaine = cleSemaine(d, config) === semaineCourante;
    const gagne = f.vainqueur === playerId;
    if (memeJour) { cjJour += 1; if (gagne) cgJour += 1; }
    if (memeSemaine) { cjSem += 1; if (gagne) cgSem += 1; }
  }

  // Composition de la collection : possédés distincts / total existant, par classe et par rareté.
  // Seuls les persos `jouable` comptent — les formes transformées ne sont ni tirables ni
  // collectionnables (§ modèle de données), les inclure gonflerait faussement les totaux.
  const jouables = characters.filter((c) => c.jouable);
  const parId = new Map(jouables.map((c) => [c.id, c]));
  const possedes = new Set(collection.map((c) => c.character_id));

  const collection_classe: Record<string, { possede: number; total: number }> = {};
  const collection_rarete: Record<string, { possede: number; total: number }> = {};
  const bucket = (rec: Record<string, { possede: number; total: number }>, cle: string, possede: boolean) => {
    rec[cle] ??= { possede: 0, total: 0 };
    rec[cle].total += 1;
    if (possede) rec[cle].possede += 1;
  };
  for (const c of jouables) {
    const detenu = possedes.has(c.id);
    bucket(collection_classe, c.classe, detenu);
    bucket(collection_rarete, c.rarete, detenu);
  }

  return {
    combats_joues_jour: cjJour,
    combats_gagnes_jour: cgJour,
    coffres_ouverts_jour: 0,       // §4ter : l'équipement n'existe pas encore.
    combats_joues_semaine: cjSem,
    combats_gagnes_semaine: cgSem,
    coffres_ouverts_semaine: 0,
    collection_classe,
    collection_rarete,
  };
}

/** Transforme une définition + son évaluation + son état de réclamation en objet d'affichage. */
function afficher(def: QueteDef, mesures: MesuresQuetes, reclamee: boolean): QueteAffichee {
  const evaluation = evaluerQuete(def, mesures);
  return {
    cle: def.cle,
    categorie: def.categorie,
    titre: def.titre,
    recompense: def.recompense,
    progression: evaluation.progression,
    objectif: evaluation.objectif,
    accomplie: evaluation.accomplie,
    reclamee,
    reclamable: evaluation.accomplie && !reclamee,
  };
}

/** L'état complet des quêtes pour l'écran dédié : quête du jour, de la semaine, et la liste
 *  des succès de collection. */
export async function lireQuetes(playerId: string): Promise<EtatQuetes> {
  const maintenant = new Date();
  const lignesConfig = await supabaseSelect('config', { select: 'cle,valeur' });
  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);

  const mesures = await construireMesures(playerId, config, maintenant);

  const duJour = queteDuJour(config, maintenant);
  const deLaSemaine = queteDeLaSemaine(config, maintenant);
  const collection = quetesCollection(config);

  // On charge en une fois les réclamations concernées, puis on teste en mémoire.
  const clesConcernees = [duJour, deLaSemaine, ...collection].filter((q): q is QueteDef => q !== null);
  const reclamations = clesConcernees.length === 0 ? [] : await supabaseSelect<{ cle_quete: string; periode: string }>(
    'quetes_reclamees',
    { player_id: `eq.${playerId}`, cle_quete: `in.(${clesConcernees.map((q) => `"${q.cle}"`).join(',')})`, select: 'cle_quete,periode' },
  );
  const estReclamee = (def: QueteDef): boolean => {
    const periode = periodeQuete(def, maintenant, config);
    return reclamations.some((r) => r.cle_quete === def.cle && r.periode === periode);
  };

  return {
    jour: duJour ? afficher(duJour, mesures, estReclamee(duJour)) : null,
    semaine: deLaSemaine ? afficher(deLaSemaine, mesures, estReclamee(deLaSemaine)) : null,
    collection: collection.map((def) => afficher(def, mesures, estReclamee(def))),
  };
}

export type ResultatReclamation =
  | { ok: true; recompense: number; berrys: number }
  | { ok: false; erreur: string };

/**
 * Réclame la récompense d'une quête. Revérifie TOUT côté serveur (accomplie, pas déjà réclamée,
 * et — pour le jour/la semaine — qu'il s'agit bien de la quête actuellement active) : le front
 * n'est jamais cru sur parole, un joueur qui forgerait la requête ne peut rien gagner d'indu.
 */
export async function reclamerQuete(playerId: string, cle: string): Promise<ResultatReclamation> {
  const maintenant = new Date();
  const [joueur, lignesConfig] = await Promise.all([
    supabaseSelectUn<{ id: string; berrys: number }>('players', { id: `eq.${playerId}`, select: 'id,berrys' }),
    supabaseSelect('config', { select: 'cle,valeur' }),
  ]);
  if (!joueur) return { ok: false, erreur: 'Joueur introuvable.' };
  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);

  const def = config.quetes_catalogue.find((q) => q.cle === cle && q.actif);
  if (!def) return { ok: false, erreur: 'Quête inconnue ou inactive.' };

  // Une quête du jour/semaine n'est réclamable que si c'est bien celle du moment : sinon un
  // joueur pourrait réclamer une quête d'un autre jour dont il remplit encore les conditions.
  if (def.categorie === 'jour' && queteDuJour(config, maintenant)?.cle !== cle) {
    return { ok: false, erreur: "Ce n'est pas la quête du jour en cours." };
  }
  if (def.categorie === 'semaine' && queteDeLaSemaine(config, maintenant)?.cle !== cle) {
    return { ok: false, erreur: "Ce n'est pas la quête de la semaine en cours." };
  }

  const mesures = await construireMesures(playerId, config, maintenant);
  if (!evaluerQuete(def, mesures).accomplie) {
    return { ok: false, erreur: 'Quête non accomplie.' };
  }

  const periode = periodeQuete(def, maintenant, config);
  const dejaFait = await supabaseSelectUn<{ cle_quete: string }>('quetes_reclamees', {
    player_id: `eq.${playerId}`, cle_quete: `eq.${cle}`, periode: `eq.${periode}`, select: 'cle_quete',
  });
  if (dejaFait) return { ok: false, erreur: 'Récompense déjà réclamée.' };

  // Trace la réclamation AVANT de créditer : la clé primaire (player, cle, periode) fait office
  // de verrou anti-double — si deux requêtes arrivent en même temps, la seconde échoue ici plutôt
  // que de verser une deuxième fois.
  try {
    await supabaseInsert('quetes_reclamees', { player_id: playerId, cle_quete: cle, periode });
  } catch {
    return { ok: false, erreur: 'Récompense déjà réclamée.' };
  }

  const berrys = joueur.berrys + def.recompense;
  await supabaseUpdate('players', { id: `eq.${playerId}` }, { berrys });
  return { ok: true, recompense: def.recompense, berrys };
}
