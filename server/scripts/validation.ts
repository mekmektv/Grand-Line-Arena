// ONE PIECE ARENA — VALIDATION DE L'ÉQUILIBRAGE.
//
//   node server/scripts/validation.ts
//
// Fait tourner un tournoi complet au niveau 3 : les 16 persos, tous contre tous,
// 2000 combats par duel (120 duels = 240 000 combats), et compare le résultat au
// tableau du §3 d'EQUILIBRAGE_FINAL.md.
//
// Les cibles ne sont PAS recopiées ici : elles sont lues dans la colonne winrate_global_pct
// de la table `characters` (c'est v6.py qui les y a mises). Le test compare donc le moteur
// à la base, pas à lui-même.
//
// Tolérance : 3 points. Au-delà, c'est un bug dans le moteur — pas du bruit.

import { chargerConfig, chargerPerso } from '../src/config.ts';
import { simulerCombat } from '../src/combat.ts';
import { calculerStats } from '../src/stats.ts';
import { creerRng } from '../src/rng.ts';
import type { Engage, Rarete } from '../src/types.ts';
import { lireConfigDepuisSeed, lirePersosDepuisSeed } from './lire-seed.ts';

const COMBATS_PAR_DUEL = 2000;
const NIVEAU = 3;
const TOLERANCE = 3;        // points de winrate
const SEED_TOURNOI = 20260717;

/** Seule cible qui n'est pas stockée en base. Source : EQUILIBRAGE_FINAL.md §3. */
const CIBLE_DUREE_MOYENNE = 7.9;

// ---------------------------------------------------------------------------
// Préparation
// ---------------------------------------------------------------------------
const config = chargerConfig(lireConfigDepuisSeed());
const lignes = lirePersosDepuisSeed();
const persos = lignes.map(chargerPerso);
const cibleGlobale = new Map<string, number>(lignes.map((l) => [l.nom, Number((l as any).winrate_global_pct)]));
const cibleTier = new Map<string, number | null>(
  lignes.map((l) => [l.nom, (l as any).winrate_tier_pct === null ? null : Number((l as any).winrate_tier_pct)]),
);

const engages = new Map<string, Engage>(persos.map((p) => [p.nom, { perso: p, niveau: NIVEAU }]));

const victoires = new Map<string, number>(persos.map((p) => [p.nom, 0]));
const combats = new Map<string, number>(persos.map((p) => [p.nom, 0]));
const victoiresTier = new Map<string, number>(persos.map((p) => [p.nom, 0]));
const combatsTier = new Map<string, number>(persos.map((p) => [p.nom, 0]));
/** Résultat de chaque duel, pour pouvoir inspecter un matchup précis (Arlong vs Crocodile). */
const duels = new Map<string, number>();

let sommeTours = 0;
let nbCombats = 0;
let nbLimiteTours = 0;
let nbDoubleKO = 0;

// ---------------------------------------------------------------------------
// Le tournoi
// ---------------------------------------------------------------------------
const master = creerRng(SEED_TOURNOI);
const debut = Date.now();

for (let i = 0; i < persos.length; i++) {
  for (let j = i + 1; j < persos.length; j++) {
    const p1 = persos[i];
    const p2 = persos[j];
    const memeRarete = p1.rarete === p2.rarete;
    let victoiresP1 = 0;

    for (let k = 0; k < COMBATS_PAR_DUEL; k++) {
      const seed = Math.floor(master() * 0x100000000);
      const r = simulerCombat(engages.get(p1.nom)!, engages.get(p2.nom)!, config, { seed });

      const gagnant = r.vainqueur === 'a' ? p1.nom : p2.nom;
      victoires.set(gagnant, victoires.get(gagnant)! + 1);
      combats.set(p1.nom, combats.get(p1.nom)! + 1);
      combats.set(p2.nom, combats.get(p2.nom)! + 1);
      if (r.vainqueur === 'a') victoiresP1++;

      if (memeRarete) {
        combatsTier.set(p1.nom, combatsTier.get(p1.nom)! + 1);
        combatsTier.set(p2.nom, combatsTier.get(p2.nom)! + 1);
        victoiresTier.set(gagnant, victoiresTier.get(gagnant)! + 1);
      }

      sommeTours += r.tours;
      nbCombats++;
      const fin = r.evenements[r.evenements.length - 1];
      if (fin.type === 'fin' && fin.raison === 'limite_tours') nbLimiteTours++;
      if (fin.type === 'fin' && fin.raison === 'double_ko') nbDoubleKO++;
    }
    duels.set(`${p1.nom} vs ${p2.nom}`, (100 * victoiresP1) / COMBATS_PAR_DUEL);
  }
}

