// GRAND LINE ARENA — VALIDATION DE L'ÉQUIPEMENT (§4ter).
//
//   node server/scripts/validation-equipement.ts
//
// Vérifie, sur les VRAIES valeurs du seed (jamais des chiffres recopiés ici) :
//  - le catalogue : 18 objets, 3 profils par type × rareté, et surtout un budget IDENTIQUE
//    entre tous les objets d'une même rareté (c'est ce qui rend les profils interchangeables)
//  - les taux d'un coffre (rareté, et le 50/50 Chapeau/Tenue)
//  - le sacrifice : N objets d'une rareté donnent un coffre qui ne sort JAMAIS en dessous
//    de la rareté au-dessus, et tout lot invalide est refusé AVANT destruction
//  - le recyclage : bons Berrys
//  - le bonus en combat : plat, additif, identique quel que soit le profil du perso
//  - le plafond : un set complet doit rester sous un niveau de perso
//
// Tolérance sur les taux : 0,3 point de pourcentage. Avec 200 000 ouvertures, un taux mal
// câblé se voit à plusieurs points — largement détecté.

import { chargerConfig, chargerPerso, RARETES_TIRAGE } from '../src/config.ts';
import {
  ouvrirCoffre, recyclerObjet, bonusEquipement, budgetObjet, sacrificesPossibles,
  validerSacrifice, RARETES_EQUIPEMENT, TYPES_EQUIPEMENT,
} from '../src/equipement.ts';
import { calculerStats } from '../src/stats.ts';
import type { ObjetEquipement, Rarete, RareteEquipement } from '../src/types.ts';
import { lireConfigDepuisSeed, lirePersosDepuisSeed } from './lire-seed.ts';

const N = 200_000;
const TOLERANCE_PTS = 0.3;

const config = chargerConfig(lireConfigDepuisSeed());
const persos = lirePersosDepuisSeed().map(chargerPerso);
const catalogue = config.equipement_catalogue;

let erreurs = 0;
const ok = (condition: boolean, message: string) => {
  console.log(`  ${condition ? '✓' : '✗'} ${message}`);
  if (!condition) erreurs++;
};

console.log(`\n=== VALIDATION ÉQUIPEMENT — ${N.toLocaleString('fr-FR')} coffres ===\n`);

// ---------------------------------------------------------------------------
// 1) Le catalogue
// ---------------------------------------------------------------------------
console.log('--- 1) Le catalogue des objets ---');

ok(catalogue.length === 18, `18 objets au catalogue (§4ter : 3 Chapeaux + 3 Tenues par rareté) — trouvé ${catalogue.length}`);

const budgetParRarete = new Map<RareteEquipement, number>();
for (const r of RARETES_EQUIPEMENT) {
  const groupe = catalogue.filter((o) => o.rarete === r);
  budgetParRarete.set(r, budgetObjet(groupe[0], config));
  for (const type of TYPES_EQUIPEMENT) {
    const sousGroupe = groupe.filter((o) => o.type === type);
    ok(sousGroupe.length === 3, `${r} / ${type} : 3 profils disponibles — trouvé ${sousGroupe.length}`);
    const profils = new Set(sousGroupe.map((o) => o.profil));
    ok(profils.size === 3, `${r} / ${type} : les 3 profils sont distincts (${[...profils].join(', ')})`);
  }
}

console.log('\n  Budget par objet (doit être constant dans une rareté) :');
for (const r of RARETES_EQUIPEMENT) {
  const groupe = catalogue.filter((o) => o.rarete === r);
  const budgets = groupe.map((o) => budgetObjet(o, config));
  const tous = budgets.every((b) => Math.abs(b - budgets[0]) < 1e-9);
  console.log(`    ${r.padEnd(5)} : ${budgets[0].toFixed(2)} pts  (${groupe.map((o) => `${o.hp}/${o.attack}`).join('  ')})`);
  ok(tous, `${r} : les 6 objets coûtent exactement le même budget`);
}

