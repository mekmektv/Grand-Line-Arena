// GRAND LINE ARENA — construit le "paquet sprite" d'un perso pour l'écran de combat : les URLs
// de chaque frame d'animation (lues depuis Supabase Storage) + les constantes de rendu du §7.
//
// ⚠️ Le front calcule lui-même `ref` (la hauteur de référence, en pixels de l'image idle) une
// fois les frames chargées — exactement comme testeur-combat.html. Impossible de le connaître
// sans décoder l'image, donc pas la peine de le stocker : le front sait déjà charger des Image().

import { listerFichiers } from './storage.ts';
import { urlPublique } from './assets.ts';

const BUCKET = 'persos';

export interface PacketSprite {
  nom: string;
  classe: string;
  taille: number;
  resistanceBase: number;
  urls: {
    idle: string[]; run: string[]; attack: string[]; hit: string[]; death: string[];
    special: string[]; special_effet: string[]; special_projectile: string[]; projectile: string[];
  };
  projSize: number; projH: number;
  spProjSize: number; spProjH: number;
  specialFps: number; spProjDur: number; spDelay: number;
  efX: number; efY: number; efSize: number; efOp: number; efFps: number;
  efPlan: 'derriere' | 'devant' | 'arriere';
  efLoop: boolean;
}

export interface LigneCharacterRendu {
  nom: string;
  classe: string;
  taille: number;
  resistance: number | null;
  sprite_folder: string;
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

/** §7 : durée du projectile spécial. Formule fixe du design, comme CAST_MS=1100 ou GY=H*0.86. */
function vitesseVersDuree(vitesse: number): number {
  return Math.round(1300 - vitesse * 105);
}

// `characters.sprite_folder` vaut déjà "persos/Arlong" (bucket inclus, voir importer-sprites.ts).
// `listerFichiers` veut un préfixe RELATIF au bucket : on retire le "persos/" en double.
async function listerUrls(spriteFolder: string, sousDossier: string): Promise<string[]> {
  const relatif = spriteFolder.startsWith(`${BUCKET}/`) ? spriteFolder.slice(BUCKET.length + 1) : spriteFolder;
  const noms = await listerFichiers(BUCKET, `${relatif}/${sousDossier}`);
  return noms.map((n) => urlPublique(`${spriteFolder}/${sousDossier}/${n}`));
}

export async function construirePacketSprite(ligne: LigneCharacterRendu): Promise<PacketSprite> {
  const dossier = ligne.sprite_folder;
  const [idle, run, attack, hit, death, special, special_effet, special_projectile, projectile] = await Promise.all([
    listerUrls(dossier, 'idle'),
    listerUrls(dossier, 'run'),
    listerUrls(dossier, 'attack'),
    listerUrls(dossier, 'hit'),
    listerUrls(dossier, 'death'),
    listerUrls(dossier, 'special/anim'),
    listerUrls(dossier, 'special/effet'),
    listerUrls(dossier, 'special/projectile'),
    listerUrls(dossier, 'projectile'),
  ]);

  return {
    nom: ligne.nom,
    classe: ligne.classe,
    taille: ligne.taille,
    resistanceBase: ligne.resistance ?? 0,
    urls: { idle, run, attack, hit, death, special, special_effet, special_projectile, projectile },
    projSize: ligne.taille_projectile ?? 1,
    projH: ligne.hauteur_projectile ?? 0.5,
    spProjSize: ligne.taille_projectile_special ?? 1,
    spProjH: ligne.hauteur_projectile_special ?? 0.5,
    specialFps: ligne.vitesse_anim_special ?? 12,
    spProjDur: vitesseVersDuree(ligne.vitesse_projectile_special ?? 6),
    spDelay: ligne.depart_projectile_special ?? 1,
    efX: ligne.effet_decalage_x ?? 0,
    efY: ligne.effet_decalage_y ?? 0,
    efSize: ligne.effet_taille ?? 1.2,
    efOp: ligne.effet_opacite ?? 0.9,
    efFps: ligne.effet_vitesse ?? 12,
    efPlan: (ligne.effet_plan as 'derriere' | 'devant' | 'arriere') ?? 'derriere',
    efLoop: ligne.effet_boucle ?? true,
  };
}