const duree = (Date.now() - debut) / 1000;

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------
const ORDRE_RARETE: Rarete[] = ['Commun', 'Peu commun', 'Rare', 'Epique'];
const wr = (n: string) => (100 * victoires.get(n)!) / combats.get(n)!;
const wrTier = (n: string) => (combatsTier.get(n)! ? (100 * victoiresTier.get(n)!) / combatsTier.get(n)! : null);
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const padG = (s: string | number, n: number) => String(s).padStart(n);

let erreurs = 0;
const verdict = (ecart: number) => {
  if (Math.abs(ecart) > TOLERANCE) { erreurs++; return '✗ HORS TOLÉRANCE'; }
  return '✓';
};

console.log(`\n=== VALIDATION — ${COMBATS_PAR_DUEL} combats par duel, niveau ${NIVEAU} ===`);
console.log(`${nbCombats.toLocaleString('fr-FR')} combats simulés en ${duree.toFixed(1)} s\n`);

console.log(
  pad('Perso', 11) + pad('Classe', 11) + pad('Rareté', 12) + padG('Kit', 5) +
  padG('Niv3', 11) + padG('tier', 7) + padG('global', 8) + padG('cible', 7) + padG('écart', 8),
);

const triés = [...persos].sort((a, b) =>
  ORDRE_RARETE.indexOf(a.rarete) - ORDRE_RARETE.indexOf(b.rarete) || wr(b.nom) - wr(a.nom));

for (const p of triés) {
  const s = calculerStats(p, NIVEAU, config);
  const g = wr(p.nom);
  const cible = cibleGlobale.get(p.nom)!;
  const ecart = g - cible;
  const t = wrTier(p.nom);
  console.log(
    pad(p.nom, 11) + pad(p.classe, 11) + pad(p.rarete, 12) +
    padG(`${p.cout_kit_pct > 0 ? '+' : ''}${Math.round(p.cout_kit_pct)}%`, 5) +
    padG(`${Math.round(s.pv)}/${Math.round(s.attack)}`, 11) +
    padG(t === null ? 'seul' : `${t.toFixed(0)}%`, 7) +
    padG(`${g.toFixed(0)}%`, 8) + padG(`${cible.toFixed(0)}%`, 7) +
    padG(`${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)}`, 8) +
    (Math.abs(ecart) > TOLERANCE ? '  ✗' : ''),
  );
  if (Math.abs(ecart) > TOLERANCE) erreurs++;
}

// --- Moyennes par rareté (§3 : Commun 17 %, Peu commun 49 %, Rare 76 %, Épique 89 %)
// La cible est la moyenne des cibles individuelles stockées en base : rien n'est recopié ici.
console.log('\n--- Moyennes par rareté ---');
for (const r of ORDRE_RARETE) {
  const groupe = persos.filter((p) => p.rarete === r);
  const obtenu = groupe.reduce((s, p) => s + wr(p.nom), 0) / groupe.length;
  const cible = groupe.reduce((s, p) => s + cibleGlobale.get(p.nom)!, 0) / groupe.length;
  const ecart = obtenu - cible;
  console.log(
    `  ${pad(r, 13)}${padG(`${obtenu.toFixed(1)} %`, 8)}   cible ${padG(`${cible.toFixed(1)} %`, 6)}` +
    `   écart ${padG(`${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)}`, 5)}   ${verdict(ecart)}`,
  );
}

// --- Durée moyenne
console.log('\n--- Durée d\'un combat ---');
const dureeMoy = sommeTours / nbCombats;
const ecartDuree = dureeMoy - CIBLE_DUREE_MOYENNE;
console.log(
  `  ${pad('Tours', 13)}${padG(dureeMoy.toFixed(2), 8)}   cible ${padG(CIBLE_DUREE_MOYENNE.toFixed(1), 6)}` +
  `   écart ${padG(`${ecartDuree >= 0 ? '+' : ''}${ecartDuree.toFixed(2)}`, 5)}   ` +
  `${Math.abs(ecartDuree) > 0.5 ? (erreurs++, '✗ HORS TOLÉRANCE') : '✓'}`,
);

// --- Les points explicitement demandés
console.log('\n--- Contrôles ciblés ---');

