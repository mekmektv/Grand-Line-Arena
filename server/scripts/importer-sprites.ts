// GRAND LINE ARENA — importe les zips de sprites (§7 GAME_DESIGN.md) dans Supabase Storage
// + remplit les colonnes d'assets de `characters`. Réutilisable pour les prochaines vagues
// de persos (§10) : dépose les nouveaux zips dans le dossier, relance le script.
//
// Structure attendue (voir Persos/ à la racine du projet) :
//   Persos/<Classe>/<NomDuZip>.zip
//     NomDuZip/idle/01.png, run/, attack/, hit/, death/, special/anim|effet|projectile,
//     _INFO.txt, et pour les persos de base UN SEUL fichier .webp (portrait menu).
//
// Les zips de FORME TRANSFORMÉE (Zoan) n'ont pas de .webp et sont listés dans
// TRANSFOS_VERS_PERSO_BASE ci-dessous — ils créent une ligne `characters` à part
// (jouable = false), reliée au perso de base via forme_transformee_id (§7).
//
// Nécessite la commande `unzip` sur le PATH (Git Bash sur Windows, natif sur macOS/Linux).
//
// Lancer : node server/scripts/importer-sprites.ts [chemin/vers/Persos]

import '../src/load-env.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { assurerBucket, uploaderFichier } from '../src/storage.ts';
import { supabaseSelectUn, supabaseInsert, supabaseUpdate } from '../src/supabase.ts';

const execFileAsync = promisify(execFile);
const BUCKET = 'persos';

// zip (nom interne) -> nom du perso de base dans `characters`.
const TRANSFOS_VERS_PERSO_BASE: Record<string, string> = {
  Dalton_Zoan: 'Dalton',
  Chopper_Heavy_Point: 'Chopper',
  Pell_Zoan: 'Pell',
};

// Les noms de dossier ne peuvent pas contenir les caractères de `characters.nom` (points, espaces).
const NOM_DOSSIER_VERS_NOM_DB: Record<string, string> = {
  MR_1: 'Mr.1',
  Mr_5: 'Mr.5',
};

interface InfoTxt {
  taille: number;
  taille_projectile: number | null;
  hauteur_projectile: number | null;
  taille_projectile_special: number | null;
  hauteur_projectile_special: number | null;
  vitesse_anim_special: number | null;
  vitesse_projectile_special: number | null;
  depart_projectile_special: number | null;
  effet_decalage_x: number | null;
  effet_decalage_y: number | null;
  effet_taille: number | null;
  effet_opacite: number | null;
  effet_vitesse: number | null;
  effet_plan: string | null;
  effet_boucle: boolean | null;
}

function parserInfoTxt(texte: string): InfoTxt {
  const lignes = new Map<string, string>();
  for (const ligne of texte.split('\n')) {
    const idx = ligne.indexOf(':');
    if (idx === -1) continue;
    lignes.set(ligne.slice(0, idx).trim(), ligne.slice(idx + 1).trim());
  }
  const num = (cle: string): number | null => {
    const v = lignes.get(cle);
    return v === undefined || v === '' ? null : Number(v);
  };
  const bool = (cle: string): boolean | null => {
    const v = lignes.get(cle);
    if (v === undefined) return null;
    return v.toLowerCase() === 'oui';
  };
  return {
    taille: num('Taille') ?? 1.0,
    taille_projectile: num('Taille projectile'),
    hauteur_projectile: num('Hauteur projectile'),
    taille_projectile_special: num('Taille projectile special'),
    hauteur_projectile_special: num('Hauteur projectile special'),
    vitesse_anim_special: num('Vitesse anim special'),
    vitesse_projectile_special: num('Vitesse projectile special'),
    depart_projectile_special: num('Depart projectile special'),
    effet_decalage_x: num('Effet decalage X'),
    effet_decalage_y: num('Effet decalage Y'),
    effet_taille: num('Effet taille'),
    effet_opacite: num('Effet opacite'),
    effet_vitesse: num('Effet vitesse'),
    effet_plan: lignes.get('Effet plan') ?? null,
    effet_boucle: bool('Effet boucle'),
  };
}

async function trouverZips(racine: string): Promise<string[]> {
  const resultats: string[] = [];
  for (const entree of await readdir(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) resultats.push(...await trouverZips(chemin));
    else if (entree.name.toLowerCase().endsWith('.zip')) resultats.push(chemin);
  }
  return resultats;
}

async function listerFichiersRecursif(racine: string, prefixe = ''): Promise<string[]> {
  const resultats: string[] = [];
  for (const entree of await readdir(join(racine, prefixe), { withFileTypes: true })) {
    const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) resultats.push(...await listerFichiersRecursif(racine, relatif));
    else resultats.push(relatif);
  }
  return resultats;
}

