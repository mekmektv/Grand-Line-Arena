// ONE PIECE ARENA — charge server/.env dans process.env. Import à faire EN PREMIER
// (avant tout import qui lit `env`), dans server.ts et les scripts.
//
// Pas de dépendance `dotenv` : le fichier est trivial (clé=valeur), pas besoin d'un paquet.
// Une variable déjà définie n'est JAMAIS écrasée — un `.env` traînant ne peut donc pas prendre
// le pas sur ce que fournit la plateforme.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ⚠️ Ce chargeur ne s'exécute QUE hors plateforme. Sur Vercel, il n'y a aucun fichier .env à
// lire (les variables viennent des réglages du projet), et surtout le code ci-dessous s'y
// exécutait dans un paquet compilé où `import.meta.url` n'a plus la forme attendue :
// fileURLToPath() levait alors une exception AU CHARGEMENT du module, avant tout code protégé.
// La fonction mourait donc net, et Vercel n'affichait qu'un « FUNCTION_INVOCATION_FAILED »
// sans la moindre indication — plusieurs heures de recherche pour trois lignes de fichier.
//
// Le test se fait sur la variable, pas sur un try/catch élargi : mieux vaut ne pas exécuter
// du code inutile que de rattraper son échec.
if (process.env.VERCEL === undefined) {
  try {
    const iciDir = dirname(fileURLToPath(import.meta.url));
    const cheminEnv = join(iciDir, '..', '.env');
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
    // Pas de server/.env : normal dès qu'on fournit les variables autrement.
  }
}