for (let i = 1; i < RARETES_EQUIPEMENT.length; i++) {
  const bas = budgetParRarete.get(RARETES_EQUIPEMENT[i - 1])!;
  const haut = budgetParRarete.get(RARETES_EQUIPEMENT[i])!;
  ok(haut > bas, `${RARETES_EQUIPEMENT[i]} (${haut}) vaut plus que ${RARETES_EQUIPEMENT[i - 1]} (${bas})`);
}

// §4ter : l'équipement ne donne QUE des PV et de l'Attack.
ok(
  catalogue.every((o) => Object.keys(o).every((k) => ['cle', 'type', 'rarete', 'profil', 'nom', 'hp', 'attack'].includes(k))),
  '§4ter : aucun objet ne porte autre chose que des PV et de l\'Attack (ni esquive, ni crit)',
);

// ---------------------------------------------------------------------------
// 2) Les taux d'un coffre payé en Berrys
// ---------------------------------------------------------------------------
console.log('\n--- 2) Les taux d\'un coffre (payé en Berrys) ---');

const compteRarete = new Map<RareteEquipement, number>(RARETES_EQUIPEMENT.map((r) => [r, 0]));
const compteType = new Map<string, number>(TYPES_EQUIPEMENT.map((t) => [t, 0]));
const compteObjet = new Map<string, number>(catalogue.map((o) => [o.cle, 0]));

for (let i = 0; i < N; i++) {
  const r = ouvrirCoffre({
    berrysDisponibles: config.cout_coffre_equipement,
    paiement: { mode: 'berrys' },
    config,
    seed: i,
  });
  compteRarete.set(r.objet.rarete, compteRarete.get(r.objet.rarete)! + 1);
  compteType.set(r.objet.type, compteType.get(r.objet.type)! + 1);
  compteObjet.set(r.objet.cle, compteObjet.get(r.objet.cle)! + 1);
}

for (const r of RARETES_EQUIPEMENT) {
  const mesure = 100 * compteRarete.get(r)! / N;
  const attendu = 100 * config.drop_rates_equipement[r];
  ok(Math.abs(mesure - attendu) <= TOLERANCE_PTS, `${r.padEnd(5)} : ${mesure.toFixed(2)} % (attendu ${attendu.toFixed(2)} %)`);
}
for (const t of TYPES_EQUIPEMENT) {
  const mesure = 100 * compteType.get(t)! / N;
  ok(Math.abs(mesure - 50) <= TOLERANCE_PTS, `${t.padEnd(7)} : ${mesure.toFixed(2)} % (attendu 50 % — §4ter)`);
}

console.log('\n  Répartition dans chaque case type × rareté (attendu : 1/3 chacun) :');
for (const r of RARETES_EQUIPEMENT) {
  for (const t of TYPES_EQUIPEMENT) {
    const groupe = catalogue.filter((o) => o.rarete === r && o.type === t);
    const total = groupe.reduce((s, o) => s + compteObjet.get(o.cle)!, 0);
    const parts = groupe.map((o) => 100 * compteObjet.get(o.cle)! / total);
    const ecart = Math.max(...parts.map((p) => Math.abs(p - 100 / 3)));
    // Tolérance calée sur la taille réelle de l'échantillon, pas sur un chiffre rond : la
    // case Bleu ne reçoit que 7 % des coffres, ses proportions sont donc bien plus bruitées
    // que celles des Gris. 4 écarts-types = un faux échec tous les ~16 000 lancements.
    const marge = 4 * 100 * Math.sqrt((1 / 3) * (2 / 3) / total);
    ok(ecart <= marge, `${r.padEnd(5)} ${t.padEnd(7)} : ${parts.map((p) => p.toFixed(1) + ' %').join(' / ')} (marge ±${marge.toFixed(1)} pt sur ${total.toLocaleString('fr-FR')} tirages)`);
  }
}