async function main() {
  const racinePersos = process.argv[2] ?? join(process.cwd(), 'Persos');
  console.log(`Dossier des zips : ${racinePersos}\n`);

  await assurerBucket(BUCKET, true);

  const zips = await trouverZips(racinePersos);
  console.log(`${zips.length} zip(s) trouvé(s).\n`);

  const rapport: string[] = [];

  for (const cheminZip of zips) {
    const dossierTemp = await mkdtemp(join(tmpdir(), 'opa-sprite-'));
    try {
      await execFileAsync('unzip', ['-o', '-qq', cheminZip, '-d', dossierTemp]);

      const entreesRacine = await readdir(dossierTemp, { withFileTypes: true });
      const dossierPerso = entreesRacine.find((e) => e.isDirectory());
      if (!dossierPerso) { rapport.push(`⚠️  ${cheminZip} : aucun dossier trouvé dans le zip, ignoré.`); continue; }

      const nomDossier = dossierPerso.name;
      const cheminSource = join(dossierTemp, nomDossier);
      const fichiers = await listerFichiersRecursif(cheminSource);

      const infoBrut = fichiers.includes('_INFO.txt')
        ? await readFile(join(cheminSource, '_INFO.txt'), 'utf8')
        : null;
      if (!infoBrut) { rapport.push(`⚠️  ${nomDossier} : pas de _INFO.txt, ignoré.`); continue; }
      const info = parserInfoTxt(infoBrut);

      const webps = fichiers.filter((f) => f.toLowerCase().endsWith('.webp'));
      const cheminStorage = `${BUCKET}/${nomDossier}`;

      // Upload : tous les fichiers, le .webp (s'il y en a un) renommé en menu.webp.
      for (const relatif of fichiers) {
        if (relatif === '_INFO.txt') continue;
        const estWebp = webps.includes(relatif);
        const chemin = estWebp ? `${cheminStorage}/menu.webp` : `${cheminStorage}/${relatif}`;
        const contenu = await readFile(join(cheminSource, relatif));
        await uploaderFichier(BUCKET, chemin.slice(BUCKET.length + 1), contenu);
      }

      const colonnesAsset = {
        sprite_folder: cheminStorage,
        image_menu: webps.length > 0 ? 'menu.webp' : null,
        ...info,
      };

      const nomTransfoDe = TRANSFOS_VERS_PERSO_BASE[nomDossier];
      if (nomTransfoDe) {
        // --- Forme transformée : ligne à part, jouable = false, reliée au perso de base ---
        const base = await supabaseSelectUn<{
          id: number; classe: string; rarete: string; profil: string;
          pv_niv1: number; attack_niv1: number; pv_niv2: number; attack_niv2: number;
          pv_niv3: number; attack_niv3: number; esquive_pct: number; crit_pct: number;
        }>('characters', { nom: `eq.${nomTransfoDe}`, select: '*' });
        if (!base) { rapport.push(`❌ ${nomDossier} : perso de base "${nomTransfoDe}" introuvable en base.`); continue; }

        const existant = await supabaseSelectUn<{ id: number }>('characters', { nom: `eq.${nomDossier}`, select: 'id' });
        const donnees = {
          nom: nomDossier,
          classe: base.classe,
          rarete: base.rarete,
          profil: base.profil,
          cout_kit_pct: 0,
          pv_niv1: base.pv_niv1, attack_niv1: base.attack_niv1,
          pv_niv2: base.pv_niv2, attack_niv2: base.attack_niv2,
          pv_niv3: base.pv_niv3, attack_niv3: base.attack_niv3,
          esquive_pct: base.esquive_pct, crit_pct: base.crit_pct,
          jouable: false,
          ...colonnesAsset,
        };
        const transfo = existant
          ? await supabaseUpdate('characters', { id: `eq.${existant.id}` }, donnees)
          : await supabaseInsert<{ id: number }>('characters', donnees);

        await supabaseUpdate('characters', { id: `eq.${base.id}` }, { forme_transformee_id: transfo.id });
        rapport.push(`✅ ${nomDossier} → forme transformée de ${nomTransfoDe} (${fichiers.length} fichiers)`);
      } else {
        // --- Perso de base : met à jour la ligne existante par nom ---
        const nomDb = NOM_DOSSIER_VERS_NOM_DB[nomDossier] ?? nomDossier;
        const existant = await supabaseSelectUn<{ id: number }>('characters', { nom: `eq.${nomDb}`, select: 'id' });
        if (!existant) { rapport.push(`❌ ${nomDossier} : aucun perso "${nomDb}" en base (persos.csv importé ?).`); continue; }

        await supabaseUpdate('characters', { id: `eq.${existant.id}` }, colonnesAsset);
        rapport.push(`✅ ${nomDb} (${nomDossier}) — ${fichiers.length} fichiers, portrait ${webps.length > 0 ? 'oui' : 'MANQUANT'}`);
      }
    } finally {
      await rm(dossierTemp, { recursive: true, force: true });
    }
  }

  console.log(rapport.join('\n'));
  const echecs = rapport.filter((l) => l.startsWith('❌') || l.startsWith('⚠️'));
  if (echecs.length > 0) {
    console.log(`\n${echecs.length} problème(s) à corriger — voir ci-dessus.`);
    process.exit(1);
  }
  console.log('\n✅ Import terminé sans erreur.');
}

main().catch((e) => { console.error('Erreur pendant l\'import :', e); process.exit(1); });
