// GRAND LINE ARENA — branche la logique pure de recharge.ts sur la base.
//
// Il n'y a pas de tâche planifiée qui recharge tout le monde à minuit : la recharge est
// PARESSEUSE, appliquée quand le joueur se manifeste. C'est volontaire — ça ne demande aucun
// processus supplémentaire (le §6 ne prévoit qu'un backend et une base), ça passe à l'échelle
// sans effort, et un joueur absent trois jours n'a de toute façon rien à récupérer puisque la
// recharge remet à la valeur maximale au lieu de cumuler.
//
// ⚠️ À appeler AVANT toute lecture de `energie` ou `changements_restants`. Les trois portes
// d'entrée sont /etat (l'écran d'accueil), /combat (qui consomme l'énergie) et /perso-actif
// (qui consomme un changement) : passer par une seule d'entre elles suffirait à créer un
// joueur bloqué à 0 alors que sa recharge est due.

import type { Config } from './types.ts';
import { calculerRecharges } from './recharge.ts';
import { supabaseUpdate } from './supabase.ts';

/** Les colonnes de `players` dont la recharge a besoin. */
export interface LigneJoueurRecharge {
  id: string;
  energie: number;
  changements_restants: number;
  derniere_recharge: string;
  derniere_recharge_changements: string | null;
}

export interface EtatApresRecharge {
  energie: number;
  changements_restants: number;
}

/**
 * Applique les recharges dues au joueur et persiste le résultat si quelque chose a changé.
 * Rend les valeurs À JOUR, que l'appelant doit utiliser à la place de celles de sa ligne.
 */
export async function appliquerRecharges(
  joueur: LigneJoueurRecharge, config: Config,
): Promise<EtatApresRecharge> {
  const maintenant = new Date();

  // `derniere_recharge_changements` peut être nulle sur les comptes créés avant la migration :
  // on repart de `derniere_recharge`, ce qui déclenche au pire une remise à zéro de trop —
  // bien préférable à un joueur bloqué sans changements pour toujours.
  const derniereChangements = joueur.derniere_recharge_changements ?? joueur.derniere_recharge;

  const resultat = calculerRecharges({
    maintenant,
    derniereRechargeEnergie: new Date(joueur.derniere_recharge),
    derniereRechargeChangements: new Date(derniereChangements),
    energieActuelle: joueur.energie,
    changementsActuels: joueur.changements_restants,
    config,
  });

  if (!resultat.doitEcrire) {
    return { energie: joueur.energie, changements_restants: joueur.changements_restants };
  }

  // Les deux horodatages avancent ensemble : chacun n'est comparé qu'à sa propre granularité
  // (jour pour l'énergie, semaine pour les changements), donc les rafraîchir tous les deux ne
  // peut pas escamoter une recharge à venir.
  await supabaseUpdate('players', { id: `eq.${joueur.id}` }, {
    energie: resultat.energie,
    changements_restants: resultat.changements_restants,
    derniere_recharge: maintenant.toISOString(),
    derniere_recharge_changements: maintenant.toISOString(),
  });

  return { energie: resultat.energie, changements_restants: resultat.changements_restants };
}
