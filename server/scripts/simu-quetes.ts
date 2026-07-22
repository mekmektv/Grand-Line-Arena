// GRAND LINE ARENA — SIMULATION ÉCONOMIQUE DES QUÊTES (§4 + §8).
//
//   node server/scripts/simu-quetes.ts
//
// Pourquoi ce script : les récompenses de quêtes ont été posées le 21/07/2026 sans passer par
// les simulations d'économie du §4. La récompense hebdomadaire (200) en particulier n'a JAMAIS
// été chiffrée. Ce script mesure ce que les quêtes ajoutent vraiment au revenu d'un joueur,
// selon son assiduité, et vérifie que les cibles du §4 tiennent toujours.
//
// Logique pure : ni base, ni horloge. Les valeurs testées sont recopiées de `quetes_catalogue`
// et de `config` — c'est justement l'objet du script de les juger, elles ne peuvent donc pas
// être lues comme des vérités.

// ── Les valeurs actuellement en base, celles qu'on met à l'épreuve ──────────
const GAIN_VICTOIRE = 20;      // config.gain_combat_gagne
const GAIN_DEFAITE = 8;        // config.gain_combat_perdu
const CONNEXION_QUOTIDIENNE = 30; // §4 "Connexion quotidienne (hors live)"
const ENERGIE_MAX = 10;        // config.energie_max
const COUT_TIRAGE = 100;       // config.cout_tirage_perso
const COUT_COFFRE = 35;        // config.cout_coffre_equipement

const QUETE_JOUR_RECOMPENSE = 50;   // les deux quêtes 'jour' actives valent 50
const QUETE_JOUR_OBJECTIF_VICTOIRES = 3;  // "Gagner 3 combats"
const QUETE_SEMAINE_RECOMPENSE = 200;     // ⚠️ jamais chiffrée
const QUETE_SEMAINE_OBJECTIF = 20;        // "Gagner 20 combats cette semaine"

/** Un profil de joueur : à quel point il est assidu. */
interface Profil {
  nom: string;
  combatsParJour: number;
  joursParSemaine: number;
  winrate: number;
}

const PROFILS: Profil[] = [
  { nom: 'Assidu    (10 combats, 7j/7)', combatsParJour: 10, joursParSemaine: 7, winrate: 0.5 },
  { nom: 'Régulier  (6 combats, 5j/7)', combatsParJour: 6, joursParSemaine: 5, winrate: 0.5 },
  { nom: 'Occasionnel (3 combats, 3j/7)', combatsParJour: 3, joursParSemaine: 3, winrate: 0.45 },
];

const eur = (n: number) => n.toLocaleString('fr-FR');
const pct = (n: number) => `${(n * 100).toFixed(0)} %`;

// ── 1. Revenu de base, hors quêtes ─────────────────────────────────────────
function revenuJourSansQuetes(p: Profil): number {
  const victoires = p.combatsParJour * p.winrate;
  const defaites = p.combatsParJour - victoires;
  return victoires * GAIN_VICTOIRE + defaites * GAIN_DEFAITE + CONNEXION_QUOTIDIENNE;
}

console.log('\n═══ SIMULATION ÉCONOMIQUE DES QUÊTES (§4 + §8) ═══\n');

console.log('── 1. Ce que rapportent les quêtes, en part du revenu ─────────────────────');
console.log('   (la quête du jour tourne entre "Jouer 10 combats" et "Gagner 3 combats")\n');
console.log('   Profil                        | base/sem | + jour | + hebdo |  total | part quêtes');
console.log('   ------------------------------|----------|--------|---------|--------|------------');

const resultats = PROFILS.map((p) => {
  const base = revenuJourSansQuetes(p) * p.joursParSemaine;

  // La quête "jouer 10 combats" n'est atteignable que si le joueur a l'énergie ET la joue.
  // La quête "gagner 3 combats" l'est dès qu'il gagne 3 fois dans la journée.
  const victoiresJour = p.combatsParJour * p.winrate;
  const jourJouerOk = p.combatsParJour >= ENERGIE_MAX;
  const jourGagnerOk = victoiresJour >= QUETE_JOUR_OBJECTIF_VICTOIRES;
  // Une chance sur deux de tomber sur l'une ou l'autre (rotation déterministe sur l'index de jour).
  const tauxReussiteJour = ((jourJouerOk ? 1 : 0) + (jourGagnerOk ? 1 : 0)) / 2;
  const gainJour = QUETE_JOUR_RECOMPENSE * tauxReussiteJour * p.joursParSemaine;

  const victoiresSemaine = victoiresJour * p.joursParSemaine;
  const hebdoOk = victoiresSemaine >= QUETE_SEMAINE_OBJECTIF;
  const gainHebdo = hebdoOk ? QUETE_SEMAINE_RECOMPENSE : 0;

  const total = base + gainJour + gainHebdo;
  const partQuetes = (gainJour + gainHebdo) / total;

  console.log(
    `   ${p.nom.padEnd(29)} | ${String(eur(base)).padStart(8)} | ${String(eur(gainJour)).padStart(6)} `
    + `| ${String(eur(gainHebdo)).padStart(7)} | ${String(eur(total)).padStart(6)} | ${pct(partQuetes).padStart(11)}`,
  );

  return { p, base, gainJour, gainHebdo, total, victoiresSemaine, hebdoOk };
});

