// ONE PIECE ARENA — VALIDATION DE LA PRIME (§8 point 7).
//
//   node server/scripts/validation-prime.ts
//
// Ne touche NI la base NI l'horloge : prime.ts est de la logique pure.

import { gainPrime, primeApresCombat } from '../src/prime.ts';
import type { Config, Rarete } from '../src/types.ts';

const config = {
  prime_par_rarete: { Commun: 10, 'Peu commun': 20, Rare: 40, Epique: 80 },
  prime_bonus_niveau: 0.4,
} as unknown as Config;

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = '') {
  console.log(`  ${condition ? 'ok  ' : 'ÉCHEC'} │ ${intitule}${detail ? ` — ${detail}` : ''}`);
  if (!condition) echecs++;
}

console.log('\n── Gain selon la rareté battue ────────────────────────────────────────────');
for (const [rarete, attendu] of [['Commun', 10], ['Peu commun', 20], ['Rare', 40], ['Epique', 80]] as const) {
  const g = gainPrime(rarete as Rarete, 1, config);
  verifier(`${rarete} niveau 1 vaut ${attendu}`, g === attendu, `obtenu ${g}`);
}

console.log('\n── Pondération par le niveau (un niveau = +40 %) ──────────────────────────');
verifier('Commun niveau 2 = 14', gainPrime('Commun' as Rarete, 2, config) === 14, `obtenu ${gainPrime('Commun' as Rarete, 2, config)}`);
verifier('Commun niveau 3 = 18', gainPrime('Commun' as Rarete, 3, config) === 18, `obtenu ${gainPrime('Commun' as Rarete, 3, config)}`);
verifier('Epique niveau 3 = 144', gainPrime('Epique' as Rarete, 3, config) === 144, `obtenu ${gainPrime('Epique' as Rarete, 3, config)}`);

console.log('\n── Les trois règles de la prime ───────────────────────────────────────────');
const base = { primeAvant: 500, rareteAdversaire: 'Rare' as Rarete, niveauAdversaire: 2, config };

const victoireJoueur = primeApresCombat({ ...base, gagne: true, contreVraiJoueur: true });
verifier('une victoire contre un vrai joueur fait monter la prime',
  victoireJoueur.prime === 556 && victoireJoueur.gain === 56, `${victoireJoueur.prime} (+${victoireJoueur.gain})`);

const defaite = primeApresCombat({ ...base, gagne: false, contreVraiJoueur: true });
verifier('une défaite ne fait JAMAIS baisser la prime',
  defaite.prime === 500 && defaite.gain === 0, `${defaite.prime}`);

const victoireBot = primeApresCombat({ ...base, gagne: true, contreVraiJoueur: false });
verifier('une victoire contre un BOT ne rapporte rien',
  victoireBot.prime === 500 && victoireBot.gain === 0, `${victoireBot.prime}`);

const defaiteBot = primeApresCombat({ ...base, gagne: false, contreVraiJoueur: false });
verifier('une défaite contre un bot ne change rien non plus',
  defaiteBot.prime === 500 && defaiteBot.gain === 0, `${defaiteBot.prime}`);

console.log('\n── L\'anti-frustration ne doit pas être exploitable ────────────────────────');
// Le scénario redouté : un joueur enchaîne 3 défaites pour déclencher le bot faible garanti,
// le bat, et recommence. Si la victoire contre un bot rapportait, ce serait la stratégie
// optimale du classement — perdre exprès.
let primeExploit = 0;
for (let cycle = 0; cycle < 100; cycle++) {
  for (let d = 0; d < 3; d++) {
    primeExploit = primeApresCombat({ ...base, primeAvant: primeExploit, gagne: false, contreVraiJoueur: true }).prime;
  }
  primeExploit = primeApresCombat({ ...base, primeAvant: primeExploit, gagne: true, contreVraiJoueur: false }).prime;
}
verifier('100 cycles « perdre 3 fois puis battre le bot faible » ne rapportent rien',
  primeExploit === 0, `prime obtenue ${primeExploit}`);

console.log('\n── Rareté absente de la config ────────────────────────────────────────────');
let aPlante = false;
try {
  gainPrime('Legendaire' as Rarete, 1, config);
} catch {
  aPlante = true;
}
verifier('une rareté sans prime en config plante au lieu de rapporter 0', aPlante);

console.log(echecs === 0 ? '\n✅ Tous les contrôles passent.\n' : `\n❌ ${echecs} contrôle(s) en échec.\n`);
process.exit(echecs === 0 ? 0 : 1);
