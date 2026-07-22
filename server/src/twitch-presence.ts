// GRAND LINE ARENA — Brique 6 : présence en live (§3 GAME_DESIGN.md).
//
// La partie calcul est pure (aucun accès base, aucune horloge lue en interne), comme
// recharge.ts. L'appelant (twitch-api.ts) lit l'état en base, appelle ces fonctions, et
// n'écrit que si `doitEcrire` est vrai.
//
// Les Berrys de présence ne sont JAMAIS crédités directement sur `berrys` : ils s'accumulent
// dans `presence_berrys_en_attente`, que le joueur encaisse lui-même depuis l'accueil (décidé
// le 22/07/2026 — l'automatique donnait un solde qui bougeait sans action du joueur).

import type { Config } from './types.ts';

export interface EtatPresenceJoueur {
  presenceDernierLiveDebut: Date | null;
  presenceTranchesCreditees: number;
  presenceBonusRecu: boolean;
}

export interface ResultatPresence extends Omit<EtatPresenceJoueur, 'presenceDernierLiveDebut'> {
  /** Toujours renseigné en sortie (contrairement à l'entrée) : calculerCreditPresence y met
   *  systématiquement `liveDemarreLe`. */
  presenceDernierLiveDebut: Date;
  berrysACrediter: number;
  /** true si un des trois champs a changé — l'appelant n'écrit en base que dans ce cas. */
  doitEcrire: boolean;
}

/**
 * Calcule le crédit de présence pour UN joueur détecté comme présent (chatter) à `maintenant`,
 * pendant un live démarré à `liveDemarreLe`.
 *
 * `presenceDernierLiveDebut` sert à détecter un nouveau live sans remise à zéro explicite en
 * fin de live : si sa valeur diffère de `liveDemarreLe`, les compteurs du joueur appartiennent
 * à un live précédent et repartent de zéro.
 */
export function calculerCreditPresence(params: {
  maintenant: Date;
  liveDemarreLe: Date;
  etat: EtatPresenceJoueur;
  config: Config;
}): ResultatPresence {
  const { maintenant, liveDemarreLe, etat, config } = params;

  const nouveauLive = etat.presenceDernierLiveDebut === null
    || etat.presenceDernierLiveDebut.getTime() !== liveDemarreLe.getTime();

  const tranchesDejaCreditees = nouveauLive ? 0 : etat.presenceTranchesCreditees;
  const bonusDejaRecu = nouveauLive ? false : etat.presenceBonusRecu;

  const minutesEcoulees = (maintenant.getTime() - liveDemarreLe.getTime()) / 60_000;
  const tranchesAtteintes = Math.max(0, Math.floor(minutesEcoulees / 30));
  const nouvellesTranches = Math.max(0, tranchesAtteintes - tranchesDejaCreditees);

  const berrysACrediter = nouvellesTranches * config.gain_presence_tranche
    + (bonusDejaRecu ? 0 : config.gain_bonus_connexion_live);

  return {
    presenceDernierLiveDebut: liveDemarreLe,
    presenceTranchesCreditees: tranchesDejaCreditees + nouvellesTranches,
    presenceBonusRecu: true,
    berrysACrediter,
    doitEcrire: nouveauLive || nouvellesTranches > 0 || !bonusDejaRecu,
  };
}
