// ONE PIECE ARENA — point d'entrée de l'API en production (Vercel).
//
// ⚠️ Le nom du fichier est du code, pas de la décoration. `[...chemin]` est la syntaxe Vercel
// d'une route « attrape-tout » : toute requête vers /api/QUOI/QUE/CE/SOIT arrive ici.
// Une première version utilisait `[[...chemin]]` (doubles crochets, la syntaxe de Next.js) :
// Vercel ne l'a PAS traitée comme un attrape-tout, et seuls les chemins à un seul niveau
// arrivaient. /api/etat fonctionnait, /api/auth/dev/login renvoyait un 404 de Vercel —
// autrement dit la moitié de l'API était injoignable, sans la moindre erreur pour le dire.
//
// Ce fichier ne contient AUCUNE logique de jeu et ne doit jamais en contenir. Il n'est qu'un
// adaptateur : dupliquer ne serait-ce qu'une route ici la ferait diverger de la version
// locale, et on déboguerait un comportement impossible à reproduire sur sa machine.

import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Import DYNAMIQUE, et pas en haut du fichier : server.ts vérifie ses variables
  // d'environnement dès son chargement et refuse de démarrer s'il en manque une (c'est voulu,
  // voir env.ts). Avec un import statique, cette erreur survient AVANT que notre code ne
  // s'exécute : Vercel ne peut alors afficher qu'un « FUNCTION_INVOCATION_FAILED » opaque, qui
  // ne dit ni quelle variable manque, ni même que le problème vient de là.
  // En important ici, on récupère le message et on le renvoie tel quel au navigateur.
  let gererRequete: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  try {
    ({ gererRequete } = await import('../server/src/server.ts'));
  } catch (e) {
    console.error('Démarrage de l\'API impossible :', e);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.writeHead(500).end(
      'L\'API n\'a pas pu démarrer.\n\n'
      + `${(e as Error).message}\n\n`
      + 'Si le message ci-dessus parle d\'une variable absente : ajoute-la dans\n'
      + 'Vercel → Settings → Environment Variables, PUIS relance un déploiement\n'
      + '(les variables ne sont lues qu\'au déploiement suivant).\n',
    );
    return;
  }

  // Vercel livre l'URL complète, préfixe compris (/api/etat), alors que le routeur raisonne en
  // chemins nus (/etat) — les mêmes qu'en local, où l'API a son propre port et pas de préfixe.
  // On retire donc le préfixe ici, une seule fois, plutôt que de faire porter à chaque route
  // la connaissance de l'endroit où elle est déployée.
  if (req.url) {
    req.url = req.url.replace(/^\/api(?=\/|\?|$)/, '') || '/';
  }

  await gererRequete(req, res);
}
