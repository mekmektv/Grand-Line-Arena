// ONE PIECE ARENA — point d'entrée de l'API en production (Vercel).
//
// Le nom du fichier n'est pas décoratif : `[[...chemin]]` est la syntaxe Vercel d'une route
// « attrape-tout ». Toute requête vers /api/QUOI/QUE/CE/SOIT arrive donc ici, et c'est le
// routeur de server.ts qui décide quoi en faire — exactement comme en local.
//
// ⚠️ Ce fichier ne contient AUCUNE logique de jeu, et ne doit jamais en contenir. Il n'est
// qu'un adaptateur : dupliquer ne serait-ce qu'une route ici la ferait diverger de la version
// locale, et on déboguerait un comportement impossible à reproduire sur sa machine.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { gererRequete } from '../server/src/server.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Vercel livre l'URL complète, préfixe compris (/api/etat), alors que le routeur raisonne
  // en chemins nus (/etat) — les mêmes qu'en local, où l'API a son propre port et pas de
  // préfixe. On retire donc le préfixe ici, une seule fois, plutôt que de faire porter à
  // chaque route la connaissance de l'endroit où elle est déployée.
  if (req.url) {
    req.url = req.url.replace(/^\/api(?=\/|\?|$)/, '') || '/';
  }

  await gererRequete(req, res);
}
