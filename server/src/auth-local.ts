// GRAND LINE ARENA — comptes créés sans Twitch (email + mot de passe), avec possibilité de
// lier son compte Twitch plus tard (voir /auth/twitch/lier dans server.ts).
//
// Le mot de passe n'est jamais géré par nous : Supabase Auth (supabase-auth.ts) vérifie les
// identifiants et envoie l'email de réinitialisation. `players.auth_user_id` fait le pont
// avec l'utilisateur Supabase Auth correspondant — c'est notre seule dépendance à son égard,
// tout le reste du jeu (session, Berrys, combats...) continue de tourner sur `players`.

import { supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';
import { inscrireSupabaseAuth, connecterSupabaseAuth } from './supabase-auth.ts';
import { ETAPE_PREMIER_TIRAGE, type Joueur } from './onboarding.ts';

const LONGUEUR_MIN_PSEUDO = 3;
const LONGUEUR_MAX_PSEUDO = 24;

function validerPseudo(pseudo: string): string {
  const nettoye = pseudo.trim();
  if (nettoye.length < LONGUEUR_MIN_PSEUDO || nettoye.length > LONGUEUR_MAX_PSEUDO) {
    throw new Error(`Le pseudo doit faire entre ${LONGUEUR_MIN_PSEUDO} et ${LONGUEUR_MAX_PSEUDO} caractères.`);
  }
  return nettoye;
}

export async function creerCompteLocal(pseudoBrut: string, email: string, motDePasse: string): Promise<Joueur> {
  const pseudo = validerPseudo(pseudoBrut);

  // "Confirm email" désactivé côté Supabase (décidé le 23/07/2026) : signup renvoie déjà une
  // session utilisable tout de suite, pas besoin d'attendre un clic dans la boîte mail.
  const session = await inscrireSupabaseAuth(email, motDePasse);

  try {
    const joueur = await supabaseInsert<Joueur>('players', {
      twitch_id: null,
      auth_user_id: session.user.id,
      pseudo,
      avatar_url: null,
      berrys: 0,
      onboarding_etape: ETAPE_PREMIER_TIRAGE,
    });
    return { ...joueur, nouveau_joueur: true };
  } catch (e) {
    if ((e as Error).message.includes('23505')) throw new Error('Ce pseudo est déjà pris.');
    throw e;
  }
}

export async function connecterCompteLocal(email: string, motDePasse: string): Promise<Joueur> {
  const session = await connecterSupabaseAuth(email, motDePasse);

  const joueur = await supabaseSelectUn<Joueur>(
    'players', { auth_user_id: `eq.${session.user.id}`, select: '*' },
  );
  if (!joueur) {
    // Compte Supabase Auth valide mais sans ligne `players` correspondante — ne devrait
    // jamais arriver hors bidouillage manuel, mais un message clair vaut mieux qu'un crash.
    throw new Error('Compte introuvable côté jeu — contacte le streamer.');
  }
  return { ...joueur, nouveau_joueur: false };
}

/**
 * Lie le compte Twitch de `twitchId` au joueur DÉJÀ CONNECTÉ `playerId` (compte créé sans
 * Twitch au départ). Ne crée ni ne fusionne aucun autre compte — si ce twitch_id appartient
 * déjà à quelqu'un d'autre, refuse plutôt que d'écraser silencieusement une association.
 */
export async function lierCompteTwitch(
  playerId: string, twitchId: string, avatarUrl: string | null,
): Promise<void> {
  const dejaLie = await supabaseSelectUn<{ id: string }>('players', { twitch_id: `eq.${twitchId}`, select: 'id' });
  if (dejaLie && dejaLie.id !== playerId) {
    throw new Error('Ce compte Twitch est déjà lié à un autre joueur ici.');
  }
  await supabaseUpdate('players', { id: `eq.${playerId}` }, { twitch_id: twitchId, avatar_url: avatarUrl });
}
