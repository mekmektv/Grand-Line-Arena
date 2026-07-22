// GRAND LINE ARENA — Brique 6 : branchement base de la présence live (appelé par le cron
// externe toutes les 1 min). La logique de calcul reste dans twitch-presence.ts (pur).

import { supabaseSelect, supabaseSelectUn, supabaseUpdate } from './supabase.ts';
import { obtenirTokenBroadcaster } from './twitch-broadcaster.ts';
import { lireEtatLive } from './twitch-live-api.ts';
import { calculerCreditPresence } from './twitch-presence.ts';
import { chargerConfig } from './index.ts';
import { env } from './env.ts';

// Les clés reflètent les colonnes SQL telles que Supabase les renvoie (snake_case) — pas de
// mapping automatique vers EtatPresenceJoueur (camelCase), qui reste le format du module pur.
interface LigneJoueurPresence {
  id: string;
  twitch_id: string;
  presence_dernier_live_debut: string | null;
  presence_tranches_creditees: number;
  presence_bonus_recu: boolean;
  presence_berrys_en_attente: number;
}

/**
 * Get Chatters, paginé. Inclut déjà les lurkers connectés au chat (silencieux) — c'est le
 * maximum atteignable via l'API Twitch, qui n'expose aucune liste des gens qui regardent la
 * vidéo chat fermé (décidé le 22/07/2026, limite acceptée).
 */
async function listerChatters(broadcasterUserId: string, accessToken: string): Promise<string[]> {
  const ids: string[] = [];
  let curseur: string | undefined;
  do {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterUserId, moderator_id: broadcasterUserId, first: '1000',
    });
    if (curseur) params.set('after', curseur);

    const res = await fetch(`https://api.twitch.tv/helix/chat/chatters?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': env.twitchClientId },
    });
    if (!res.ok) throw new Error(`Get Chatters → ${res.status} ${await res.text()}`);
    const { data, pagination } = await res.json() as {
      data: { user_id: string }[]; pagination: { cursor?: string };
    };
    ids.push(...data.map((c) => c.user_id));
    curseur = pagination.cursor;
  } while (curseur);
  return ids;
}

/** Crédite la présence de tous les chatters actuellement reconnus comme joueurs. */
export async function crediterPresenceTousLesChatters(): Promise<{ traites: number }> {
  const live = await lireEtatLive();
  if (!live.en_direct || !live.demarre_le || !live.broadcaster_user_id) return { traites: 0 };

  const lignesConfig = await supabaseSelect('config', { select: 'cle,valeur' });
  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);

  const accessToken = await obtenirTokenBroadcaster();
  const chatterIds = await listerChatters(live.broadcaster_user_id, accessToken);
  if (chatterIds.length === 0) return { traites: 0 };

  const joueurs = await supabaseSelect<LigneJoueurPresence>('players', {
    twitch_id: `in.(${chatterIds.join(',')})`,
    select: 'id,twitch_id,presence_dernier_live_debut,presence_tranches_creditees,presence_bonus_recu,presence_berrys_en_attente',
  });

  const maintenant = new Date();
  const liveDemarreLe = new Date(live.demarre_le);
  let traites = 0;

  for (const joueur of joueurs) {
    const resultat = calculerCreditPresence({
      maintenant, liveDemarreLe,
      etat: {
        presenceDernierLiveDebut: joueur.presence_dernier_live_debut
          ? new Date(joueur.presence_dernier_live_debut) : null,
        presenceTranchesCreditees: joueur.presence_tranches_creditees,
        presenceBonusRecu: joueur.presence_bonus_recu,
      },
      config,
    });
    if (!resultat.doitEcrire) continue;

    await supabaseUpdate('players', { id: `eq.${joueur.id}` }, {
      presence_dernier_live_debut: resultat.presenceDernierLiveDebut.toISOString(),
      presence_tranches_creditees: resultat.presenceTranchesCreditees,
      presence_bonus_recu: resultat.presenceBonusRecu,
      presence_berrys_en_attente: joueur.presence_berrys_en_attente + resultat.berrysACrediter,
    });
    traites++;
  }

  return { traites };
}

/** Encaisse les Berrys de présence en attente vers le solde réel — déclenché par le clic du
 *  joueur sur le rond de l'accueil, jamais automatiquement (décidé le 22/07/2026). */
export async function encaisserPresence(playerId: string): Promise<{ berrys: number }> {
  const joueur = await supabaseSelectUn<{ id: string; berrys: number; presence_berrys_en_attente: number }>(
    'players', { id: `eq.${playerId}`, select: 'id,berrys,presence_berrys_en_attente' },
  );
  if (!joueur) throw new Error('Joueur introuvable.');
  if (joueur.presence_berrys_en_attente <= 0) return { berrys: joueur.berrys };

  const berrys = joueur.berrys + joueur.presence_berrys_en_attente;
  await supabaseUpdate('players', { id: `eq.${playerId}` }, { berrys, presence_berrys_en_attente: 0 });
  return { berrys };
}
