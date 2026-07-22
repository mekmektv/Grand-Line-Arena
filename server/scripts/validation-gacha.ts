// ONE PIECE ARENA — VALIDATION DU TIRAGE DE PERSO.
//
//   node server/scripts/validation-gacha.ts
//
// Tire 200 000 fois et vérifie :
//  - que chaque perso sort à peu près à son taux individuel (§3bis : taux du tier ÷ nb de persos)
//  - que le coût est bien débité de `config.cout_tirage_perso` (100 Berrys)
//  - qu'un perso déjà possédé est détecté comme doublon et propose le bon recyclage (§4)
//  - qu'un nouveau perso déclenche un changement de perso actif gratuit
//
// Tolérance : 0,3 point de pourcentage. Avec 200 000 tirages, un taux mal câblé (ex. taux
// du tier non divisé par le nombre de persos) donne un écart de plusieurs points — largement
// détecté.

import { chargerConfig, chargerPerso } from '../src/config.ts';
import { tirer, tauxParPerso, accepterRecyclage } from '../src/gacha.ts';
import { lireConfigDepuisSeed, lirePersosDepuisSeed } from './lire-seed.ts';

const N = 200_000;
const TOLERANCE_PTS = 0.3;
const SEED_DEPART = 20260718;

const config = chargerConfig(lireConfigDepuisSeed());
const persos = lirePersosDepuisSeed().map(chargerPerso);

let erreurs = 0;

// ---------------------------------------------------------------------------
// 1) Les taux théoriques : chaque tier se partage bien entre ses persos
// ---------------------------------------------------------------------------
console.log(`\n=== VALIDATION TIRAGE — ${N.toLocaleString('fr-FR')} tirages ===\n`);

const taux = tauxParPerso(persos, config.drop_rates);
console.log('--- Taux théorique par perso (config / nb de persos du tier) ---');
for (const [p, t] of taux) {
  console.log(`  ${p.nom.padEnd(12)} ${p.rarete.padEnd(12)} ${(t * 100).toFixed(2)} %`);
}
const sommeTheorique = [...taux.values()].reduce((s, v) => s + v, 0);
console.log(`  Somme : ${(sommeTheorique * 100).toFixed(2)} % (attendu 100 %)`);
if (Math.abs(sommeTheorique - 1) > 0.001) { erreurs++; console.log('  ✗ HORS TOLÉRANCE'); }

// ---------------------------------------------------------------------------
// 2) Simulation : fréquence empirique de chaque perso, sans jamais toucher aux Berrys
//    (on retire le coût du solde avant chaque tirage pour ne jamais tomber en dessous)
// ---------------------------------------------------------------------------
const compte = new Map<string, number>(persos.map((p) => [p.nom, 0]));
let berrys = config.cout_tirage_perso * (N + 1);
let seed = SEED_DEPART;

for (let i = 0; i < N; i++) {
  seed = (seed + 0x9e3779b9) >>> 0;
  const r = tirer({ berrysDisponibles: berrys, nomsDejaPossedes: new Set(), persos, config, seed });
  compte.set(r.perso.nom, compte.get(r.perso.nom)! + 1);
  berrys = r.berrys_apres;
}

console.log('\n--- Taux empirique vs théorique ---');
for (const [p, tTheorique] of taux) {
  const tEmpirique = compte.get(p.nom)! / N;
  const ecartPts = (tEmpirique - tTheorique) * 100;
  const ok = Math.abs(ecartPts) <= TOLERANCE_PTS;
  if (!ok) erreurs++;
  console.log(
    `  ${p.nom.padEnd(12)} théorique ${(tTheorique * 100).toFixed(2)} %` +
    `   empirique ${(tEmpirique * 100).toFixed(2)} %` +
    `   écart ${ecartPts >= 0 ? '+' : ''}${ecartPts.toFixed(2)} pts   ${ok ? '✓' : '✗ HORS TOLÉRANCE'}`,
  );
}

