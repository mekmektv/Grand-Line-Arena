// GRAND LINE ARENA — système de rivaux (§8bis).
//
// Deux briques, volontairement séparées de la logique de combat :
//   - le HEAD-TO-HEAD : le bilan des confrontations entre deux joueurs ("3 victoires – 1
//     défaite"), lu en direct dans `fights` comme tout le reste (aucun compteur en base) ;
//   - les RIVAUX : qui, au classement, sont désignés comme cibles à dépasser.
//
// Aucune récompense n'est attachée au fait de battre son rival : c'est un objectif d'affichage,
// pas une mécanique d'économie — cohérent avec le duel amical qui ne rapporte rien non plus.

import { supabaseSelect } from './supabase.ts';

export interface HeadToHead {
  /** Combats gagnés par le point de vue (`viewerId`), duels amicaux ET vrais combats confondus. */
  victoires: number;
  defaites: number;
}

/**
 * Le bilan des confrontations entre deux joueurs, du point de vue de `viewerId`.
 *
 * "Tout compris" (choix produit) : les duels amicaux comptent au même titre que les combats de
 * matchmaking. On additionne les deux sens de la rencontre — un combat où `viewerId` est
 * `joueur_a` ET un où il n'est que `joueur_b` (son adversaire l'avait défié) — sinon la moitié
 * de l'historique manquerait selon qui a lancé le combat.
 */
export async function lireHeadToHead(viewerId: string, cibleId: string): Promise<HeadToHead> {
  const lignes = await supabaseSelect<{ vainqueur: string | null }>('fights', {
    or: `(and(joueur_a.eq.${viewerId},joueur_b.eq.${cibleId}),and(joueur_a.eq.${cibleId},joueur_b.eq.${viewerId}))`,
    select: 'vainqueur',
  });

  let victoires = 0;
  let defaites = 0;
  for (const l of lignes) {
    if (l.vainqueur === viewerId) victoires++;
    else if (l.vainqueur === cibleId) defaites++;
    // vainqueur null (aucun n'est marqué gagnant) : ignoré, ni victoire ni défaite.
  }
  return { victoires, defaites };
}

/**
 * Les identifiants des rivaux d'un joueur, à partir du classement trié (index 0 = 1er).
 *
 * Règle : le joueur juste au-dessus et celui juste en dessous. Aux extrémités, où un seul voisin
 * existe, on complète par l'autre côté pour toujours proposer deux rivaux tant qu'il y a assez de
 * monde — 1er → 2e et 3e ; dernier → les deux au-dessus. À deux joueurs, il n'y en a qu'un ; seul,
 * aucun. `moiIndex < 0` (joueur hors classement) ne renvoie rien.
 */
/**
 * Les ids des rivaux d'un joueur, lus depuis la base. Le tri DOIT être identique à celui du
 * classement (`prime.desc,id.asc`) pour que les voisins soient exactement les mêmes qu'à
 * l'affichage — sinon un joueur serait « rival » au combat mais pas au classement, ou l'inverse.
 */
export async function lireIdsRivaux(playerId: string): Promise<Set<string>> {
  const joueurs = await supabaseSelect<{ id: string }>('players', { select: 'id', order: 'prime.desc,id.asc' });
  const moiIndex = joueurs.findIndex((j) => j.id === playerId);
  return idsRivaux(joueurs.map((j) => j.id), moiIndex);
}

export function idsRivaux(idsClasses: string[], moiIndex: number): Set<string> {
  const n = idsClasses.length;
  const rivaux = new Set<string>();
  if (moiIndex < 0 || n <= 1) return rivaux;

  // Les voisins immédiats d'abord (au-dessus, puis en dessous), puis on s'éloigne pour combler.
  const positions: number[] = [];
  const ajouter = (i: number) => {
    if (i >= 0 && i < n && i !== moiIndex && !positions.includes(i)) positions.push(i);
  };
  ajouter(moiIndex - 1);
  ajouter(moiIndex + 1);
  for (let ecart = 2; positions.length < 2 && ecart < n; ecart++) {
    ajouter(moiIndex - ecart);
    if (positions.length < 2) ajouter(moiIndex + ecart);
  }

  for (const i of positions.slice(0, 2)) rivaux.add(idsClasses[i]);
  return rivaux;
}