// ---------------------------------------------------------------------------
// 3) Le sacrifice — N objets d'une rareté contre un coffre garanti au-dessus
// ---------------------------------------------------------------------------
console.log('\n--- 3) Le coffre garanti obtenu en sacrifiant des objets ---');

for (let i = 0; i < RARETES_EQUIPEMENT.length - 1; i++) {
  const sacrifiee = RARETES_EQUIPEMENT[i];
  const cible = RARETES_EQUIPEMENT[i + 1];
  const requis = config.compteur_equipement[sacrifiee] ?? 0;
  if (requis <= 0) { console.log(`  · ${sacrifiee} → sacrifice désactivé en config (seuil 0)`); continue; }

  const dispo = catalogue.filter((o) => o.rarete === sacrifiee);
  const lot = Array.from({ length: requis }, (_, k) => dispo[k % dispo.length]);
  ok(validerSacrifice(lot, config) === cible, `${requis} objets ${sacrifiee} → coffre garanti ${cible}`);

  const compte = new Map<RareteEquipement, number>(RARETES_EQUIPEMENT.map((r) => [r, 0]));
  let jamaisSous = true;
  const M = 50_000;
  for (let k = 0; k < M; k++) {
    const r = ouvrirCoffre({
      berrysDisponibles: 0,
      paiement: { mode: 'sacrifice', objets: lot },
      config,
      seed: k + 1_000_000,
    });
    compte.set(r.objet.rarete, compte.get(r.objet.rarete)! + 1);
    if (RARETES_EQUIPEMENT.indexOf(r.objet.rarete) < RARETES_EQUIPEMENT.indexOf(cible)) jamaisSous = false;
    if (k === 0) ok(r.berrys_apres === 0, 'un coffre payé par sacrifice ne coûte aucun Berry');
  }
  ok(jamaisSous, `jamais en dessous de ${cible} (sur ${M.toLocaleString('fr-FR')} ouvertures)`);

  const candidates = RARETES_EQUIPEMENT.slice(RARETES_EQUIPEMENT.indexOf(cible));
  const somme = candidates.reduce((s, r) => s + config.drop_rates_equipement[r], 0);
  for (const r of candidates) {
    const mesure = 100 * compte.get(r)! / M;
    const attendu = 100 * config.drop_rates_equipement[r] / somme;
    ok(Math.abs(mesure - attendu) <= 0.6, `  ${r.padEnd(5)} : ${mesure.toFixed(2)} % (attendu ${attendu.toFixed(2)} % après renormalisation)`);
  }

  // Tout lot invalide doit être refusé AVANT que la moindre destruction ait lieu.
  const refuse = (lotTest: ObjetEquipement[], quoi: string) => {
    try { validerSacrifice(lotTest, config); ok(false, `refusé : ${quoi}`); }
    catch { ok(true, `refusé : ${quoi}`); }
  };
  refuse(lot.slice(0, requis - 1), `${requis - 1} objets au lieu de ${requis}`);
  refuse([...lot, lot[0]], `${requis + 1} objets au lieu de ${requis}`);
  refuse([...lot.slice(0, requis - 1), catalogue.find((o) => o.rarete !== sacrifiee)!], 'un lot de raretés mélangées');
  refuse([], 'un lot vide');
}

// La meilleure rareté n'a rien au-dessus : elle ne doit jamais être sacrifiable.
{
  const meilleure = RARETES_EQUIPEMENT[RARETES_EQUIPEMENT.length - 1];
  const lot = catalogue.filter((o) => o.rarete === meilleure).slice(0, 4);
  try { validerSacrifice(lot, config); ok(false, `refusé : sacrifier des ${meilleure}`); }
  catch { ok(true, `refusé : sacrifier des ${meilleure} (rien au-dessus)`); }
}

