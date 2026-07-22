// ONE PIECE ARENA — la collection d'un joueur : le catalogue complet (§8 point 4), avec
// pour chaque perso soit ses infos de possession (niveau, xp, stats), soit "verrouillé".

import type { Niveau } from './index.ts';
import { chargerConfig, chargerPerso, calculerStats, detaillerProgression } from './index.ts';
import { supabaseSelect, supabaseSelectUn } from './supabase.ts';
import { urlPublique } from './assets.ts';

interface LigneCharacterComplete {
  id: number;
  nom: string;
  classe: string;
  rarete: string;
  profil: string;
  cout_kit_pct: number;
  resistance: number | null;
  competence_nom: string | null;
  competence_type: string | null;
  competence_declencheur: string | null;
  competence_effet: unknown;
  sprite_folder: string;
  image_menu: string | null;
}

interface LigneCollection {
  id: number;
  character_id: number;
  niveau: number;
  xp: number;
}

export interface CarteCollection {
  character_id: number;
  nom: string;
  classe: string;
  rarete: string;
  image_menu_url: string | null;
  possede: boolean;
  actif: boolean;
  // Uniquement si `possede` :
  collection_id?: number;
  niveau?: number;
  xp?: number;
  /** §3 : la barre d'XP vers le niveau suivant, 0..1. Vaut 1 au niveau max. */
  progression_pct?: number;
  /** XP restante avant le palier suivant. null au niveau max. */
  xp_avant_prochain_niveau?: number | null;
  pv?: number;
  attack?: number;
  competence_nom?: string | null;
  competence_desc?: string | null;
}

export async function listerCollection(playerId: string): Promise<CarteCollection[]> {
  const [lignesConfig, lignesCharacters, lignesCollection, joueur] = await Promise.all([
    supabaseSelect('config', { select: 'cle,valeur' }),
    // jouable=true : les formes transformées (Dalton_Zoan...) ne sont pas des persos à collectionner (§7).
    supabaseSelect<LigneCharacterComplete>('characters', { select: '*', jouable: 'eq.true' }),
    supabaseSelect<LigneCollection>('collection', { player_id: `eq.${playerId}`, select: '*' }),
    supabaseSelectUn<{ perso_actif_id: number | null }>('players', { id: `eq.${playerId}`, select: 'perso_actif_id' }),
  ]);

  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);
  const collectionParCharacterId = new Map(lignesCollection.map((c) => [c.character_id, c]));

  return lignesCharacters.map((l) => {
    const ligneCollection = collectionParCharacterId.get(l.id);
    const image_menu_url = l.image_menu ? urlPublique(`${l.sprite_folder}/${l.image_menu}`) : null;

    if (!ligneCollection) {
      return {
        character_id: l.id, nom: l.nom, classe: l.classe, rarete: l.rarete,
        image_menu_url, possede: false, actif: false,
      };
    }

    const perso = chargerPerso(l);
    const niveauTier = Math.min(3, Math.max(1, ligneCollection.niveau)) as Niveau;
    const stats = calculerStats(perso, niveauTier, config);

    return {
      character_id: l.id, nom: l.nom, classe: l.classe, rarete: l.rarete,
      image_menu_url, possede: true,
      actif: joueur?.perso_actif_id === ligneCollection.id,
      collection_id: ligneCollection.id,
      niveau: ligneCollection.niveau,
      xp: ligneCollection.xp,
      ...detaillerProgression(ligneCollection.xp, niveauTier, config),
      pv: Math.round(stats.pv),
      attack: Math.round(stats.attack),
      competence_nom: l.competence_nom,
      competence_desc: describeCompetence(l.competence_effet),
    };
  });
}

/** Une phrase lisible pour la compétence, à partir de son effet JSON (§3 FICHE_PERSOS).
 *  Exporté : l'écran de tirage l'affiche aussi, sur la carte qui vient de sortir. */
export function describeCompetence(effetBrut: unknown): string | null {
  if (!effetBrut) return null;
  const effet = typeof effetBrut === 'string' ? JSON.parse(effetBrut) : effetBrut as Record<string, number | undefined>;
  const morceaux: string[] = [];
  if (effet.mult) morceaux.push(`×${effet.mult} dégâts`);
  if (effet.vol_de_vie) morceaux.push(`vol de vie ${Math.round(effet.vol_de_vie * 100)} %`);
  if (effet.poison_pct) morceaux.push(`poison ${Math.round(effet.poison_pct * 100)} %/tour`);
  if (effet.debuff_attack) morceaux.push(`−${Math.round(effet.debuff_attack * 100)} % Attack cible`);
  if (effet.debuff_esquive) morceaux.push(`−${Math.round(effet.debuff_esquive * 100)} % esquive cible`);
  if (effet.atk_pct) morceaux.push(`+${Math.round(effet.atk_pct * 100)} % Attack`);
  if (effet.resistance) morceaux.push(`+${Math.round(effet.resistance * 100)} % résistance`);
  if (effet.esquive_pct) morceaux.push(`+${Math.round(effet.esquive_pct * 100)} % esquive`);
  if (effet.crit_garanti) morceaux.push('critique garanti');
  return morceaux.join(', ') || null;
}
