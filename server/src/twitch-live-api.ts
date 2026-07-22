// ONE PIECE ARENA — Brique 6 : branchement base des événements EventSub (redemption, stream
// online/offline). La logique de calcul reste dans twitch-presence.ts (pur) ; ce fichier ne
// fait que lire/écrire, comme collection.ts, recyclage.ts, etc. (convention du projet).

import { supabaseSelectUn, supabaseUpdate, supabaseUpsert } from './supabase.ts';

// Partagé avec server/scripts/config-eventsub-twitch.ts (création de la récompense) : le
// webhook identifie la redemption par ce TITRE plutôt que par son id Twitch, pour ne rien avoir
// à stocker de généré au moment de la création (voir ce script pour le détail du choix).
export const NOM_RECOMPENSE_TIRAGE_PREMIUM = 'Tirage premium — personnage';

interface JoueurTwitchId { id: string; coffres_premium_perso: number }

/**
 * Crédite +1 coffre premium au joueur derrière ce twitch_id. Si personne dans notre base n'a
 * ce twitch_id (viewer jamais connecté au jeu), la récompense est perdue — décidé le
 * 22/07/2026, acceptable : il faut déjà avoir un compte pour dépenser des points sur CE canal.
 */
export async function crediterCoffrePremium(twitchUserId: string): Promise<void> {
  const joueur = await supabaseSelectUn<JoueurTwitchId>('players', {
    twitch_id: `eq.${twitchUserId}`, select: 'id,coffres_premium_perso',
  });
  if (!joueur) return;

  await supabaseUpdate('players', { id: `eq.${joueur.id}` }, {
    coffres_premium_perso: joueur.coffres_premium_perso + 1,
  });
}

export async function marquerLiveDemarre(broadcasterUserId: string): Promise<void> {
  await supabaseUpsert('twitch_live_etat', {
    id: true, en_direct: true, demarre_le: new Date().toISOString(), broadcaster_user_id: broadcasterUserId,
  });
}

export async function marquerLiveTermine(): Promise<void> {
  // demarre_le n'est PAS effacé : twitch-presence.ts s'en sert pour comparer un futur live à
  // celui-ci et repartir de zéro, il doit rester lisible jusqu'au prochain stream.online.
  await supabaseUpsert('twitch_live_etat', { id: true, en_direct: false });
}

export interface EtatLive { en_direct: boolean; demarre_le: string | null; broadcaster_user_id: string | null }

export async function lireEtatLive(): Promise<EtatLive> {
  const ligne = await supabaseSelectUn<EtatLive>('twitch_live_etat', { id: 'eq.true', select: '*' });
  return ligne ?? { en_direct: false, demarre_le: null, broadcaster_user_id: null };
}