try {
  ouvrirCoffre({
    berrysDisponibles: config.cout_coffre_equipement - 1,
    paiement: { mode: 'berrys' }, config, seed: 1,
  });
  ok(false, 'un coffre sans assez de Berrys est refusé');
} catch { ok(true, 'un coffre sans assez de Berrys est refusé'); }

// ---------------------------------------------------------------------------
// 4) Le recyclage et les sacrifices proposés à l'écran
// ---------------------------------------------------------------------------
console.log('\n--- 4) Recyclage et sacrifices proposés ---');

for (const r of RARETES_EQUIPEMENT) {
  const objet = catalogue.find((o) => o.rarete === r)!;
  const res = recyclerObjet(100, objet, config);
  ok(res.berrys_gagnes === config.recyclage_equipement[r], `${r.padEnd(5)} : +${res.berrys_gagnes} Berrys (config : ${config.recyclage_equipement[r]})`);
  ok(res.berrys_apres === 100 + res.berrys_gagnes, `${r.padEnd(5)} : le solde est bien crédité`);
}

{
  const seuilGris = config.compteur_equipement.Gris ?? 0;
  const inventaire = [
    ...Array.from({ length: seuilGris }, () => catalogue.find((o) => o.rarete === 'Gris')!),
    catalogue.find((o) => o.rarete === 'Vert')!,
  ];
  const sacrifices = sacrificesPossibles(inventaire, config);
  ok(sacrifices.length === RARETES_EQUIPEMENT.length - 1, `${sacrifices.length} sacrifice(s) proposé(s) — la meilleure rareté est exclue`);
  ok(!sacrifices.some((s) => s.rarete === 'Bleu'), 'aucun sacrifice proposé pour la meilleure rareté');
  const gris = sacrifices.find((s) => s.rarete === 'Gris')!;
  ok(gris.possible && gris.disponibles === seuilGris, `Gris : ${gris.disponibles}/${gris.requis} → possible`);
  const vert = sacrifices.find((s) => s.rarete === 'Vert')!;
  ok(!vert.possible, `Vert : ${vert.disponibles}/${vert.requis} → pas encore possible`);
  ok(
    sacrificesPossibles([], config).every((s) => !s.possible),
    'un inventaire vide ne propose aucun sacrifice réalisable',
  );
}

// ---------------------------------------------------------------------------
// 5) Le bonus en combat — la partie qui peut casser l'équilibrage
// ---------------------------------------------------------------------------
console.log('\n--- 5) Le bonus appliqué aux stats ---');

const set = (rarete: RareteEquipement): ObjetEquipement[] => [
  catalogue.find((o) => o.rarete === rarete && o.type === 'Chapeau' && o.profil === 'pv')!,
  catalogue.find((o) => o.rarete === rarete && o.type === 'Tenue' && o.profil === 'pv')!,
];

// Le bonus doit être PLAT : le même objet ajoute exactement autant de PV à un Tank qu'à un
// Bourrin. S'il passait par la racine carrée du profil, ce test tomberait.
const tank = persos.find((p) => p.profil === 'Tank')!;
const bourrin = persos.find((p) => p.profil === 'Bourrin')!;
for (const rarete of RARETES_EQUIPEMENT) {
  const objets = set(rarete);
  const attendu = bonusEquipement(objets);
  const dTank = {
    pv: calculerStats(tank, 1, config, objets).pv - calculerStats(tank, 1, config).pv,
    attack: calculerStats(tank, 1, config, objets).attack - calculerStats(tank, 1, config).attack,
  };
  const dBourrin = {
    pv: calculerStats(bourrin, 1, config, objets).pv - calculerStats(bourrin, 1, config).pv,
    attack: calculerStats(bourrin, 1, config, objets).attack - calculerStats(bourrin, 1, config).attack,
  };
  const exact = Math.abs(dTank.pv - attendu.hp) < 1e-9 && Math.abs(dBourrin.pv - attendu.hp) < 1e-9
    && Math.abs(dTank.attack - attendu.attack) < 1e-9 && Math.abs(dBourrin.attack - attendu.attack) < 1e-9;
  ok(exact, `set ${rarete.padEnd(5)} : +${attendu.hp} PV / +${attendu.attack} ATK, identique sur ${tank.nom} (Tank) et ${bourrin.nom} (Bourrin)`);
}

