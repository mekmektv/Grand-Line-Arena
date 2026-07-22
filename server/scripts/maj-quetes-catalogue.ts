// GRAND LINE ARENA — met à jour `config.quetes_catalogue` d'après la simulation d'économie
// du 22/07/2026 (voir server/scripts/simu-quetes.ts).
//
//   node server/scripts/maj-quetes-catalogue.ts
//
// Deux changements :
//   · la quête hebdo passe de "gagner 20 pour 200" à "gagner 14 pour 160". À 20, elle était
//     bouclée dès le jour 4 par un assidu et hors d'atteinte de tous les autres ; à 14, le
//     joueur régulier (15 victoires/semaine) la décroche avec une victoire de marge.
//   · la quête "ouvrir 1 coffre" est retirée du catalogue. Elle y dormait avec actif:false
//     faute d'un compteur de coffres ouverts en base — autant ne pas laisser traîner une
//     entrée morte que personne ne peut expliquer dans six mois.
//
// Passe par l'API REST et non par du SQL à coller : `config` est une table de valeurs, pas du
// DDL (voir la règle d'or du CLAUDE.md).
import '../src/load-env.ts';
import { supabaseSelectUn, supabaseUpdate } from '../src/supabase.ts';

interface Quete {
  cle: string; categorie: string; type: string; titre: string;
  recompense: number; objectif?: number; filtre?: string; actif: boolean;
}

const ligne = await supabaseSelectUn<{ valeur: Quete[] }>(
  'config', { cle: 'eq.quetes_catalogue', select: 'valeur' },
);
if (!ligne) throw new Error('config.quetes_catalogue introuvable.');

const avant = ligne.valeur;
console.log(`  Catalogue actuel : ${avant.length} quêtes`);

// ⚠️ La clé garde son nom d'origine `sem_gagner_20` alors que l'objectif passe à 14.
// C'est volontaire : la clé est l'identifiant de RÉCLAMATION (table quetes_reclamees), et la
// renommer déclasse toutes les réclamations déjà enregistrées — un joueur ayant déjà touché sa
// quête hebdo cette semaine pourrait la réclamer une seconde fois. Vérifié en base : une
// réclamation `sem_gagner_20` existait bien pour la semaine en cours quand ce script a été écrit.
// Le nom d'une clé est un identifiant opaque, pas une description.
const CLE_HEBDO = 'sem_gagner_20';

const apres = avant
  .filter((q) => q.cle !== 'jour_coffre_1')
  .map((q) => (q.categorie === 'semaine'
    ? {
      ...q,
      cle: CLE_HEBDO,
      titre: 'Gagner 14 combats cette semaine',
      objectif: 14,
      recompense: 160,
    }
    : q));

const retiree = avant.length - apres.length;
const hebdo = apres.find((q) => q.categorie === 'semaine');

console.log(`  Quêtes retirées  : ${retiree}`);
console.log(`  Quête hebdo      : "${hebdo?.titre}" → objectif ${hebdo?.objectif}, récompense ${hebdo?.recompense}`);

await supabaseUpdate('config', { cle: 'eq.quetes_catalogue' }, {
  valeur: apres,
  description: 'Catalogue des quêtes (§8) : jour (rotation quotidienne), semaine, et succès de '
    + 'collection permanents. Montants revus le 22/07/2026 d\'après simu-quetes.ts.',
});

const verif = await supabaseSelectUn<{ valeur: Quete[] }>(
  'config', { cle: 'eq.quetes_catalogue', select: 'valeur' },
);
console.log(`\n  ✅ Écrit en base : ${verif!.valeur.length} quêtes`);
for (const q of verif!.valeur.filter((x) => x.categorie !== 'collection')) {
  console.log(`     ${q.cle.padEnd(16)} ${q.titre.padEnd(42)} ${String(q.recompense).padStart(4)} Berrys  ${q.actif ? '' : '(inactif)'}`);
}
