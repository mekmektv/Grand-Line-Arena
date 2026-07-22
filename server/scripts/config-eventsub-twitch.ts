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

const accessToken = await obtenirTokenBroadcaster();
const headers = {
  Authorization: `Bearer ${accessToken}`,
  'Client-Id': env.twitchClientId,
  'Content-Type': 'application/json',
};

async function helix<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
  const res = await fetch(`https://api.twitch.tv/helix${chemin}`, {
    method: methode, headers, body: corps ? JSON.stringify(corps) : undefined,
  });
  if (!res.ok) throw new Error(`Twitch ${methode} ${chemin} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// 1) Qui est le streamer — nécessaire comme broadcaster_id sur toutes les requêtes suivantes.
const { data: utilisateurs } = await helix<{ data: { id: string; display_name: string }[] }>('GET', '/users');
const broadcaster = utilisateurs[0];
if (!broadcaster) throw new Error('Impossible de lire ton propre profil Twitch avec ce jeton.');
console.log(`  Chaîne : ${broadcaster.display_name} (${broadcaster.id})`);

// 2) La récompense de points de chaîne. is_max_per_user_per_stream (pas is_max_per_stream, qui
// limiterait TOUS les viewers ensemble) — c'est bien "1 par viewer et par stream" (§3bis GAME_DESIGN).
const { data: recompenses } = await helix<{ data: { id: string; title: string }[] }>(
  'POST', `/channel_points/custom_rewards?broadcaster_id=${broadcaster.id}`,
  {
    title: NOM_RECOMPENSE_TIRAGE_PREMIUM,
    cost: 1000,
    prompt: 'Un tirage de personnage avec de meilleurs taux (mêmes persos, aucun contenu exclusif).',
    is_max_per_user_per_stream_enabled: true,
    max_per_user_per_stream: 1,
  },
);
console.log(`  Récompense créée : "${recompenses[0]?.title}" (${recompenses[0]?.id})`);

// 3) Les 3 abonnements EventSub, en webhook (compatible fonction Vercel — pas de connexion
// permanente à tenir).
const ABONNEMENTS = [
  { type: 'channel.channel_points_custom_reward_redemption.add', version: '1' },
  { type: 'stream.online', version: '1' },
  { type: 'stream.offline', version: '1' },
] as const;

for (const { type, version } of ABONNEMENTS) {
  await helix('POST', '/eventsub/subscriptions', {
    type, version,
    condition: { broadcaster_user_id: broadcaster.id },
    transport: { method: 'webhook', callback, secret: env.twitchEventsubSecret },
  });
  console.log(`  Abonné : ${type}`);
}

console.log('\n  ✅ Récompense et abonnements EventSub créés.');