ok(
  bonusEquipement(undefined).hp === 0 && bonusEquipement([]).attack === 0,
  'sans équipement, le bonus est nul — un bot ou un perso nu n\'est pas affecté',
);

// ---------------------------------------------------------------------------
// 6) Le plafond — la vraie garantie d'équilibrage (§8 EQUILIBRAGE_FINAL)
// ---------------------------------------------------------------------------
console.log('\n--- 6) Le plafond de puissance ---');

const meilleureRarete = RARETES_EQUIPEMENT[RARETES_EQUIPEMENT.length - 1];
const setMax = budgetParRarete.get(meilleureRarete)! * TYPES_EQUIPEMENT.length;
console.log(`  Un set complet en ${meilleureRarete} vaut ${setMax} points de budget.`);

// Un niveau de perso = l'écart de budget entre deux niveaux consécutifs. On prend le plus
// petit parmi les raretés RÉELLEMENT en jeu : si l'équipement passe sous celui-là, il passe
// sous tous les autres. (Légendaire est exclu — il n'est pas tirable, voir plus bas.)
const ecartNiveau = (r: Rarete) => {
  const b = config.budgets[r];
  return Math.min(b[1] - b[0], b[2] - b[1]);
};
const plusPetitNiveau = Math.min(...RARETES_TIRAGE.map(ecartNiveau));
ok(
  setMax < plusPetitNiveau,
  `${setMax} pts < ${plusPetitNiveau} pts : un set complet vaut moins qu'un niveau de perso ` +
  `(${(100 * setMax / plusPetitNiveau).toFixed(0)} %) — monter son perso reste plus rentable que farmer`,
);

// Détail par rareté : le rapport n'est PAS le même partout. Les niveaux d'un Épique coûtent
// 15 points (165→180→195) contre 20 pour les autres, donc un set pèse plus lourd chez lui.
console.log('\n  Ce qu\'un set complet représente, rareté par rareté :');
for (const r of RARETES_TIRAGE) {
  const pct = 100 * setMax / ecartNiveau(r);
  console.log(`    ${r.padEnd(11)} : ${pct.toFixed(0).padStart(3)} % d'un niveau (niveau = ${ecartNiveau(r)} pts)`);
}

// ⚠️ Alerte tournée vers l'avenir. Les budgets Légendaire sont déjà en config (185/195/205),
// donc ses niveaux ne valent que 10 points : le jour où la rareté devient tirable, un set
// d'équipement vaudra PLUS qu'un niveau pour elle, ce qui inverse la hiérarchie voulue.
// On avertit sans faire échouer : la rareté n'est pas en jeu, rien n'est cassé aujourd'hui.
const niveauLegendaire = ecartNiveau('Legendaire');
if (setMax >= niveauLegendaire) {
  console.log(
    `\n  ⚠️  À SURVEILLER : un niveau de Légendaire ne vaut que ${niveauLegendaire} points, contre ${setMax} ` +
    `pour un set complet.\n      La rareté n'étant pas tirable (RARETES_TIRAGE), rien n'est cassé — mais le jour ` +
    `où elle le devient,\n      il faudra soit écarter ses paliers de niveau, soit revoir le budget des objets.`,
  );
}

// ---------------------------------------------------------------------------
console.log(
  erreurs === 0
    ? '\n✅ VALIDATION ÉQUIPEMENT : tout est conforme.\n'
    : `\n❌ VALIDATION ÉQUIPEMENT : ${erreurs} problème(s).\n`,
);
process.exit(erreurs === 0 ? 0 : 1);
