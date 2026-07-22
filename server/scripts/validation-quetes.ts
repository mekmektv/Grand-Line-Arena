// GRAND LINE ARENA — VALIDATION DES QUÊTES (§8).
//
//   node server/scripts/validation-quetes.ts
//
// Ne touche NI la base NI l'horloge : quetes.ts est de la logique pure, l'instant et les mesures
// lui sont passés en paramètres. Ce script peut donc tourner n'importe quand et rester stable.
//
// Ce qu'il vérifie, et pourquoi ça mérite un test :
//  - la quête du jour est DÉTERMINISTE (même jour = même quête pour tout le monde) et TOURNE
//    d'un jour à l'autre. Un bug de rotation, c'est soit toujours la même quête, soit une quête
//    qui change à chaque rafraîchissement de page.
//  - une quête de combat ne compte que sur SA période : une hebdo ne doit pas se remplir avec
//    les combats du jour, ni l'inverse.
//  - l'objectif d'une quête de collection est DYNAMIQUE (le nombre de persos concernés) et un
//    set vide (0 perso) n'est jamais "accompli" — sinon on offrirait une récompense gratuite.
//  - la période de réclamation est la bonne : jour / semaine / 'permanent'.

import type { Config, QueteDef } from '../src/types.ts';
import {
  evaluerQuete, periodeQuete, queteDeLaSemaine, queteDuJour, quetesCollection,
  type MesuresQuetes,
} from '../src/quetes.ts';

const catalogue: QueteDef[] = [
  { cle: 'jour_a', categorie: 'jour', type: 'combats_joues', titre: 'Jouer 10', recompense: 50, objectif: 10, actif: true },
  { cle: 'jour_b', categorie: 'jour', type: 'combats_gagnes', titre: 'Gagner 3', recompense: 50, objectif: 3, actif: true },
  { cle: 'jour_off', categorie: 'jour', type: 'coffres_ouverts', titre: 'Coffre', recompense: 50, objectif: 1, actif: false },
  { cle: 'sem_a', categorie: 'semaine', type: 'combats_gagnes', titre: 'Gagner 20', recompense: 200, objectif: 20, actif: true },
  { cle: 'col_haki', categorie: 'collection', type: 'collection_classe', titre: 'Haki', recompense: 300, filtre: 'Haki', actif: true },
  { cle: 'col_epique', categorie: 'collection', type: 'collection_rarete', titre: 'Épiques', recompense: 500, filtre: 'Epique', actif: true },
];

const config = {
  fuseau_horaire: 'Europe/Paris',
  heure_reset: 0,
  jour_reset_hebdo: 1, // lundi
  quetes_catalogue: catalogue,
} as unknown as Config;

let echecs = 0;
function verifier(nom: string, condition: boolean): void {
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'} │ ${nom}`);
  if (!condition) echecs += 1;
}

// ── Quête du jour : déterministe et tournante ──────────────────────────────
const lundi = new Date('2026-07-20T10:00:00Z');
const mardi = new Date('2026-07-21T10:00:00Z');
const mardiSoir = new Date('2026-07-21T20:00:00Z');

const qLundi = queteDuJour(config, lundi);
const qMardi = queteDuJour(config, mardi);
verifier('la quête du jour est la même à deux heures du même jour',
  queteDuJour(config, mardi)?.cle === queteDuJour(config, mardiSoir)?.cle);
verifier('la quête du jour change d\'un jour à l\'autre', qLundi?.cle !== qMardi?.cle);
verifier('la quête du jour ignore les quêtes inactives (jamais "jour_off")',
  qLundi?.cle !== 'jour_off' && qMardi?.cle !== 'jour_off');
verifier('la quête du jour est bien une quête de catégorie "jour"', qLundi?.categorie === 'jour');

// ── Quête de la semaine ────────────────────────────────────────────────────
verifier('la quête de la semaine est celle attendue', queteDeLaSemaine(config, lundi)?.cle === 'sem_a');
verifier('la quête de la semaine est stable dans la semaine',
  queteDeLaSemaine(config, lundi)?.cle === queteDeLaSemaine(config, mardi)?.cle);

// ── Les mesures de test ────────────────────────────────────────────────────
const mesures: MesuresQuetes = {
  combats_joues_jour: 10,
  combats_gagnes_jour: 2,
  coffres_ouverts_jour: 0,
  combats_joues_semaine: 25,
  combats_gagnes_semaine: 20,
  coffres_ouverts_semaine: 0,
  collection_classe: { Haki: { possede: 3, total: 3 }, Logia: { possede: 1, total: 2 } },
  collection_rarete: { Epique: { possede: 0, total: 1 }, Commun: { possede: 5, total: 5 } },
};

// ── Une quête de combat ne compte que sur sa période ───────────────────────
const jourJouer = catalogue.find((q) => q.cle === 'jour_a')!;
const jourGagner = catalogue.find((q) => q.cle === 'jour_b')!;
const semGagner = catalogue.find((q) => q.cle === 'sem_a')!;

verifier('"Jouer 10 combats" (jour) : 10/10 accomplie', (() => {
  const e = evaluerQuete(jourJouer, mesures);
  return e.progression === 10 && e.objectif === 10 && e.accomplie;
})());
verifier('"Gagner 3 combats" (jour) : 2/3 pas encore accomplie', (() => {
  const e = evaluerQuete(jourGagner, mesures);
  return e.progression === 2 && e.objectif === 3 && !e.accomplie;
})());
verifier('"Gagner 20 combats" (semaine) compte les victoires de la SEMAINE (20), pas du jour (2)', (() => {
  const e = evaluerQuete(semGagner, mesures);
  return e.progression === 20 && e.accomplie;
})());

// ── Collection : objectif dynamique, set vide jamais accompli ───────────────
const colHaki = catalogue.find((q) => q.cle === 'col_haki')!;
const colEpique = catalogue.find((q) => q.cle === 'col_epique')!;

verifier('"toute la classe Haki" : 3/3 accomplie', (() => {
  const e = evaluerQuete(colHaki, mesures);
  return e.progression === 3 && e.objectif === 3 && e.accomplie;
})());
verifier('"tous les Épiques" : objectif dynamique = 1 (nb d\'Épiques), 0/1 pas accomplie', (() => {
  const e = evaluerQuete(colEpique, mesures);
  return e.progression === 0 && e.objectif === 1 && !e.accomplie;
})());
verifier('un set vide (aucun perso de cette classe) n\'est jamais accompli', (() => {
  const vide: MesuresQuetes = { ...mesures, collection_classe: {} };
  return !evaluerQuete(colHaki, vide).accomplie;
})());

// ── quetesCollection ne renvoie que les quêtes de collection actives ───────
verifier('quetesCollection renvoie exactement les 2 succès de collection',
  quetesCollection(config).map((q) => q.cle).sort().join(',') === 'col_epique,col_haki');

// ── Période de réclamation ─────────────────────────────────────────────────
verifier('période d\'une quête du jour = la journée', periodeQuete(jourJouer, lundi, config) === '2026-07-20');
verifier('période d\'une quête hebdo = le lundi de la semaine', periodeQuete(semGagner, mardi, config) === '2026-07-20');
verifier('période d\'un succès de collection = "permanent"', periodeQuete(colHaki, lundi, config) === 'permanent');

console.log(echecs === 0
  ? '\n✅ Tous les contrôles passent.'
  : `\n❌ ${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