// ── 2. Le point qui coince : à qui profite la quête hebdo ? ────────────────
console.log('\n── 2. La quête hebdo « gagner 20 combats » ────────────────────────────────');
console.log(`   Objectif : ${QUETE_SEMAINE_OBJECTIF} victoires · récompense : ${QUETE_SEMAINE_RECOMPENSE} Berrys\n`);
console.log('   Profil                        | victoires/sem | atteinte ? | atteinte le');
console.log('   ------------------------------|---------------|------------|-------------');

for (const r of resultats) {
  const victoiresJour = r.p.combatsParJour * r.p.winrate;
  const joursNecessaires = QUETE_SEMAINE_OBJECTIF / victoiresJour;
  const quand = r.hebdoOk ? `jour ${Math.ceil(joursNecessaires)}` : '—';
  console.log(
    `   ${r.p.nom.padEnd(29)} | ${r.victoiresSemaine.toFixed(1).padStart(13)} `
    + `| ${(r.hebdoOk ? 'OUI' : 'NON').padStart(10)} | ${quand.padStart(11)}`,
  );
}

// ── 3. Traduction en tirages, la seule unité qui parle au joueur ───────────
console.log('\n── 3. En tirages perso (100 Berrys) et coffres (35 Berrys) ────────────────\n');
console.log('   Profil                        | tirages/sem | dont dus aux quêtes | coffres/sem');
console.log('   ------------------------------|-------------|---------------------|------------');

for (const r of resultats) {
  const tirages = r.total / COUT_TIRAGE;
  const tiragesQuetes = (r.gainJour + r.gainHebdo) / COUT_TIRAGE;
  const coffres = r.total / COUT_COFFRE;
  console.log(
    `   ${r.p.nom.padEnd(29)} | ${tirages.toFixed(1).padStart(11)} `
    + `| ${tiragesQuetes.toFixed(1).padStart(19)} | ${coffres.toFixed(1).padStart(11)}`,
  );
}

// ── 4. Confrontation aux cibles écrites du §4 ──────────────────────────────
console.log('\n── 4. Les cibles du §4 tiennent-elles ? ───────────────────────────────────\n');

const assidu = resultats[0];
const revenuJourAssidu = assidu.base / assidu.p.joursParSemaine + QUETE_JOUR_RECOMPENSE;
const cible = 220;
const ecart = revenuJourAssidu - cible;
console.log(`   §4 : "joueur non-live actif tous les jours → ~${cible} Berrys/jour"`);
console.log(`   Mesuré (hors hebdo) : ${revenuJourAssidu.toFixed(0)} Berrys/jour  → écart ${ecart >= 0 ? '+' : ''}${ecart.toFixed(0)}`);
console.log(`   ${Math.abs(ecart) <= 5 ? '✅ conforme' : '⚠️  à revoir'}\n`);

const cibleTiragesSemaine = 20;
const tiragesAssidu = assidu.total / COUT_TIRAGE;
console.log(`   §4 : "joueur régulier + 3 lives/semaine → ~${cibleTiragesSemaine} tirages/semaine"`);
console.log(`   Mesuré pour l'assidu SANS live : ${tiragesAssidu.toFixed(1)} tirages/semaine`);
console.log(`   ${tiragesAssidu < cibleTiragesSemaine ? '✅ le live garde sa valeur (l\'assidu hors live reste en dessous)' : '⚠️  le hors-live rattrape le live, la présence ne sert plus à rien'}\n`);

// ── 5. Les succès de collection, versés une seule fois ─────────────────────
const COLLECTION = [150, 250, 500, 500, 300, 300, 300, 300, 300, 300];
const totalCollection = COLLECTION.reduce((a, b) => a + b, 0);
console.log('── 5. Succès de collection (versés UNE fois dans la vie du compte) ────────\n');
console.log(`   Total si tout est complété : ${eur(totalCollection)} Berrys = ${(totalCollection / COUT_TIRAGE).toFixed(0)} tirages`);
console.log(`   Rapporté à une semaine d'assidu : ${pct(totalCollection / assidu.total)} de son revenu hebdo`);
console.log('   → un bonus ponctuel, pas un revenu. Aucun risque d\'inflation.\n');

