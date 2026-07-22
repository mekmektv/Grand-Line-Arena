// GRAND LINE ARENA — insère les réglages du pool de bots (§4bis) et de la prime (§8 point 7).
//
//   node server/scripts/maj-bots-et-prime.ts
//
// Passe par l'API REST : `config` est une table de valeurs, pas du DDL (règle d'or CLAUDE.md).
// Le DDL correspondant est dans supabase/A_APPLIQUER_prime_et_bots.sql, à coller à la main.
import '../src/load-env.ts';
import { supabaseSelect, supabaseUpsert } from '../src/supabase.ts';

// ── Le pool de bots ────────────────────────────────────────────────────────
// §4bis : « chaque bot = un perso défini manuellement, pas de génération aléatoire, contrôle
// total ». Les niveaux sont écrits ici et NON alignés sur celui du joueur : c'est tout l'objet
// d'un pool défini à la main que de choisir la difficulté rencontrée.
//
// Les pseudos sont pris dans `bot_pseudos` : ils doivent ressembler à des viewers, jamais
// trahir un bot. Un pseudo par bot, sinon deux bots seraient indiscernables à l'écran.
const BOTS_POOL = [
  // Les faibles — réservés à l'anti-frustration. Commun niveau 1 : c'est le niveau qui fait la
  // quasi-victoire (l'équilibrage chiffre un niveau à +40 %, le levier n°1), pas la rareté.
  { cle: 'bot_f1', pseudo: 'PouleMouillee', perso: 'Baggy', niveau: 1, faible: true },
  { cle: 'bot_f2', pseudo: 'SabodeSirop', perso: 'Smack', niveau: 1, faible: true },
  { cle: 'bot_f3', pseudo: 'EastBlue_Rookie', perso: 'Octi', niveau: 1, faible: true },

  // Les ordinaires — servis quand personne d'autre n'a encore joué. Étalés sur les raretés et
  // les niveaux pour imiter une vraie population de joueurs, et couvrir les six classes afin
  // que le triangle (§2) puisse jouer dans les deux sens.
  { cle: 'bot_01', pseudo: 'LuffyFan92', perso: 'Dalton', niveau: 1, faible: false },
  { cle: 'bot_02', pseudo: 'ZoroSanTeu', perso: 'Kuroobi', niveau: 2, faible: false },
  { cle: 'bot_03', pseudo: 'NamiChaan', perso: 'Chopper', niveau: 2, faible: false },
  { cle: 'bot_04', pseudo: 'SanjiCurlyBrow', perso: 'Usopp', niveau: 2, faible: false },
  { cle: 'bot_05', pseudo: 'ChopperGang', perso: 'Zoro', niveau: 3, faible: false },
  { cle: 'bot_06', pseudo: 'RogerLeRoi', perso: 'Arlong', niveau: 2, faible: false },
  { cle: 'bot_07', pseudo: 'BaratieChef', perso: 'Mr.5', niveau: 3, faible: false },
  { cle: 'bot_08', pseudo: 'AkaGami_', perso: 'Pell', niveau: 3, faible: false },
  { cle: 'bot_09', pseudo: 'Grand_Line_77', perso: 'Smoker', niveau: 2, faible: false },
  { cle: 'bot_10', pseudo: 'BaggyLeClown', perso: 'Luffy', niveau: 1, faible: false },
];

// ── Les réglages ───────────────────────────────────────────────────────────
// La prime par rareté suit la même échelle que le recyclage des doublons (20/40/80/160,
// doublement par palier) divisée par deux : plutôt que d'inventer une n-ième échelle, on
// réutilise celle qui est déjà validée dans le §4.
//
// prime_bonus_niveau = 0,4 reprend le chiffre d'équilibrage du projet (« un niveau vaut
// +40 % »), déjà cité dans combat-api.ts. Battre un adversaire niveau 3 vaut donc 1,8×.
const REGLAGES = [
  ['bots_pool', BOTS_POOL,
    'Pool de bots (§4bis) : chaque bot défini à la main (perso + niveau). faible:true = réservé à l\'anti-frustration.'],
  ['anti_repetition_combats', 4,
    'Nombre de derniers combats sur lesquels un adversaire ne peut pas revenir (§4bis). 0 = anti-répétition désactivée.'],
  ['prime_commun', 10, 'Prime gagnée en battant un joueur dont le perso actif est Commun (§8).'],
  ['prime_peu_commun', 20, 'Prime gagnée en battant un Peu commun (§8).'],
  ['prime_rare', 40, 'Prime gagnée en battant un Rare (§8).'],
  ['prime_epique', 80, 'Prime gagnée en battant un Épique (§8).'],
  ['prime_bonus_niveau', 0.4,
    'Bonus de prime par niveau de l\'adversaire au-dessus de 1 (§8). 0.4 = un niveau 3 vaut 1,8×.'],
] as const;

// Garde-fou : un bot qui désigne un perso absent du catalogue ne planterait qu'au premier
// combat servi, potentiellement des jours plus tard. Autant le voir maintenant.
const persos = await supabaseSelect<{ nom: string }>('characters', { select: 'nom', jouable: 'eq.true' });
const nomsConnus = new Set(persos.map((p) => p.nom));
const inconnus = BOTS_POOL.filter((b) => !nomsConnus.has(b.perso));
if (inconnus.length > 0) {
  throw new Error(`Bots désignant un perso inconnu : ${inconnus.map((b) => `${b.cle}→"${b.perso}"`).join(', ')}`);
}

for (const [cle, valeur, description] of REGLAGES) {
  await supabaseUpsert('config', { cle, valeur, description });
  const apercu = Array.isArray(valeur) ? `${valeur.length} entrées` : String(valeur);
  console.log(`  ${cle.padEnd(24)} ← ${apercu}`);
}

console.log(`\n  ✅ ${REGLAGES.length} réglages écrits.`);
console.log(`     Pool : ${BOTS_POOL.filter((b) => b.faible).length} bots faibles, ${BOTS_POOL.filter((b) => !b.faible).length} ordinaires.`);
