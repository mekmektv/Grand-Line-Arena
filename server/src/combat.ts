// GRAND LINE ARENA — LE MOTEUR DE COMBAT.
//
// Il prend 2 persos + leur niveau, et rend : le vainqueur + la liste des événements que le
// front rejouera. Le client ne calcule RIEN (§6 GAME_DESIGN) : anti-triche, et léger.
//
// Ce fichier est un portage fidèle de v6.py — le simulateur qui a produit TOUS les chiffres
// d'EQUILIBRAGE_FINAL.md. Chaque règle ci-dessous est là parce qu'elle a été mesurée.
// Si tu changes une seule d'entre elles, l'équilibrage du §3 ne tient plus : relance la
// validation (`node server/scripts/validation.ts`) avant de committer.
//
// AUCUN CHIFFRE EN DUR ICI : tout vient de `config` (constantes) et de `characters` (persos).

import { creerRng, seedAleatoire } from './rng.ts';
import { calculerStats } from './stats.ts';
import type {
  Camp, Classe, Competence, Config, Engage, Evenement, ResultatCombat,
} from './types.ts';

// ---------------------------------------------------------------------------
// L'état d'un combattant pendant le combat (jetable : il meurt avec le combat)
// ---------------------------------------------------------------------------
interface Etat {
  camp: Camp;
  nom: string;
  classe: Classe;
  pvMax: number;
  pv: number;
  atk: number;
  atkBase: number;      // l'Attack d'origine, jamais buffée — sert au calcul du poison
  esquive: number;
  crit: number;
  resistance: number;
  competence: Competence | null;
  competenceUtilisee: boolean;
  // Effets temporaires subis
  malusAtk: number;
  malusAtkTours: number;
  malusEsq: number;
  malusEsqTours: number;
  regenBloqueeTours: number;
  poisonDegats: number;
  poisonTours: number;
}

function creerEtat(engage: Engage, camp: Camp, config: Config): Etat {
  const { perso } = engage;
  // §4ter : l'équipement du perso entre ici, et nulle part ailleurs. Le reste du moteur
  // travaille sur `stats` sans jamais savoir d'où viennent les PV et l'Attack.
  const stats = calculerStats(perso, engage.niveau, config, engage.equipement);

  // Les passifs de classe (§2). Ils viennent de la CLASSE + de `config`, jamais du perso :
  // c'est ce qui fait qu'on rééquilibre tout le jeu en changeant une ligne de la table config.
  const esquive = config.esquive_base
    + (perso.classe === 'Logia' || perso.classe === 'Paramecia' ? config.esquive_logia : 0);
  const crit = perso.classe === 'Sabreur' ? config.crit_sabreur : 0;

  return {
    camp,
    nom: perso.nom,
    classe: perso.classe,
    pvMax: stats.pv,
    pv: stats.pv,
    atk: stats.attack,
    atkBase: stats.attack,
    esquive,
    crit,
    resistance: perso.resistance, // §3 : 0 par défaut
    competence: perso.competence,
    competenceUtilisee: perso.competence === null, // pas de compétence = rien à déclencher
    malusAtk: 0,
    malusAtkTours: 0,
    malusEsq: 0,
    malusEsqTours: 0,
    regenBloqueeTours: 0,
    poisonDegats: 0,
    poisonTours: 0,
  };
}

// ---------------------------------------------------------------------------
// Le moteur
// ---------------------------------------------------------------------------

export interface OptionsCombat {
  /** Impose le hasard du combat. Même seed = combat identique, coup pour coup. */
  seed?: number;
}

/**
 * Simule un combat complet.
 * @param a  le perso du camp 'a' + son niveau
 * @param b  le perso du camp 'b' + son niveau
 * @param config  la table `config`, chargée via chargerConfig()
 */