// ── 6. Scénario correctif proposé ──────────────────────────────────────────
// Le défaut mis en évidence plus haut n'est pas l'inflation : c'est que le système de quêtes
// donne +32 % au joueur le plus assidu et +0 % à l'occasionnel. Il CREUSE l'écart au lieu de
// servir de plancher. Une quête que seul le meilleur joueur peut finir ne récompense pas
// l'effort, elle récompense le temps libre.
//
// Principe du correctif : les quêtes du JOUR sont un plancher, atteignable par tous ;
// la quête de la SEMAINE reste l'objectif d'assiduité, mais visable par un joueur régulier.
interface Scenario {
  nom: string;
  jourObjectifCombats: number;
  jourObjectifVictoires: number;
  jourRecompense: number;
  semaineObjectif: number;
  semaineRecompense: number;
}

const ACTUEL: Scenario = {
  nom: 'Actuel',
  jourObjectifCombats: ENERGIE_MAX, jourObjectifVictoires: QUETE_JOUR_OBJECTIF_VICTOIRES,
  jourRecompense: QUETE_JOUR_RECOMPENSE,
  semaineObjectif: QUETE_SEMAINE_OBJECTIF, semaineRecompense: QUETE_SEMAINE_RECOMPENSE,
};

// Retenu par l'utilisateur le 22/07/2026 : les quêtes du jour gardent leurs objectifs
// (elles servent de rythme quotidien, pas de plancher universel), seule la quête hebdo est
// assouplie. Conséquence assumée : l'occasionnel reste à 0 % de gains de quêtes.
const PROPOSE: Scenario = {
  nom: 'Retenu',
  jourObjectifCombats: ENERGIE_MAX,
  jourObjectifVictoires: QUETE_JOUR_OBJECTIF_VICTOIRES,
  jourRecompense: QUETE_JOUR_RECOMPENSE,
  // 14 et pas 16 : le régulier fait 15 victoires/semaine, un objectif à 16 le laissait dehors
  // pour UNE victoire et ne changeait donc rien pour personne. 14 lui laisse une marge d'une
  // victoire, de quoi absorber une mauvaise série sans rater la quête.
  semaineObjectif: 14,      // au lieu de 20
  semaineRecompense: 160,   // au lieu de 200
};

function evaluer(p: Profil, s: Scenario) {
  const base = revenuJourSansQuetes(p) * p.joursParSemaine;
  const victoiresJour = p.combatsParJour * p.winrate;
  const tauxJour = ((p.combatsParJour >= s.jourObjectifCombats ? 1 : 0)
    + (victoiresJour >= s.jourObjectifVictoires ? 1 : 0)) / 2;
  const gainJour = s.jourRecompense * tauxJour * p.joursParSemaine;
  const gainHebdo = victoiresJour * p.joursParSemaine >= s.semaineObjectif ? s.semaineRecompense : 0;
  const total = base + gainJour + gainHebdo;
  return { total, partQuetes: (gainJour + gainHebdo) / total };
}

console.log('── 6. Scénario correctif proposé ─────────────────────────────────────────\n');
console.log(`   Quête du jour   : "jouer ${PROPOSE.jourObjectifCombats} combats" / "gagner ${PROPOSE.jourObjectifVictoires} combat" — ${PROPOSE.jourRecompense} Berrys (inchangé)`);
console.log(`   Quête hebdo     : "gagner ${PROPOSE.semaineObjectif} combats" — ${PROPOSE.semaineRecompense} Berrys\n`);
console.log('   Profil                        |   actuel |  proposé |  écart | part quêtes');
console.log('   ------------------------------|----------|----------|--------|------------');

for (const p of PROFILS) {
  const a = evaluer(p, ACTUEL);
  const b = evaluer(p, PROPOSE);
  const delta = b.total - a.total;
  console.log(
    `   ${p.nom.padEnd(29)} | ${String(eur(Math.round(a.total))).padStart(8)} `
    + `| ${String(eur(Math.round(b.total))).padStart(8)} | ${(delta >= 0 ? '+' : '') + Math.round(delta)}`.padEnd(10)
    + `| ${pct(b.partQuetes).padStart(11)}`,
  );
}

const assiduProp = evaluer(PROFILS[0], PROPOSE);
const occasProp = evaluer(PROFILS[2], PROPOSE);
const assiduAct = evaluer(PROFILS[0], ACTUEL);
const occasAct = evaluer(PROFILS[2], ACTUEL);
console.log(`\n   Écart assidu / occasionnel — actuel : ×${(assiduAct.total / occasAct.total).toFixed(1)}`);
console.log(`                                proposé : ×${(assiduProp.total / occasProp.total).toFixed(1)}`);
console.log(`   Tirages/semaine de l'assidu : ${(assiduProp.total / COUT_TIRAGE).toFixed(1)} (cible §4 hors live : < ${cibleTiragesSemaine})`);
console.log(`   ${assiduProp.total / COUT_TIRAGE < cibleTiragesSemaine ? '✅ le live garde sa valeur' : '⚠️  le hors-live rattrape le live'}\n`);

