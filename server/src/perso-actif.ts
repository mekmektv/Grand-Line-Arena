// ONE PIECE ARENA — changement de perso actif (§3 : 3 changements gratuits/semaine).
//
// §3 : "Débloquer un perso (roll) = changement gratuit immédiat, ne consomme pas le quota."
// Comme cette route est appelée séparément du tirage (le joueur clique "Incarner" après
// avoir vu le résultat), on distingue "gratuit parce que fraîchement tiré" via `obtenu_le` :
// un perso obtenu il y a moins de 2 minutes est considéré comme "ce tirage-ci", sans avoir
// besoin d'un état serveur supplémentaire à faire correspondre entre 2 requêtes.
//
// ⚠️ Limitation connue : au-delà des changements gratuits, GAME_DESIGN.md dit juste "coûte
// des Berrys" sans fixer de montant — ce chiffre n'existe dans aucune table. Plutôt que d'en
// inventer un, ce changement est refusé avec un message clair en attendant un vrai chiffrage.
// La remise à zéro hebdomadaire, elle, est faite (recharge.ts).

import { chargerConfig } from './index.ts';
import { appliquerRecharges } from './recharge-api.ts';
import { prixProchainChangement } from './recharge.ts';
import { supabaseSelect, supabaseSelectUn, supabaseUpdate } from './supabase.ts';

const FENETRE_GRATUITE_MS = 2 * 60 * 1000;

interface LigneCollection {
  id: number;
  player_id: string;
  character_id: number;
  obtenu_le: string;
}

interface LigneJoueur {
  id: string;
  berrys: number;
  energie: number;
  changements_restants: number;
  derniere_recharge: string;
  derniere_recharge_changements: string | null;
}

export type ResultatChangement =
  | {
    ok: true;
    gratuit: boolean;
    /** Ce que ce changement a coûté (0 s'il était gratuit). */
    cout: number;
    /** Jamais négatif : le compteur interne descend sous zéro, l'affichage non. */
    changements_restants: number;
    berrys: number;
    /** Ce que coûtera le suivant, pour l'annoncer avant qu'il ne clique. */
    prochain_cout: number;
  }
  | { ok: false; erreur: string };

export async function changerPersoActif(playerId: string, collectionId: number): Promise<ResultatChangement> {
  const ligneCollection = await supabaseSelectUn<LigneCollection>(
    'collection', { id: `eq.${collectionId}`, select: '*' },
  );
  if (!ligneCollection || ligneCollection.player_id !== playerId) {
    return { ok: false, erreur: 'Ce perso ne fait pas partie de ta collection.' };
  }

  const [joueur, lignesConfig] = await Promise.all([
    supabaseSelectUn<LigneJoueur>('players', { id: `eq.${playerId}`, select: '*' }),
    supabaseSelect('config', { select: 'cle,valeur' }),
  ]);
  if (!joueur) return { ok: false, erreur: 'Joueur introuvable.' };

  // Recharge d'abord : sans ça, un joueur revenu la semaine suivante resterait refusé.
  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);
  const recharge = await appliquerRecharges(joueur, config);

  const vientDetreObtenu = Date.now() - new Date(ligneCollection.obtenu_le).getTime() < FENETRE_GRATUITE_MS;

  let changementsRestants = recharge.changements_restants;
  let cout = 0;
  let berrys = joueur.berrys;

  if (!vientDetreObtenu) {
    cout = prixProchainChangement(changementsRestants, config);
    if (cout > berrys) {
      return {
        ok: false,
        erreur: `Ce changement coûte ${cout} Berrys (tu en as ${berrys}) — tes changements gratuits reviennent lundi.`,
      };
    }
    berrys -= cout;
    // Descend sous zéro une fois le quota épuisé : c'est ce compteur qui fait monter le prix
    // (20 → 40 → 60). La recharge hebdomadaire le repasse au quota et efface l'escalade.
    changementsRestants -= 1;
  }

  await supabaseUpdate('players', { id: `eq.${playerId}` }, {
    perso_actif_id: collectionId,
    changements_restants: changementsRestants,
    berrys,
  });

  return {
    ok: true,
    gratuit: vientDetreObtenu,
    cout,
    changements_restants: Math.max(0, changementsRestants),
    berrys,
    prochain_cout: prixProchainChangement(changementsRestants, config),
  };
}