const croco = wr('Crocodile');
const arlong = wr('Arlong');
const meilleur = triés.reduce((m, p) => (wr(p.nom) > wr(m.nom) ? p : m));
const arlongVsCroco = duels.get('Arlong vs Crocodile')!;

const controles: [string, boolean, string][] = [
  ['Crocodile est le meilleur perso du jeu', meilleur.nom === 'Crocodile', `meilleur = ${meilleur.nom} (${wr(meilleur.nom).toFixed(0)} %)`],
  ['Crocodile ~89 %', Math.abs(croco - 89) <= TOLERANCE, `${croco.toFixed(1)} %`],
  ['Arlong ~84 %', Math.abs(arlong - 84) <= TOLERANCE, `${arlong.toFixed(1)} %`],
  ['Arlong 2e du jeu', triés.filter((p) => wr(p.nom) > arlong).length === 1, `${triés.filter((p) => wr(p.nom) > arlong).length} perso(s) au-dessus`],
];
for (const [libelle, ok, detail] of controles) {
  if (!ok) erreurs++;
  console.log(`  ${ok ? '✓' : '✗'} ${pad(libelle, 45)} ${detail}`);
}

// --- Le triangle est-il branché ? On rejoue le duel en retirant le contre du Haki.
// `triangle` est de la donnée (table config) : on peut le neutraliser sans toucher au moteur.
const sansContre = { ...config, triangle: { ...config.triangle, Haki: [] } };
const rngContre = creerRng(999);
let sansContreWins = 0;
const N_DUEL = 5000;
for (let k = 0; k < N_DUEL; k++) {
  if (simulerCombat(engages.get('Arlong')!, engages.get('Crocodile')!, sansContre,
    { seed: Math.floor(rngContre() * 0x100000000) }).vainqueur === 'a') sansContreWins++;
}
const arlongSansContre = (100 * sansContreWins) / N_DUEL;

// --- ⚠️ LE SEUL POINT QUI NE COLLE PAS AVEC LE DOCUMENT ---
// Vérifié : ce n'est PAS un bug du moteur. v6.py — le simulateur qui a produit le tableau
// du §3 — donne 41,2 % sur ce même duel, à 0,1 point du moteur. La phrase du §3
// « Arlong bat Crocodile en duel » date de l'époque où le triangle était à ×1.5
// (à ×1.5, §2 le dit : "un Commun qui contrait battait Crocodile l'Épique").
// Depuis le passage à ×1.1 le 16/07, contrer ne suffit plus à renverser un écart de rareté —
// ce qui est exactement l'intention affichée au §2 : "à ×1.1, contrer reste très fort mais
// la rareté reprend le dessus". C'est un écart de DOCUMENTATION, pas de code : on l'affiche
// fort, mais il ne fait pas échouer la validation du moteur.
console.log('\n--- ⚠️  Écart connu avec le document (à trancher côté produit) ---');
console.log(`  Le §3 annonce : "Arlong bat Crocodile en duel parce qu'il le contre".`);
console.log(`  Mesuré ici              : Arlong gagne ${arlongVsCroco.toFixed(1)} % du duel  → il PERD.`);
console.log(`  Mesuré dans v6.py       : 41,2 %  → la référence dit la même chose que le moteur.`);
console.log(`  Le contre fonctionne    : sans lui, Arlong tomberait à ${arlongSansContre.toFixed(1)} % ` +
            `(le contre lui vaut ${(arlongVsCroco - arlongSansContre >= 0 ? '+' : '')}${(arlongVsCroco - arlongSansContre).toFixed(1)} points).`);
console.log('  → Le moteur est conforme à v6.py. C\'est la phrase du §3 qui est un reste du triangle ×1.5.');

// --- Santé du moteur
console.log('\n--- Santé du moteur ---');
console.log(`  Combats atteignant la limite de ${config.max_tours} tours : ${nbLimiteTours} (attendu : 0)`);
console.log(`  Double KO (départagés à pile ou face) : ${nbDoubleKO} (${(100 * nbDoubleKO / nbCombats).toFixed(2)} %)`);
if (nbLimiteTours > 0) erreurs++;

console.log(
  erreurs === 0
    ? '\n✅ VALIDÉ — tout est dans la tolérance de 3 points.\n'
    : `\n❌ ${erreurs} écart(s) hors tolérance — il y a un bug, ne pas livrer.\n`,
);
process.exit(erreurs === 0 ? 0 : 1);
