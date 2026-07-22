// ONE PIECE ARENA — Brique 6 : crée la récompense "Tirage premium" et les abonnements EventSub
// (redemption + stream online/offline). À lancer UNE FOIS, après avoir visité
// /auth/twitch/streamer/login?cle=... (le jeton broadcaster doit déjà être en base).
//
//   node server/scripts/config-eventsub-twitch.ts https://grand-line-arena.vercel.app/api
//
// L'URL passée en argument est la BASE publique de l'API en production — le webhook doit être
// joignable depuis internet, donc jamais localhost. Le endpoint /webhooks/twitch/eventsub est
// lu par le rewrite générique /api/(.*) de vercel.json, pas besoin de route dédiée côté Vercel.
import '../src/load-env.ts';
import { env } from '../src/env.ts';
import { obtenirTokenBroadcaster } from '../src/twitch-broadcaster.ts';
import { NOM_RECOMPENSE_TIRAGE_PREMIUM } from '../src/twitch-live-api.ts';

const baseUrl = process.argv[2];
if (!baseUrl || !baseUrl.startsWith('https://')) {
  throw new Error(
    'Usage : node server/scripts/config-eventsub-twitch.ts https://ton-domaine/api\n' +
    '(doit être en https:// et publiquement joignable — Twitch appelle cette URL depuis internet).',
  );
}
const callback = `${baseUrl.replace(/\/$/, '')}/webhooks/twitch/eventsub`;

function fabriqueHelix(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Client-Id': env.twitchClientId,
    'Content-Type': 'application/json',
  };
  return async function helix<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
    const res = await fetch(`https://api.twitch.tv/helix${chemin}`, {
      method: methode, headers, body: corps ? JSON.stringify(corps) : undefined,
    });
    if (!res.ok) throw new Error(`Twitch ${methode} ${chemin} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  };
}

// Deux jetons distincts, exigés par Twitch pour deux choses différentes :
//  - le jeton BROADCASTER (utilisateur, scopes élevés) pour lire son profil et créer une
//    récompense de points de chaîne ;
//  - un jeton D'APPLICATION (client_credentials, sans utilisateur derrière) pour créer un
//    abonnement EventSub en webhook — Twitch refuse un jeton utilisateur pour ça
//    ("auth must use app access token to create webhook subscription").
const helixBroadcaster = fabriqueHelix(await obtenirTokenBroadcaster());

const tokenAppRes = await fetch('https://id.twitch.tv/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: env.twitchClientId,
    client_secret: env.twitchClientSecret,
    grant_type: 'client_credentials',
  }),
});
if (!tokenAppRes.ok) throw new Error(`Jeton d'application Twitch échoué : ${tokenAppRes.status} ${await tokenAppRes.text()}`);
const { access_token: tokenApp } = await tokenAppRes.json() as { access_token: string };
const helixApp = fabriqueHelix(tokenApp);

// 1) Qui est le streamer — nécessaire comme broadcaster_id sur toutes les requêtes suivantes.
const { data: utilisateurs } = await helixBroadcaster<{ data: { id: string; display_name: string }[] }>('GET', '/users');
const broadcaster = utilisateurs[0];
if (!broadcaster) throw new Error('Impossible de lire ton propre profil Twitch avec ce jeton.');
console.log(`  Chaîne : ${broadcaster.display_name} (${broadcaster.id})`);

// 2) La récompense de points de chaîne — idempotent : si elle existe déjà (relance du script),
// on la réutilise plutôt que d'en créer une deuxième avec le même nom.
const { data: recompensesExistantes } = await helixBroadcaster<{ data: { id: string; title: string }[] }>(
  'GET', `/channel_points/custom_rewards?broadcaster_id=${broadcaster.id}&only_manageable_rewards=true`,
);
let recompenseId = recompensesExistantes.find((r) => r.title === NOM_RECOMPENSE_TIRAGE_PREMIUM)?.id;

if (recompenseId) {
  console.log(`  Récompense déjà existante : "${NOM_RECOMPENSE_TIRAGE_PREMIUM}" (${recompenseId})`);
} else {
  // is_max_per_user_per_stream (pas is_max_per_stream, qui limiterait TOUS les viewers
  // ensemble) — c'est bien "1 par viewer et par stream" (§3bis GAME_DESIGN).
  const { data: recompenses } = await helixBroadcaster<{ data: { id: string; title: string }[] }>(
    'POST', `/channel_points/custom_rewards?broadcaster_id=${broadcaster.id}`,
    {
      title: NOM_RECOMPENSE_TIRAGE_PREMIUM,
      cost: 1000,
      prompt: 'Un tirage de personnage avec de meilleurs taux (mêmes persos, aucun contenu exclusif).',
      is_max_per_user_per_stream_enabled: true,
      max_per_user_per_stream: 1,
    },
  );
  recompenseId = recompenses[0]?.id;
  console.log(`  Récompense créée : "${recompenses[0]?.title}" (${recompenseId})`);
}

// 3) Les 3 abonnements EventSub, en webhook (compatible fonction Vercel — pas de connexion
// permanente à tenir).
const ABONNEMENTS = [
  { type: 'channel.channel_points_custom_reward_redemption.add', version: '1' },
  { type: 'stream.online', version: '1' },
  { type: 'stream.offline', version: '1' },
] as const;

for (const { type, version } of ABONNEMENTS) {
  try {
    await helixApp('POST', '/eventsub/subscriptions', {
      type, version,
      condition: { broadcaster_user_id: broadcaster.id },
      transport: { method: 'webhook', callback, secret: env.twitchEventsubSecret },
    });
    console.log(`  Abonné : ${type}`);
  } catch (e) {
    // Relancer le script après un abonnement déjà créé ne doit pas planter — Twitch renvoie
    // 409 si le même (type, condition, transport) existe déjà.
    if ((e as Error).message.includes('409')) console.log(`  Déjà abonné : ${type}`);
    else throw e;
  }
}

console.log('\n  ✅ Récompense et abonnements EventSub créés.');