// ---------------------------------------------------------------------------
// 3) Le coût : 100 Berrys retirés par tirage, ni plus ni moins
// ---------------------------------------------------------------------------
console.log('\n--- Coût du tirage ---');
const berrysAttendus = config.cout_tirage_perso * (N + 1) - config.cout_tirage_perso * N;
const coutOk = berrys === berrysAttendus;
if (!coutOk) erreurs++;
console.log(`  Coût configuré : ${config.cout_tirage_perso} Berrys`);
console.log(`  Solde final : ${berrys} (attendu ${berrysAttendus})   ${coutOk ? '✓' : '✗'}`);

console.log('\n--- Refus si solde insuffisant ---');
try {
  tirer({ berrysDisponibles: config.cout_tirage_perso - 1, nomsDejaPossedes: new Set(), persos, config, seed: 1 });
  erreurs++;
  console.log('  ✗ le tirage aurait dû être refusé');
} catch {
  console.log('  ✓ refusé comme attendu');
}

// ---------------------------------------------------------------------------
// 4) Doublon : détection + recyclage proposé au bon montant par rareté (§4)
// ---------------------------------------------------------------------------
console.log('\n--- Doublon → recyclage proposé ---');
for (const p of persos) {
  const dejaPossede = new Set([p.nom]);
  // On force le tirage sur CE perso en cherchant un seed qui le sort (déterministe : simple
  // recherche linéaire, largement assez rapide sur 16 persos).
  let seedTrouve: number | undefined;
  for (let s = 0; s < 5000; s++) {
    const essai = tirer({ berrysDisponibles: config.cout_tirage_perso, nomsDejaPossedes: dejaPossede, persos, config, seed: s });
    if (essai.perso.nom === p.nom) { seedTrouve = s; break; }
  }
  if (seedTrouve === undefined) { erreurs++; console.log(`  ✗ impossible de forcer un tirage sur ${p.nom}`); continue; }

  const r = tirer({ berrysDisponibles: config.cout_tirage_perso, nomsDejaPossedes: dejaPossede, persos, config, seed: seedTrouve });
  const attendu = config.recyclage_doublon[p.rarete]!;
  const ok = r.doublon === true
    && r.recyclage_propose_berrys === attendu
    && r.changement_perso_actif_gratuit === false;
  if (!ok) erreurs++;
  console.log(
    `  ${p.nom.padEnd(12)} ${p.rarete.padEnd(12)} recyclage proposé ${r.recyclage_propose_berrys} Berrys` +
    ` (attendu ${attendu})   ${ok ? '✓' : '✗ HORS TOLÉRANCE'}`,
  );

  const soldeApres = accepterRecyclage(0, p, config);
  if (soldeApres !== attendu) { erreurs++; console.log(`  ✗ accepterRecyclage(${p.nom}) donne ${soldeApres}, attendu ${attendu}`); }
}

// ---------------------------------------------------------------------------
// 5) Nouveau perso → changement de perso actif gratuit
// ---------------------------------------------------------------------------
console.log('\n--- Nouveau perso → changement gratuit ---');
const r = tirer({ berrysDisponibles: config.cout_tirage_perso, nomsDejaPossedes: new Set(), persos, config, seed: 42 });
const okNouveau = r.doublon === false && r.recyclage_propose_berrys === null && r.changement_perso_actif_gratuit === true;
if (!okNouveau) erreurs++;
console.log(`  perso=${r.perso.nom} doublon=${r.doublon} changement_gratuit=${r.changement_perso_actif_gratuit}   ${okNouveau ? '✓' : '✗'}`);

console.log(
  erreurs === 0
    ? '\n✅ VALIDÉ — taux, coût et recyclage conformes à §3bis / §4.\n'
    : `\n❌ ${erreurs} écart(s) hors tolérance — ne pas livrer.\n`,
);
process.exit(erreurs === 0 ? 0 : 1);
