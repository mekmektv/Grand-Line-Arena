// ONE PIECE ARENA — point d'entrée de l'API en production (Vercel).
//
// ⚠️ Ce fichier ne contient AUCUNE logique de jeu et ne doit jamais en contenir. Il n'est
// qu'un adaptateur : dupliquer ne serait-ce qu'une route ici la ferait diverger de la version
// locale, et on déboguerait un comportement impossible à reproduire sur sa machine.
//
// ── Pourquoi une règle de routage explicite plutôt qu'un fichier « attrape-tout » ──────
// Deux tentatives ont échoué avant celle-ci, et toutes deux SILENCIEUSEMENT :
//   · `api/[[...chemin]].ts` (doubles crochets, syntaxe Next.js) — pas reconnu du tout ;
//   · `api/[...chemin].ts`   (crochets simples) — ne capturait qu'UN SEUL niveau de chemin.
//     /api/etat arrivait bien, mais /api/auth/dev/login, /api/quetes/reclamer et
//     /api/equipement/equiper renvoyaient un 404 de Vercel. La moitié de l'API était
//     injoignable, et rien dans les logs de build ne le signalait.
//
// D'où le choix actuel : c'est `vercel.json` qui redirige explicitement tout /api/… vers ce
// fichier, en passant le chemin d'origine dans le paramètre `chemin`. Plus verbeux, mais le
// comportement est lisible et vérifiable — on ne dépend plus d'une convention de nommage.

import type { IncomingMessage, ServerResponse } from 'node:http';
// Import STATIQUE obligatoire : c'est lui qui indique au constructeur d'embarquer server.ts
// dans le paquet de la fonction. Une version antérieure l'importait dynamiquement (pour mieux
// rapporter les erreurs de démarrage) et l'exécution échouait sur
// « Cannot find module /var/task/server/src/server.ts ».
import { gererRequete } from '../server/src/server.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Reconstitue le chemin nu attendu par le routeur (/etat, /auth/twitch/callback…), le même
  // qu'en local où l'API a son propre port et aucun préfixe. Vercel nous livre le chemin
  // d'origine dans `chemin` et y ajoute les paramètres de la requête initiale : on retire le
  // premier et on garde les seconds.
  const recu = new URL(req.url ?? '/', 'http://interne');
  const chemin = recu.searchParams.get('chemin') ?? '';
  recu.searchParams.delete('chemin');

  const query = recu.searchParams.toString();
  req.url = `/${chemin}${query ? `?${query}` : ''}`;

  await gererRequete(req, res);
}
