// ONE PIECE ARENA — VALIDATION DE LA RECHARGE (énergie quotidienne, changements hebdo).
//
//   node server/scripts/validation-recharge.ts
//
// Ne touche NI la base NI l'horloge : recharge.ts est de la logique pure, l'instant courant
// lui est passé en paramètre. Ce script peut donc tourner n'importe quand et rester stable.
//
// Ce qu'il vérifie, et pourquoi ça mérite un test :
//  - la bascule de journée suit l'heure LOCALE du fuseau configuré, pas UTC. C'est le piège
//    principal : à 23h30 à Paris en été, il est déjà le lendemain en UTC. Une implémentation
//    naïve rechargerait tout le monde deux heures trop tôt.
//  - la recharge REMET à la valeur max, elle n'ajoute pas (sinon un joueur absent une semaine
//    reviendrait avec 70 combats).
//  - la semaine bascule bien le lundi, et pas au bout de 7 jours glissants.
//  - `heure_reset` décale correctement la frontière (une recharge à 4 h du matin doit ranger
//    3 h du matin dans la veille).

import type { Config } from '../src/types.ts';
import {
  calculerRecharges, cleJour, cleSemaine, prixProchainChangement,
} from '../src/recharge.ts';

const config = {
  energie_max: 10,
  changements_par_semaine: 3,
  changement_prix_paliers: [20, 40, 60],
  fuseau_horaire: 'Europe/Paris',
  heure_reset: 0,
  jour_reset_hebdo: 1, // lundi
} as unknown as Config;

let echecs = 0;
function verifier(nom: string, condition: boolean): void {
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'} │ ${nom}`);
  if (!condition) echecs += 1;
}

// ── La bascule de journée suit l'heure locale ──────────────────────────────
// Paris est en UTC+2 en juillet : 21h30 UTC = 23h30 à Paris (même jour),
// 22h30 UTC = 00h30 à Paris (jour suivant).
const avantMinuit = new Date('2026-07-20T21:30:00Z');
const apresMinuit = new Date('2026-07-20T22:30:00Z');

verifier('23h30 à Paris → encore le 20/07', cleJour(avantMinuit, config) === '2026-07-20');
verifier('00h30 à Paris → déjà le 21/07 (heure locale, pas UTC)', cleJour(apresMinuit, config) === '2026-07-21');

// ── L'énergie ──────────────────────────────────────────────────────────────
const passageDeMinuit = calculerRecharges({
  maintenant: apresMinuit,
  derniereRechargeEnergie: avantMinuit,
  derniereRechargeChangements: avantMinuit,
  energieActuelle: 0, changementsActuels: 0, config,
});
verifier('énergie rechargée à 10 au passage de minuit', passageDeMinuit.energie === 10 && passageDeMinuit.doitEcrire);

const memeJournee = calculerRecharges({
  maintenant: avantMinuit,
  derniereRechargeEnergie: new Date('2026-07-20T08:00:00Z'),
  derniereRechargeChangements: new Date('2026-07-20T08:00:00Z'),
  energieActuelle: 3, changementsActuels: 1, config,
});
verifier('aucune recharge dans la même journée', memeJournee.energie === 3 && !memeJournee.doitEcrire);

const sansCumul = calculerRecharges({
  maintenant: apresMinuit,
  derniereRechargeEnergie: avantMinuit,
  derniereRechargeChangements: avantMinuit,
  energieActuelle: 7, changementsActuels: 3, config,
});
verifier('la recharge REMET à 10, elle ne cumule pas à 17', sansCumul.energie === 10);

// ── La semaine ─────────────────────────────────────────────────────────────
// Le 20/07/2026 est un lundi.
verifier('lundi 20/07 → semaine du 20', cleSemaine(new Date('2026-07-20T10:00:00Z'), config) === '2026-07-20');
verifier('dimanche 19/07 → semaine précédente (du 13)', cleSemaine(new Date('2026-07-19T10:00:00Z'), config) === '2026-07-13');
verifier('mercredi 22/07 → toujours la semaine du 20', cleSemaine(new Date('2026-07-22T10:00:00Z'), config) === '2026-07-20');

const passageDeSemaine = calculerRecharges({
  maintenant: new Date('2026-07-20T10:00:00Z'),   // lundi
  derniereRechargeEnergie: new Date('2026-07-19T10:00:00Z'), // dimanche
  derniereRechargeChangements: new Date('2026-07-19T10:00:00Z'),
  energieActuelle: 0, changementsActuels: 0, config,
});
verifier('changements rendus au passage du lundi', passageDeSemaine.changements_restants === 3);

// ── heure_reset décale bien la frontière ───────────────────────────────────
const resetA4h = { ...config, heure_reset: 4 } as Config;
verifier('reset à 4h : 03h00 à Paris compte encore comme la veille', cleJour(new Date('2026-07-21T01:00:00Z'), resetA4h) === '2026-07-20');
verifier('reset à 4h : 05h00 à Paris compte comme le jour même', cleJour(new Date('2026-07-21T03:00:00Z'), resetA4h) === '2026-07-21');

// ── Changement d'heure (le cas qui casse les implémentations naïves) ───────
// Fin octobre 2026, Paris repasse en UTC+1 dans la nuit du samedi 24 au dimanche 25.
verifier(
  'passage à l\'heure d\'hiver : 23h30 le 25/10 reste le 25/10',
  cleJour(new Date('2026-10-25T22:30:00Z'), config) === '2026-10-25',
);

// ── Prix escaladant des changements de perso (§3) ──────────────────────────
// Le compteur `changements_restants` descend sous zéro pour mémoriser les changements
// payants déjà effectués : c'est lui qui fait monter le prix, sans colonne dédiée.
verifier('3 changements restants → gratuit', prixProchainChangement(3, config) === 0);
verifier('1 changement restant → encore gratuit', prixProchainChangement(1, config) === 0);
verifier('quota épuisé (0) → 1er payant à 20', prixProchainChangement(0, config) === 20);
verifier('après 1 payant (-1) → 40', prixProchainChangement(-1, config) === 40);
verifier('après 2 payants (-2) → 60', prixProchainChangement(-2, config) === 60);
verifier('après 3 payants (-3) → plafonné à 60', prixProchainChangement(-3, config) === 60);
verifier('après 10 payants (-10) → toujours 60', prixProchainChangement(-10, config) === 60);

// La remise à zéro hebdomadaire doit effacer l'escalade, pas seulement rendre le quota.
const escaladeEffacee = calculerRecharges({
  maintenant: new Date('2026-07-20T10:00:00Z'),   // lundi
  derniereRechargeEnergie: new Date('2026-07-19T10:00:00Z'),
  derniereRechargeChangements: new Date('2026-07-12T10:00:00Z'), // semaine précédente
  energieActuelle: 0, changementsActuels: -4,     // joueur en pleine escalade
  config,
});
verifier(
  'la remise à zéro hebdo efface l\'escalade de prix',
  escaladeEffacee.changements_restants === 3 && prixProchainChangement(escaladeEffacee.changements_restants, config) === 0,
);

console.log(echecs === 0
  ? '\n✅ Tous les contrôles passent.'
  : `\n❌ ${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
