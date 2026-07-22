// ONE PIECE ARENA — charge server/.env dans process.env. Import à faire EN PREMIER
// (avant tout import qui lit `env`), dans server.ts et les scripts.
//
// Pas de dépendance `dotenv` : le fichier est trivial (clé=valeur), pas besoin d'un paquet.
// Sur Railway/Vercel (Brique 6+), les vraies variables d'environnement de la plateforme
// prennent le dessus — ce loader ne touche jamais une variable déjà définie.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const iciDir = dirname(fileURLToPath(import.meta.url));
const cheminEnv = join(iciDir, '..', '.env');

try {
  const contenu = readFileSync(cheminEnv, 'utf8');
  for (const ligne of contenu.split('\n')) {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx === -1) continue;
    const cle = l.slice(0, idx).trim();
    let valeur = l.slice(idx + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"'))
      || (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    if (process.env[cle] === undefined) process.env[cle] = valeur;
  }
} catch {
  // Pas de server/.env : normal sur une plateforme qui fournit ses propres variables.
}
