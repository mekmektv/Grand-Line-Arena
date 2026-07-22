// GRAND LINE ARENA — le classement (§8 point 7 : "top viewers + ta position mise en avant").
//
// Classé par PRIME depuis le 22/07/2026 (voir prime.ts). Avant, le tri se faisait sur les
// Berrys — donc sur la RÉSERVE : un joueur qui dépensait tout en tirages dégringolait, et
// thésauriser était le meilleur moyen de monter. On classait la richesse, pas les exploits.

import { supabaseSelect } from './supabase.ts';

interface LigneJoueur { id: string; pseudo: string; prime: number; avatar_url: string | null; }

export interface LigneClassement {
  /** Sert à demander la fiche détaillée de ce joueur (GET /fiche-joueur?id=...) — pas une
   *  donnée sensible, juste l'identifiant de la ligne `players`. */
  id: string;
  rang: number; pseudo: string; prime: number; moi: boolean;
  /** Photo de profil Twitch. null pour les comptes de dev, qui n'en ont pas. */
  avatar_url: string | null;
}

export interface Classement { top: LigneClassement[]; moi: LigneClassement; }

export async function lireClassement(playerId: string): Promise<Classement> {
  // Départage à pseudo égal par l'id : sans second critère, PostgREST peut renvoyer deux
  // joueurs à égalité de prime dans un ordre différent d'un appel à l'autre, et le classement
  // semblerait bouger tout seul.
  const joueurs = await supabaseSelect<LigneJoueur>(
    'players', { select: 'id,pseudo,prime,avatar_url', order: 'prime.desc,id.asc' },
  );

  const classement: LigneClassement[] = joueurs.map((j, i) => ({
    id: j.id, rang: i + 1, pseudo: j.pseudo, prime: j.prime, avatar_url: j.avatar_url, moi: j.id === playerId,
  }));

  const moi = classement.find((l) => l.moi)
    ?? { id: playerId, rang: 0, pseudo: '?', prime: 0, avatar_url: null, moi: true };
  return { top: classement.slice(0, 20), moi };
}
