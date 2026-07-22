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
// ⚠️ Import STATIQUE, obligatoirement. Une version précédente l'importait dynamiquement, pour
// pouvoir rapporter proprement une erreur de démarrage : Vercel n'embarque alors PAS
// server.ts dans le paquet de la fonction, et l'exécution échouait sur
// « Cannot find module /var/task/server/src/server.ts ». C'est l'import statique qui indique
// au constructeur quels fichiers embarquer.
//
// La lisibilité des erreurs est traitée autrement : server.ts ne vérifie plus ses variables
// d'environnement au chargement (ça plantait avant tout code à nous, d'où le
// « FUNCTION_INVOCATION_FAILED » muet de Vercel). Une variable absente remonte maintenant à la
// première requête qui la lit, et le try/catch de gererRequete en renvoie le message en clair.
import { gererRequete } from '../server/src/server.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Vercel livre l'URL complète, préfixe compris (/api/etat), alors que le routeur raisonne en
  // chemins nus (/etat) — les mêmes qu'en local, où l'API a son propre port et pas de préfixe.
  // On retire donc le préfixe ici, une seule fois, plutôt que de faire porter à chaque route
  // la connaissance de l'endroit où elle est déployée.
  if (req.url) {
    req.url = req.url.replace(/^\/api(?=\/|\?|$)/, '') || '/';
  }

  await gererRequete(req, res);
}
