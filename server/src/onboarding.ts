// GRAND LINE ARENA — connexion Twitch : trouve ou crée le joueur.
// GAME_DESIGN.md §4 "Nouveaux joueurs" : 1 perso commun OFFERT + 1 tirage gratuit immédiat.
//
// ⚠️ Ce fichier ne DONNE plus rien à la création du compte (changement du 21/07/2026).
// Avant, il tirait les deux persos en silence : le joueur découvrait sa collection déjà
// remplie sans avoir rien fait, et la roulette — le meilleur moment du jeu — lui passait
// sous le nez. Les deux tirages du §4 existent toujours, mais ils sont maintenant JOUÉS,
// répartis dans le parcours (voir `players.onboarding_etape`) :
//   étape 0 → le roll de départ, forcé Commun  → effectuerPremierTirage()  (tirage-api.ts)
//   étape 2 → le coffre offert d'arrivée       → effectuerTirage(gratuit)  (tirage-api.ts)
//
// Logique de branchement base, comme collection.ts : ce fichier ne parle pas HTTP.
// C'est server.ts qui l'appelle depuis la route /auth/twitch/callback.

import { supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';

/** Les étapes de l'onboarding, dans l'ordre. Voir supabase/A_APPLIQUER_onboarding.sql. */
export const ETAPE_PREMIER_TIRAGE = 0;
export const ETAPE_TUTO_ACCUEIL = 1;
export const ETAPE_COFFRE_OFFERT = 2;
export const ETAPE_TERMINE = 3;

export interface Joueur {
  id: string;
  // null : compte créé sans Twitch (pseudo + mot de passe), pas encore lié — voir auth-local.ts.
  twitch_id: string | null;
  pseudo: string;
  berrys: number;
  perso_actif_id: number | null;
  avatar_url: string | null;
  onboarding_etape: number;
  nouveau_joueur: boolean;
}

/**
 * Trouve le joueur par twitch_id, ou le crée s'il n'existe pas.
 *
 * Ne redonne JAMAIS rien à un joueur existant : une reconnexion ne doit pas être rentable.
 * Seuls l'avatar et le pseudo sont rafraîchis — ce sont des données d'affichage, pas du
 * gameplay, et le joueur qui les change sur Twitch s'attend à les voir changer ici.
 */
export async function connecterOuCreerJoueur(
  twitchId: string,
  pseudo: string,
  avatarUrl: string | null = null,
): Promise<Joueur> {
  const existant = await supabaseSelectUn<Joueur>('players', { twitch_id: `eq.${twitchId}`, select: '*' });

  if (existant) {
    // On ne réécrit que si quelque chose a bougé : une connexion ne doit pas coûter une
    // écriture en base pour rien.
    const aChange = existant.avatar_url !== avatarUrl || existant.pseudo !== pseudo;
    if (!aChange) return { ...existant, nouveau_joueur: false };

    const rafraichi = await supabaseUpdate<Joueur>(
      'players', { id: `eq.${existant.id}` }, { avatar_url: avatarUrl, pseudo },
    );
    return { ...rafraichi, nouveau_joueur: false };
  }

  // Compte NEUF : rigoureusement vide. Pas de perso, pas de Berrys, pas de perso actif.
  // Le joueur est envoyé sur l'écran du premier tirage (étape 0) avant même de voir l'Accueil.
  const joueur = await supabaseInsert<Joueur>('players', {
    twitch_id: twitchId,
    pseudo,
    avatar_url: avatarUrl,
    berrys: 0,
    onboarding_etape: ETAPE_PREMIER_TIRAGE,
  });

  return { ...joueur, nouveau_joueur: true };
}

/**
 * Fait avancer l'onboarding, sans jamais le faire reculer.
 *
 * Le `Math.max` n'est pas de la paranoïa : le front appelle cette route à la fin d'une
 * animation, donc un double-clic ou un rechargement de page au mauvais moment peut très
 * bien rejouer l'appel d'une étape déjà franchie.
 */
export async function avancerOnboarding(playerId: string, etape: number): Promise<number> {
  const joueur = await supabaseSelectUn<{ onboarding_etape: number }>(
    'players', { id: `eq.${playerId}`, select: 'onboarding_etape' },
  );
  if (!joueur) throw new Error('Joueur introuvable.');

  const nouvelle = Math.max(joueur.onboarding_etape, etape);
  if (nouvelle === joueur.onboarding_etape) return joueur.onboarding_etape;

  await supabaseUpdate('players', { id: `eq.${playerId}` }, { onboarding_etape: nouvelle });
  return nouvelle;
}
