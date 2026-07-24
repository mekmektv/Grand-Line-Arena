// GRAND LINE ARENA — la fiche détaillée d'un joueur, ouverte depuis le classement (§8 point 7) :
// perso actuellement joué, perso favori (le plus utilisé), historique des 5 derniers combats.
//
// "Historique" ne compte QUE les combats où ce joueur est `joueur_a` : c'est lui qui a dépensé
// de l'énergie et déclenché le combat (PvP asynchrone, §4bis) — les fights où il n'est que
// `joueur_b` sont ceux où SON ADVERSAIRE a joué contre sa défense sauvegardée, pas lui.

import { supabaseSelect, supabaseSelectUn } from './supabase.ts';
import { lireClassement } from './classement.ts';
import { lireHeadToHead, type HeadToHead } from './rivaux.ts';

interface LigneJoueur { id: string; perso_actif_id: number | null; }
interface LigneCollection { character_id: number; niveau: number; }
interface LigneCharacter { id: number; nom: string; classe: string; rarete: string; }
interface LigneFight {
  date: string;
  adversaire_pseudo: string;
  vainqueur: string | null;
  joueur_a_character_id: number | null;
}

export interface FichePerso { nom: string; classe: string; rarete: string; }
export interface FichePersoActif extends FichePerso { niveau: number; }
export interface FichePersoFavori extends FichePerso { combats: number; }

export interface LigneHistorique {
  date: string;
  adversaire_pseudo: string;
  victoire: boolean;
  /** null pour un combat antérieur au 22/07/2026 (colonne pas encore renseignée à l'époque). */
  perso_utilise: string | null;
}

export interface FicheJoueur {
  /** L'identifiant du joueur affiché — nécessaire au front pour lancer un duel (§8bis). */
  id: string;
  pseudo: string;
  avatar_url: string | null;
  rang: number;
  prime: number;
  /** true quand le demandeur regarde SA propre fiche : on n'y propose alors pas de duel. */
  est_moi: boolean;
  /** §8bis : bilan des confrontations entre le demandeur et ce joueur (0-0 sur sa propre fiche). */
  confrontation: HeadToHead;
  perso_actif: FichePersoActif | null;
  /** null si le joueur n'a encore aucun combat joué (joueur_a_character_id toujours vide). */
  perso_favori: FichePersoFavori | null;
  historique: LigneHistorique[];
}

// `cibleId` est le joueur affiché ; `viewerId` celui qui consulte — distincts pour calculer la
// confrontation entre eux. Sur sa propre fiche, les deux sont égaux (est_moi).
export async function lireFicheJoueur(cibleId: string, viewerId: string): Promise<FicheJoueur | null> {
  const playerId = cibleId;
  const estMoi = viewerId === cibleId;
  const [classement, joueur, confrontation] = await Promise.all([
    lireClassement(cibleId),
    supabaseSelectUn<LigneJoueur>('players', { id: `eq.${cibleId}`, select: 'id,perso_actif_id' }),
    estMoi ? Promise.resolve<HeadToHead>({ victoires: 0, defaites: 0 }) : lireHeadToHead(viewerId, cibleId),
  ]);
  if (!joueur) return null;

  const [historiqueBrut, toutesLesParties, characters] = await Promise.all([
    supabaseSelect<LigneFight>('fights', {
      joueur_a: `eq.${playerId}`, select: 'date,adversaire_pseudo,vainqueur,joueur_a_character_id',
      order: 'date.desc', limit: '5',
    }),
    supabaseSelect<{ joueur_a_character_id: number | null }>(
      'fights', { joueur_a: `eq.${playerId}`, select: 'joueur_a_character_id' },
    ),
    supabaseSelect<LigneCharacter>('characters', { select: 'id,nom,classe,rarete' }),
  ]);

  const charParId = new Map(characters.map((c) => [c.id, c]));
  const versFiche = (id: number): FichePerso | null => {
    const c = charParId.get(id);
    return c ? { nom: c.nom, classe: c.classe, rarete: c.rarete } : null;
  };

  let persoActif: FichePersoActif | null = null;
  if (joueur.perso_actif_id !== null) {
    const coll = await supabaseSelectUn<LigneCollection>(
      'collection', { id: `eq.${joueur.perso_actif_id}`, select: 'character_id,niveau' },
    );
    const fiche = coll ? versFiche(coll.character_id) : null;
    if (fiche && coll) persoActif = { ...fiche, niveau: coll.niveau };
  }

  // Perso favori : celui qui revient le plus souvent en joueur_a_character_id.
  const comptes = new Map<number, number>();
  for (const f of toutesLesParties) {
    if (f.joueur_a_character_id === null) continue;
    comptes.set(f.joueur_a_character_id, (comptes.get(f.joueur_a_character_id) ?? 0) + 1);
  }
  let persoFavori: FichePersoFavori | null = null;
  let meilleurCompte = 0;
  for (const [id, n] of comptes) {
    if (n <= meilleurCompte) continue;
    const fiche = versFiche(id);
    if (fiche) { persoFavori = { ...fiche, combats: n }; meilleurCompte = n; }
  }

  const historique: LigneHistorique[] = historiqueBrut.map((f) => ({
    date: f.date,
    adversaire_pseudo: f.adversaire_pseudo,
    victoire: f.vainqueur === playerId,
    perso_utilise: f.joueur_a_character_id !== null ? (charParId.get(f.joueur_a_character_id)?.nom ?? null) : null,
  }));

  return {
    id: cibleId,
    pseudo: classement.moi.pseudo,
    avatar_url: classement.moi.avatar_url,
    rang: classement.moi.rang,
    prime: classement.moi.prime,
    est_moi: estMoi,
    confrontation,
    perso_actif: persoActif,
    perso_favori: persoFavori,
    historique,
  };
}
