// GRAND LINE ARENA — SIMULATION DE L'ÉCONOMIE DE L'ÉQUIPEMENT (§4ter)
//
//   node server/scripts/simu-equipement.ts
//
// C'est ce script qui a fixé les seuils du compteur de recyclage à 6 Gris / 4 Vert
// (config `equipement_compteur_gris` / `_vert`, le 21/07/2026). Le relancer avant de
// toucher à ces valeurs.
//
// Modèle « un seul perso équipé » : c'est le comportement réel des joueurs (on n'équipe
// pas les 14 persos de sa collection). La variante « toute la collection » a été testée
// et divise le gâchis par deux, mais elle suppose un joueur complétiste — pas la norme.
//
// Le modèle est calibré : sans compteur ni réinvestissement, il retrouve 33 jours pour
// 2 slots Bleu au profil plancher, contre 34 annoncés au §4ter. Si une modification fait
// diverger ce chiffre, c'est le modèle qui est cassé, pas le doc.
//
// Aucune base, aucune horloge : relançable à tout moment, aléatoire reproductible.

const COUT_COFFRE = 35, COUT_TIRAGE = 100;
const TAUX_COFFRE = [0.65, 0.28, 0.07];
const RECYCLAGE = [10, 20, 40];
const JOURS = 120, N_JOUEURS = 20_000;

const PROFILS = [
  { nom: 'Plancher (lurker)', revenu: 160, coffres: 1 },
  { nom: 'Non-live actif',    revenu: 220, coffres: 3 },
  { nom: 'Présent en live',   revenu: 400, coffres: 8 },
];

function rngDepuis(g: number) {
  let a = g >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tirerIndex(taux: number[], r: number) {
  let c = 0;
  for (let i = 0; i < taux.length; i++) { c += taux[i]; if (r < c) return i; }
  return taux.length - 1;
}
function mediane(xs: number[]) {
  if (!xs.length) return NaN;
  const t = [...xs].sort((a, b) => a - b), m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

function simuler(profil: typeof PROFILS[number], sGris: number, sVert: number, graine: number) {
  const rnd = rngDepuis(graine);
  const equipe = [-1, -1], rechange = [-1, -1], eclats = [0, 0, 0];
  let berrys = 0, jourVert = 0, jourBleu = 0, jour = 0;
  let coffres = 0, inutiles = 0, gratuits = 0;

  const recycler = (r: number) => { berrys += RECYCLAGE[r]; eclats[r]++; };

  const ouvrir = (min: number) => {
    coffres++;
    let r: number;
    if (min === 0) r = tirerIndex(TAUX_COFFRE, rnd());
    else {
      const rest = TAUX_COFFRE.slice(min), s = rest.reduce((a, b) => a + b, 0);
      r = min + tirerIndex(rest.map(v => v / s), rnd());
    }
    const t = rnd() < 0.5 ? 0 : 1;
    if (equipe[t] === -1) equipe[t] = r;
    else if (r > equipe[t]) { recycler(equipe[t]); equipe[t] = r; }
    else if (r > rechange[t]) { if (rechange[t] !== -1) recycler(rechange[t]); rechange[t] = r; }
    else { recycler(r); inutiles++; }
  };

  const consommer = () => {
    for (let n = 0; n < 5000; n++) {
      if (sGris > 0 && eclats[0] >= sGris) { eclats[0] -= sGris; gratuits++; ouvrir(1); }
      else if (sVert > 0 && eclats[1] >= sVert) { eclats[1] -= sVert; gratuits++; ouvrir(2); }
      else return;
    }
  };

  for (jour = 1; jour <= JOURS; jour++) {
    berrys += profil.coffres * COUT_COFFRE;
    const n = Math.floor(berrys / COUT_COFFRE);
    berrys -= n * COUT_COFFRE;
    for (let i = 0; i < n; i++) ouvrir(0);
    consommer();
    if (!jourVert && equipe[0] >= 1 && equipe[1] >= 1) jourVert = jour;
    if (!jourBleu && equipe[0] === 2 && equipe[1] === 2) jourBleu = jour;
  }
  return { jourVert: jourVert || null, jourBleu: jourBleu || null, coffres, inutiles, gratuits };
}

const SEUILS: [number, number][] = [
  [0, 0], [12, 6], [10, 5], [8, 6], [8, 5], [8, 4], [6, 5], [6, 4], [6, 3], [5, 4], [4, 3], [3, 3],
];

for (const profil of PROFILS) {
  console.log(`\n=== ${profil.nom.toUpperCase()} — ${profil.coffres} coffre(s)/j payé(s), ${profil.revenu} Berrys/j ===\n`);
  console.log('  Seuils (Gris→Vert / Vert→Bleu) | 2 Vert+ | 2 Bleus | coffres offerts /90j | coffres inutiles');
  console.log('  ' + '-'.repeat(95));
  for (const [sg, sv] of SEUILS) {
    const rv: number[] = [], rb: number[] = [];
    let co = 0, inu = 0, gra = 0;
    for (let i = 0; i < N_JOUEURS; i++) {
      const r = simuler(profil, sg, sv, 555000 + i * 7919);
      if (r.jourVert) rv.push(r.jourVert);
      if (r.jourBleu) rb.push(r.jourBleu);
      co += r.coffres; inu += r.inutiles; gra += r.gratuits;
    }
    const label = sg === 0 ? 'aucun compteur' : `${sg} Gris / ${sv} Vert`;
    const bleu = rb.length / N_JOUEURS >= 0.5 ? `${String(mediane(rb)).padStart(5)}j` : ' >120j';
    console.log(
      `  ${label.padEnd(30)} | ${String(mediane(rv)).padStart(5)}j  | ${bleu}  | ` +
      `${(gra / N_JOUEURS * 90 / JOURS).toFixed(1).padStart(19)} | ${(100 * inu / co).toFixed(0).padStart(15)} %`
    );
  }
}
