// GRAND LINE ARENA — comptes créés sans Twitch (pseudo + mot de passe), avec possibilité de
// lier son compte Twitch plus tard (voir /auth/twitch/lier dans server.ts).
//
// Le mot de passe n'est JAMAIS stocké en clair : scryptSync (natif Node, zéro dépendance,
// même philosophie que le reste du projet) avec un sel aléatoire par compte, stocké
// "sel:hachage" dans players.mot_de_passe_hash.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';
import { ETAPE_PREMIER_TIRAGE, type Joueur } from './onboarding.ts';

const LONGUEUR_MIN_MDP = 8;
const LONGUEUR_MIN_PSEUDO = 3;
const LONGUEUR_MAX_PSEUDO = 24;

function hacherMotDePasse(motDePasse: string): string {
  const sel = randomBytes(16).toString('hex');
  const hash = scryptSync(motDePasse, sel, 64).toString('hex');
  return `${sel}:${hash}`;
}

function verifierMotDePasse(motDePasse: string, stocke: string): boolean {
  const [sel, hashAttendu] = stocke.split(':');
  if (!sel || !hashAttendu) return false;
  const calcule = scryptSync(motDePasse, sel, 64);
  const attendu = Buffer.from(hashAttendu, 'hex');
  // Comparaison à temps constant : sinon la durée de la réponse fuite un indice sur combien
  // de caractères du hachage sont déjà corrects (attaque par canal auxiliaire).
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
}

function validerPseudo(pseudo: string): string {
  const nettoye = pseudo.trim();
  if (nettoye.length < LONGUEUR_MIN_PSEUDO || nettoye.length > LONGUEUR_MAX_PSEUDO) {
    throw new Error(`Le pseudo doit faire entre ${LONGUEUR_MIN_PSEUDO} et ${LONGUEUR_MAX_PSEUDO} caractères.`);
  }
  return nettoye;
}

/** Crée un compte SANS Twitch. Repasse par le même onboarding (§4) qu'un compte Twitch —
 *  connecterOuCreerJoueur n'y touche pas non plus, la seule différence est l'absence de
 *  twitch_id au départ. */
export async function creerCompteLocal(pseudoBrut: string, motDePasse: string): Promise<Joueur> {
  const pseudo = validerPseudo(pseudoBrut);
  if (motDePasse.length < LONGUEUR_MIN_MDP) {
    throw new Error(`Le mot de passe doit faire au moins ${LONGUEUR_MIN_MDP} caractères.`);
  }

  try {
    const joueur = await supabaseInsert<Joueur>('players', {
      twitch_id: null,
      pseudo,
      avatar_url: null,
      berrys: 0,
      onboarding_etape: ETAPE_PREMIER_TIRAGE,
      mot_de_passe_hash: hacherMotDePasse(motDePasse),
    });
    return { ...joueur, nouveau_joueur: true };
  } catch (e) {
    // 23505 = violation de contrainte unique (players_pseudo_unique) — le cas normal d'un
    // pseudo déjà pris, pas une vraie erreur serveur.
    if ((e as Error).message.includes('23505')) throw new Error('Ce pseudo est déjà pris.');
    throw e;
  }
}

export async function connecterCompteLocal(pseudoBrut: string, motDePasse: string): Promise<Joueur> {
  const pseudo = validerPseudo(pseudoBrut);
  const joueur = await supabaseSelectUn<Joueur & { mot_de_passe_hash: string | null }>(
    'players', { pseudo: `eq.${pseudo}`, select: '*' },
  );
  // Même message dans les deux cas (pseudo inconnu / mot de passe faux) : révéler lequel des
  // deux est faux permettrait de deviner quels pseudos existent en base.
  if (!joueur || !joueur.mot_de_passe_hash || !verifierMotDePasse(motDePasse, joueur.mot_de_passe_hash)) {
    throw new Error('Pseudo ou mot de passe incorrect.');
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
