// GRAND LINE ARENA — Brique 6 : le jeton OAuth DU STREAMER (scopes élevés), distinct des jetons
// joueurs de auth-twitch (server.ts), qui ne servent qu'une fois à la connexion et ne sont
// jamais stockés. Celui-ci doit vivre en continu (Get Chatters, EventSub), donc il est
// persisté en base avec son refresh token — voir supabase/A_APPLIQUER_twitch.sql.

import { env } from './env.ts';
import { supabaseSelectUn, supabaseUpsert } from './supabase.ts';

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

interface LigneToken {
  access_token: string;
  refresh_token: string;
  expire_le: string; // timestamptz ISO
}

/** Enregistre (ou remplace) le jeton broadcaster après un échange OAuth ou un refresh. */
export async function enregistrerTokenBroadcaster(
  access_token: string, refresh_token: string, expiresInSecondes: number,
): Promise<void> {
  const expire_le = new Date(Date.now() + expiresInSecondes * 1000).toISOString();
  await supabaseUpsert('twitch_broadcaster_token', { id: true, access_token, refresh_token, expire_le });
}

/**
 * Rend un access_token VALIDE, en le renouvelant d'abord si besoin. C'est la seule fonction
 * que le reste du code doit appeler — jamais lire `twitch_broadcaster_token` directement.
 *
 * Marge de 5 minutes avant l'expiration réelle : évite qu'un jeton expire EN COURS d'appel
 * (le cron tourne toutes les minutes, la marge doit largement couvrir un aller-retour réseau).
 */
export async function obtenirTokenBroadcaster(): Promise<string> {
  const ligne = await supabaseSelectUn<LigneToken>('twitch_broadcaster_token', { id: 'eq.true', select: '*' });
  if (!ligne) {
    throw new Error(
      'twitch_broadcaster_token : aucun jeton enregistré — le streamer doit visiter ' +
      '/auth/twitch/streamer/login?cle=... une première fois.',
    );
  }

  const expireBientot = new Date(ligne.expire_le).getTime() - Date.now() < 5 * 60_000;
  if (!expireBientot) return ligne.access_token;

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.twitchClientId,
      client_secret: env.twitchClientSecret,
      grant_type: 'refresh_token',
      refresh_token: ligne.refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(`Refresh du jeton broadcaster échoué : ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  await enregistrerTokenBroadcaster(data.access_token, data.refresh_token, data.expires_in);
  return data.access_token;
}