export function simulerCombat(a: Engage, b: Engage, config: Config, options: OptionsCombat = {}): ResultatCombat {
  const seed = options.seed ?? seedAleatoire();
  const rng = creerRng(seed);
  const evenements: Evenement[] = [];

  const A = creerEtat(a, 'a', config);
  const B = creerEtat(b, 'b', config);
  const autre = (x: Etat) => (x === A ? B : A);
  const pvAffiche = (x: Etat) => Math.max(0, x.pv); // le front ne doit jamais voir de PV négatifs

  // ---- Frapper -----------------------------------------------------------
  /**
   * Un coup porté. `mult` = tout ce qui multiplie les dégâts (critique, spécial).
   * Rend les dégâts RÉELLEMENT infligés (0 si esquivé).
   * C'est le seul endroit du moteur qui retire des PV via une attaque.
   */
  function frapper(att: Etat, def: Etat, mult: number, tour: number): number {
    // Passif Haki (§2) : ses coups ne peuvent pas être esquivés. Il ignore l'esquive
    // adverse à 100 % — c'est le matchup le plus fort du jeu, d'où le triangle à ×1.1.
    if (att.classe !== 'Haki') {
      const chance = Math.max(0, def.esquive - def.malusEsq);
      if (rng() < chance) {
        evenements.push({ type: 'esquive', tour, acteur: att.camp, cible: def.camp });
        return 0;
      }
    }

    // Triangle (§2) : frapper une classe qu'on contre = ×counter_mult. Frapper son
    // counter = ×1, PAS de malus. Neutre / même classe = ×1.
    const contre = config.triangle[att.classe].includes(def.classe);
    const multCounter = contre ? config.counter_mult : 1;
    if (contre) {
      evenements.push({ type: 'counter', tour, acteur: att.camp, cible: def.camp, multiplicateur: config.counter_mult });
    }

    const brut = att.atk * (1 - att.malusAtk) * mult * multCounter;

    // Résistance (§3) : dégâts_subis × (1 − résistance). Défaut 0.
    const degats = brut * (1 - def.resistance);
    if (def.resistance > 0) {
      evenements.push({
        type: 'resistance', tour, cible: def.camp,
        valeur: def.resistance, degats_evites: brut - degats,
      });
    }

    def.pv -= degats;
    evenements.push({
      type: 'degats', tour, acteur: att.camp, cible: def.camp,
      valeur: degats, pv_restants: pvAffiche(def), pv_max: def.pvMax,
    });
    return degats;
  }

  // ---- Décider : coup normal ou spécial ? --------------------------------
  /** Le spécial sort-il ce tour-ci ? Chaque compétence ne s'active qu'UNE fois par combat (§3). */
  function competenceSort(x: Etat, tour: number): boolean {
    if (x.competenceUtilisee || !x.competence) return false;
    const d = x.competence.declencheur;

    if (d.type === 'tour') {
      // "au hasard, garanti au plus tard au tour N" : chance 1/(N−tour+1) à chaque tour.
      // Résultat : le tour de sortie est uniforme entre 1 et N. Au tour N, c'est certain.
      return tour >= d.valeur || rng() < 1 / (d.valeur - tour + 1);
    }
    // "pv<=X%" : dès que le perso passe sous X % de ses PV.
    return x.pv <= x.pvMax * d.valeur;
  }

  /** Le tour d'un combattant. */
  function agir(x: Etat, y: Etat, tour: number): void {
    if (!competenceSort(x, tour)) {
      // Coup normal. Le Sabreur roule son critique (30 %) ; les autres ont crit = 0.
      const critique = x.crit > 0 && rng() < x.crit;
      evenements.push({ type: 'attaque', tour, acteur: x.camp, cible: y.camp });
      if (critique) {
        evenements.push({ type: 'crit', tour, acteur: x.camp, cible: y.camp, multiplicateur: config.crit_mult });
      }
      frapper(x, y, critique ? config.crit_mult : 1, tour);
      return;
    }

    x.competenceUtilisee = true;
    const c = x.competence!;
    const e = c.effet;
    evenements.push({ type: 'special', tour, acteur: x.camp, cible: y.camp, nom: c.nom, categorie: c.type });

    // BUFF (Kuroobi, Luffy) : +X % d'Attack pour le reste du combat. Aucun dégât ce tour-là.
    if (c.type === 'buff') {
      const avant = x.atk;
      x.atk *= 1 + (e.atk_pct ?? 0);
      evenements.push({ type: 'buff', tour, acteur: x.camp, stat: 'attack', pct: e.atk_pct ?? 0, avant, apres: x.atk });
      return;
    }

    // TRANSFO (Dalton, Chopper, Pell) : le front bascule sur les assets de la forme
    // transformée pour tout le reste du combat. Aucun dégât ce tour-là.
    // §3 : les transfos donnent de la RÉSISTANCE, jamais des PV max — la barre de vie ne bouge pas.
    if (c.type === 'transfo') {
      if (e.resistance !== undefined) x.resistance = Math.max(x.resistance, e.resistance);
      if (e.atk_pct !== undefined) x.atk *= 1 + e.atk_pct;
      if (e.esquive_pct !== undefined) x.esquive += e.esquive_pct;
      evenements.push({
        type: 'transformation', tour, acteur: x.camp,
        resistance: e.resistance, attack_pct: e.atk_pct, esquive_pct: e.esquive_pct,
      });
      return;
    }

    // DMG : le coup spécial. Le critique garanti remplace le jet de critique du Sabreur
    // (sur un spécial, le Sabreur ne roule pas son 30 % — seul crit_garanti s'applique).
    if (e.crit_garanti) {
      evenements.push({ type: 'crit', tour, acteur: x.camp, cible: y.camp, multiplicateur: config.crit_mult });
    }
    const degats = frapper(x, y, (e.mult ?? 1) * (e.crit_garanti ? config.crit_mult : 1), tour);

    // Esquivé → aucun effet annexe ne s'applique. Le spécial est quand même consommé.
    if (degats <= 0) return;

    // Vol de vie (Arlong) : la barre de vie MONTE, le front doit le savoir.
    if (e.vol_de_vie !== undefined) {
      const soin = Math.min(x.pvMax, x.pv + degats * e.vol_de_vie) - x.pv;
      x.pv += soin;
      evenements.push({
        type: 'soin', tour, acteur: x.camp, source: 'vol_de_vie',
        valeur: soin, pv_restants: pvAffiche(x), pv_max: x.pvMax,
      });
    }
    // Debuff Attack (Smoker)
    if (e.debuff_attack !== undefined) {
      y.malusAtk = e.debuff_attack;
      y.malusAtkTours = e.debuff_tours ?? 0;
      evenements.push({
        type: 'debuff', tour, acteur: x.camp, cible: y.camp,
        stat: 'attack', valeur: e.debuff_attack, tours: y.malusAtkTours,
      });
    }
    // Debuff esquive (Usopp)
    if (e.debuff_esquive !== undefined) {
      y.malusEsq = e.debuff_esquive;
      y.malusEsqTours = e.debuff_tours ?? 0;
      evenements.push({
        type: 'debuff', tour, acteur: x.camp, cible: y.camp,
        stat: 'esquive', valeur: e.debuff_esquive, tours: y.malusEsqTours,
      });
    }
    // Blocage de régén (Crocodile) : coupe la régén Zoan de la cible.
    if (e.bloque_regen_tours !== undefined) {
      y.regenBloqueeTours = e.bloque_regen_tours;
      evenements.push({
        type: 'debuff', tour, acteur: x.camp, cible: y.camp,
        stat: 'regen', valeur: 1, tours: e.bloque_regen_tours,
      });
    }
    // Poison (Mr.5) : X % de l'Attack DE BASE de l'attaquant (pas son Attack buffée), par tour.
    if (e.poison_pct !== undefined) {
      y.poisonDegats = x.atkBase * e.poison_pct;
      y.poisonTours = e.poison_tours ?? 0;
    }
  }

  // ---- Fin de tour : régén, poison, expiration des malus ------------------
  function finDeTour(x: Etat, tour: number): void {
    if (x.pv <= 0) return; // un mort ne régénère pas et n'est plus empoisonné

    // Passif Zoan (§2) : régénère zoan_regen % des PV max à CHAQUE tour, dès le tour 1,
    // transformé ou non. ⚠️ Falaise connue : 1,2 % → Zoan 49 %, 1,3 % → Zoan 60 %.
    if (x.classe === 'Zoan' && x.regenBloqueeTours <= 0) {
      const soin = Math.min(x.pvMax, x.pv + x.pvMax * config.zoan_regen) - x.pv;
      x.pv += soin;
      if (soin > 0) {
        evenements.push({
          type: 'regen', tour, acteur: x.camp,
          valeur: soin, pv_restants: pvAffiche(x), pv_max: x.pvMax,
        });
      }
    }
    if (x.regenBloqueeTours > 0) x.regenBloqueeTours -= 1;

    // Poison : ignore la résistance (c'est du poison, pas un coup).
    if (x.poisonTours > 0) {
      x.pv -= x.poisonDegats;
      x.poisonTours -= 1;
      evenements.push({
        type: 'poison', tour, cible: x.camp,
        valeur: x.poisonDegats, pv_restants: pvAffiche(x), pv_max: x.pvMax,
      });
    }

    // Expiration des malus
    if (x.malusAtk > 0 && --x.malusAtkTours <= 0) x.malusAtk = 0;
    if (x.malusEsq > 0 && --x.malusEsqTours <= 0) x.malusEsq = 0;
  }

  // ---- Déroulé du combat -------------------------------------------------

  // Passif Sniper (§2) : il tire une fois AVANT le tour 1 (attaque gratuite d'ouverture).
  // Ce tir est un coup normal (pas de critique possible, le Sniper n'est pas Sabreur),
  // mais le triangle, l'esquive et la résistance s'y appliquent.
  // Dans un miroir Sniper vs Sniper, personne ne tire : les deux tirs s'annuleraient.
  if (config.sniper_ouverture) {
    for (const [x, y] of [[A, B], [B, A]] as const) {
      if (x.classe === 'Sniper' && y.classe !== 'Sniper') {
        evenements.push({ type: 'attaque', tour: 0, acteur: x.camp, cible: y.camp, ouverture: true });
        frapper(x, y, 1, 0);
      }
    }
  }

  let tour = 0;
  for (tour = 1; tour <= config.max_tours; tour++) {
    // Qui frappe en premier est tiré au sort à chaque tour.
    const ordre = rng() < 0.5 ? [A, B] : [B, A];
    for (const x of ordre) {
      const y = autre(x);
      if (x.pv > 0 && y.pv > 0) agir(x, y, tour);
    }
    for (const x of [A, B]) finDeTour(x, tour);

    if (A.pv <= 0 || B.pv <= 0) break;
  }

  // ---- Verdict -----------------------------------------------------------
  const aKO = A.pv <= 0;
  const bKO = B.pv <= 0;
  let vainqueur: Camp;
  let raison: 'ko' | 'double_ko' | 'limite_tours';

  if (aKO || bKO) {
    if (aKO) evenements.push({ type: 'ko', tour, perso: 'a' });
    if (bKO) evenements.push({ type: 'ko', tour, perso: 'b' });
    if (aKO && bKO) {
      // Double KO : on tranche à pile ou face, mais avec le hasard du combat → reproductible.
      vainqueur = rng() < 0.5 ? 'a' : 'b';
      raison = 'double_ko';
    } else {
      vainqueur = aKO ? 'b' : 'a';
      raison = 'ko';
    }
  } else {
    // Limite de tours atteinte. Ne devrait jamais arriver (un combat dure ~8 tours, la
    // limite est à 200) : c'est une ceinture de sécurité. On départage aux PV restants.
    tour = config.max_tours;
    const partA = A.pv / A.pvMax;
    const partB = B.pv / B.pvMax;
    vainqueur = partA === partB ? (rng() < 0.5 ? 'a' : 'b') : (partA > partB ? 'a' : 'b');
    raison = 'limite_tours';
  }

  evenements.push({ type: 'fin', tour, vainqueur, raison });

  return {
    vainqueur,
    tours: tour,
    seed,
    combattants: [
      { camp: 'a', nom: A.nom, classe: A.classe, niveau: a.niveau, pv_max: A.pvMax, attack: A.atkBase },
      { camp: 'b', nom: B.nom, classe: B.classe, niveau: b.niveau, pv_max: B.pvMax, attack: B.atkBase },
    ],
    evenements,
  };
}
