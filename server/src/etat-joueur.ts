// ONE PIECE ARENA — assemble l'état du joueur pour l'écran Accueil (§8 point 2).
// Lecture seule : ne modifie jamais rien, contrairement à onboarding.ts.

import type { Niveau } from './index.ts';
import { chargerConfig, chargerPerso, calculerStats } from './index.ts';
import { appliquerRecharges } from './recharge-api.ts';
import { prixProchainChangement } from './recharge.ts';
import { supabaseSelect, supabaseSelectUn } from './supabase.ts';
import { urlPublique } from './assets.ts';

interface LigneJoueur {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  onboarding_etape: number;
  berrys: number;
  energie: number;
  changements_restants: number;
  perso_actif_id: number | null;
  derniere_recharge: string;
  derniere_recharge_changements: string | null;
}

interface LigneCollection {
  id: number;
  character_id: number;
  niveau: number;
  xp: number;
}

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
  // Le même type que `LigneCharacter` (config.ts), et non `unknown` : ces lignes sont
  // passées telles quelles à chargerPerso(), donc les deux déclarations doivent concorder.
  // Avec `unknown`, TypeScript refusait l'appel — une erreur qui dormait depuis le début du
  // projet, `server/` n'ayant jamais été vérifié faute de tsconfig.json.
  competence_effet?: string | Record<string, unknown> | null;
  sprite_folder: string;
  image_menu: string | null;
}

export interface PersoActifPourAffichage {
  collection_id: number;
  nom: string;
  classe: string;
  rarete: string;
  niveau: number;
  xp: number;
  pv: number;
  attack: number;
  sprite_folder: string;
  image_menu_url: string | null;
}

export interface EtatJoueur {
  pseudo: string;
  /** Photo de profil Twitch. null pour les comptes de dev, qui n'en ont pas. */
  avatar_url: string | null;
  /** Où en est le joueur dans son parcours d'arrivée (§4). 3 = terminé. */
  onboarding_etape: number;
  berrys: number;
  energie: number;
  /** Jamais négatif : le compteur interne descend sous zéro pour faire monter le prix, mais
   *  l'affichage doit rester lisible ("0/3", pas "-2/3"). */
  changements_restants: number;
  /** Ce que coûtera le prochain changement de perso. 0 = encore gratuit (§3). */
  prochain_changement_cout: number;
  perso_actif: PersoActifPourAffichage | null;
}

// ⚠️ Ce module n'est plus en lecture seule : l'écran d'accueil est la porte d'entrée normale du
// joueur, donc c'est ici que la recharge quotidienne se déclenche le plus souvent (§4).
export async function lireEtatJoueur(playerId: string): Promise<EtatJoueur | null> {
  const [joueur, lignesConfigBrutes] = await Promise.all([
    supabaseSelectUn<LigneJoueur>('players', { id: `eq.${playerId}`, select: '*' }),
    supabaseSelect('config', { select: 'cle,valeur' }),
  ]);
  if (!joueur) return null;

  const config = chargerConfig(lignesConfigBrutes as { cle: string; valeur: unknown }[]);
  const recharge = await appliquerRecharges(joueur, config);

  let persoActif: PersoActifPourAffichage | null = null;
  if (joueur.perso_actif_id !== null) {
    const ligneCollection = await supabaseSelectUn<LigneCollection>(
      'collection', { id: `eq.${joueur.perso_actif_id}`, select: '*' },
    );
    if (ligneCollection) {
      const ligneCharacter = await supabaseSelectUn<LigneCharacterComplete>(
        'characters', { id: `eq.${ligneCollection.character_id}`, select: '*' },
      );

      if (ligneCharacter) {
        const perso = chargerPerso(ligneCharacter);
        // Le catalogue ne définit que 3 tiers de puissance (§4) ; le niveau du perso s'y
        // range au plus près en attendant que la courbe XP → tier soit spécifiée.
        const niveauTier = Math.min(3, Math.max(1, ligneCollection.niveau)) as Niveau;
        const stats = calculerStats(perso, niveauTier, config);

        persoActif = {
          collection_id: ligneCollection.id,
          nom: ligneCharacter.nom,
          classe: ligneCharacter.classe,
          rarete: ligneCharacter.rarete,
          niveau: ligneCollection.niveau,
          xp: ligneCollection.xp,
          pv: Math.round(stats.pv),
          attack: Math.round(stats.attack),
          sprite_folder: ligneCharacter.sprite_folder,
          image_menu_url: ligneCharacter.image_menu
            ? urlPublique(`${ligneCharacter.sprite_folder}/${ligneCharacter.image_menu}`)
            : null,
        };
      }
    }
  }

  return {
    pseudo: joueur.pseudo,
    avatar_url: joueur.avatar_url,
    onboarding_etape: joueur.onboarding_etape,
    berrys: joueur.berrys,
    // Les valeurs APRÈS recharge, pas celles de la ligne lue : sinon l'accueil afficherait
    // encore 0 combat juste après avoir rechargé en base.
    energie: recharge.energie,
    changements_restants: Math.max(0, recharge.changements_restants),
    prochain_changement_cout: prixProchainChangement(recharge.changements_restants, config),
    perso_actif: persoActif,
  };
}
