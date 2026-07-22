// GRAND LINE ARENA — chargement de la table `config` et de la table `characters`.
//
// Ce fichier transforme des LIGNES DE BASE en objets utilisables par le moteur.
// Il ne décide d'aucune valeur : si une clé manque en base, il plante avec un message clair
// plutôt que d'inventer une valeur par défaut. C'est volontaire — une constante silencieusement
// fausse, c'est 10 points de winrate qui bougent sans que personne ne le voie. (§8 EQUILIBRAGE)

import type {
  BotDef, CategorieQuete, Classe, Competence, Config, Declencheur, EffetCompetence, ObjetEquipement,
  Perso, Profil, ProfilEquipement, QueteDef, Rarete, RareteEquipement, TypeEquipement, TypeQuete,
} from './types.ts';
import { RARETES_EQUIPEMENT, TYPES_EQUIPEMENT } from './equipement.ts';

/** Une ligne de `select cle, valeur from config`. */
export interface LigneConfig {
  cle: string;
  valeur: unknown; // jsonb : Supabase renvoie déjà un number / boolean / objet
}

/** Une ligne de `select * from characters`. */
export interface LigneCharacter {
  nom: string;
  classe: string;
  rarete: string;
  profil: string;
  cout_kit_pct: number | string;
  resistance?: number | string | null;
  competence_nom?: string | null;
  competence_type?: string | null;
  competence_declencheur?: string | null;
  competence_effet?: string | Record<string, unknown> | null;
}

const RARETES: Rarete[] = ['Commun', 'Peu commun', 'Rare', 'Epique', 'Legendaire'];
const PROFILS: Profil[] = ['Bourrin', 'Equilibre', 'Tank'];
const CLASSES: Classe[] = ['Haki', 'Logia', 'Paramecia', 'Zoan', 'Sniper', 'Sabreur'];

/** Raretés tirables au gacha aujourd'hui (§3bis) : Légendaire n'est pas encore en jeu. */
export const RARETES_TIRAGE: Rarete[] = ['Commun', 'Peu commun', 'Rare', 'Epique'];

/** 'Peu commun' -> 'peu_commun' : le nom de rareté tel qu'il apparaît dans les clés de `config`. */
const slug = (s: string) => s.toLowerCase().replace(/ /g, '_');

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

/**
 * Construit la config du moteur à partir des lignes de la table `config`.
 * Toute clé manquante = erreur immédiate, avec le nom de la clé à ajouter en base.
 */
export function chargerConfig(lignes: LigneConfig[]): Config {
  const brut = new Map<string, unknown>();
  for (const l of lignes) brut.set(l.cle, l.valeur);

  const lire = (cle: string): unknown => {
    if (!brut.has(cle)) {
      throw new Error(
        `config : la clé "${cle}" est absente de la table config. ` +
        `Ajoute-la (voir supabase/seed/01_config.sql) — le moteur refuse d'inventer une valeur.`,
      );
    }
    const v = brut.get(cle);
    // jsonb peut arriver déjà décodé, ou en texte selon le client SQL utilisé.
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
    return v;
  };

  const nombre = (cle: string): number => {
    const v = lire(cle);
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) throw new Error(`config : la clé "${cle}" devrait être un nombre, reçu ${JSON.stringify(v)}.`);
    return n;
  };

  const booleen = (cle: string): boolean => {
    const v = lire(cle);
    if (typeof v === 'boolean') return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    throw new Error(`config : la clé "${cle}" devrait être true ou false, reçu ${JSON.stringify(v)}.`);
  };

  // Le triangle des classes : classe attaquante -> classes qu'elle contre.
  const triangleBrut = lire('triangle_counters') as Record<string, string[]>;
  const triangle = {} as Record<Classe, Classe[]>;
  for (const c of CLASSES) {
    const l = triangleBrut?.[c];
    if (!Array.isArray(l)) {
      throw new Error(`config : "triangle_counters" doit contenir une entrée pour la classe "${c}" (liste, éventuellement vide).`);
    }
    triangle[c] = l as Classe[];
  }

  // Budgets : une clé par rareté et par niveau (budget_commun_niv1, ...).
  const budgets = {} as Record<Rarete, [number, number, number]>;
  for (const r of RARETES) {
    budgets[r] = [1, 2, 3].map((n) => nombre(`budget_${slug(r)}_niv${n}`)) as [number, number, number];
  }

  // Profils : le "h" de la formule du §4 (profil_bourrin_h, ...).
  const profils = {} as Record<Profil, number>;
  for (const p of PROFILS) {
    const h = nombre(`profil_${slug(p)}_h`);
    if (h <= 0 || h >= 1) throw new Error(`config : "profil_${slug(p)}_h" doit être strictement entre 0 et 1, reçu ${h}.`);
    profils[p] = h;
  }

  // Tirage de perso (§3bis / §4) : taux et recyclage, uniquement pour les raretés tirables
  // aujourd'hui. Légendaire n'a pas encore de clé en base — voir GAME_DESIGN.md §3bis.
  const drop_rates = {} as Partial<Record<Rarete, number>>;
  const recyclage_doublon = {} as Partial<Record<Rarete, number>>;
  for (const r of RARETES_TIRAGE) {
    drop_rates[r] = nombre(`drop_rate_${slug(r)}`);
    recyclage_doublon[r] = nombre(`recyclage_doublon_${slug(r)}`);
  }
  const sommeTaux = Object.values(drop_rates).reduce((s, v) => s + (v ?? 0), 0);
  if (Math.abs(sommeTaux - 1) > 0.001) {
    throw new Error(
      `config : les drop_rate_* ne totalisent pas 100 % (somme = ${(sommeTaux * 100).toFixed(2)} %). ` +
      `Un tirage perd ou gagne des chances silencieusement — corrige avant de continuer (§3bis GAME_DESIGN).`,
    );
  }
  const cout_tirage_perso = nombre('cout_tirage_perso');

  // Brique 6 : tirage premium (mêmes raretés tirables, taux différents). Même garde-fou que
  // drop_rates — une somme fausse fait perdre ou gagner des chances silencieusement.
  const drop_rates_premium = {} as Partial<Record<Rarete, number>>;
  for (const r of RARETES_TIRAGE) {
    drop_rates_premium[r] = nombre(`drop_rate_premium_${slug(r)}`);
  }
  const sommeTauxPremium = Object.values(drop_rates_premium).reduce((s, v) => s + (v ?? 0), 0);
  if (Math.abs(sommeTauxPremium - 1) > 0.001) {
    throw new Error(
      `config : les drop_rate_premium_* ne totalisent pas 100 % (somme = ${(sommeTauxPremium * 100).toFixed(2)} %). ` +
      `Un tirage premium perd ou gagne des chances silencieusement — corrige avant de continuer (§5bis GAME_DESIGN).`,
    );
  }

  /** Une clé jsonb qui doit contenir un tableau de chaînes non vide. */
  const listeTexte = (cle: string): string[] => {
    const v = lire(cle);
    if (!Array.isArray(v) || v.length === 0 || v.some((x) => typeof x !== 'string')) {
      throw new Error(`config : la clé "${cle}" devrait être une liste de textes non vide, reçu ${JSON.stringify(v)}.`);
    }
    return v as string[];
  };

  /** Une clé qui doit contenir une chaîne non vide. */
  const texte = (cle: string): string => {
    const v = lire(cle);
    if (typeof v !== 'string' || v.trim() === '') {
      throw new Error(`config : la clé "${cle}" devrait être un texte non vide, reçu ${JSON.stringify(v)}.`);
    }
    return v;
  };

  /** Une clé jsonb qui doit contenir un tableau de nombres positifs, non vide. */
  const listeNombres = (cle: string): number[] => {
    const v = lire(cle);
    if (!Array.isArray(v) || v.length === 0 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) {
      throw new Error(`config : la clé "${cle}" devrait être une liste de nombres positifs non vide, reçu ${JSON.stringify(v)}.`);
    }
    return v as number[];
  };

  /** Un entier dans un intervalle fermé — les bornes fausses ne se verraient qu'en production. */
  const entierEntre = (cle: string, min: number, max: number): number => {
    const n = nombre(cle);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new Error(`config : la clé "${cle}" devrait être un entier entre ${min} et ${max}, reçu ${n}.`);
    }
    return n;
  };

  // §4 : recharge. Un fuseau invalide ferait planter Intl à la première requête, en pleine
  // production — on le teste ici, au chargement, pour échouer tout de suite et clairement.
  const fuseau_horaire = texte('fuseau_horaire');
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuseau_horaire }).format(new Date());
  } catch {
    throw new Error(
      `config : "fuseau_horaire" vaut "${fuseau_horaire}", que ce système ne reconnaît pas. `
      + 'Attendu un identifiant IANA, par exemple "Europe/Paris".',
    );
  }

  // §3 : progression. Les seuils sont CUMULÉS — non croissants, ils rendraient le niveau 3
  // atteignable avant le niveau 2, ce qui ne se verrait qu'en production sur un vrai joueur.
  const xp_niveau_2 = nombre('xp_niveau_2');
  const xp_niveau_3 = nombre('xp_niveau_3');
  if (!(xp_niveau_2 > 0 && xp_niveau_3 > xp_niveau_2)) {
    throw new Error(
      `config : les seuils d'XP doivent être strictement croissants (0 < xp_niveau_2 < xp_niveau_3), `
      + `reçu xp_niveau_2=${xp_niveau_2} et xp_niveau_3=${xp_niveau_3}.`,
    );
  }

  // §4bis : les raretés dans lesquelles un bot faible pioche son perso.
  const bot_faible_raretes = listeTexte('bot_faible_raretes').map((r) => {
    if (!(RARETES as string[]).includes(r)) {
      throw new Error(`config : "bot_faible_raretes" contient une rareté inconnue "${r}". Attendu : ${RARETES.join(', ')}.`);
    }
    return r as Rarete;
  });

  // §8 point 7 : ce que rapporte une victoire selon la rareté de l'adversaire battu. Mêmes
  // raretés que le tirage : un perso non tirable ne peut être le perso actif de personne, donc
  // ne peut jamais être l'adversaire d'un vrai joueur.
  const prime_par_rarete = {} as Record<Rarete, number>;
  for (const r of RARETES_TIRAGE) prime_par_rarete[r] = nombre(`prime_${slug(r)}`);

  const quetes_catalogue = chargerQuetesCatalogue(lire('quetes_catalogue'));

  // §4ter : l'équipement. Mêmes règles que le tirage de perso — les taux doivent totaliser
  // 100 %, sinon un coffre perd ou gagne des chances sans que personne ne le voie.
  const hp_scale = nombre('hp_scale');
  const drop_rates_equipement = {} as Record<RareteEquipement, number>;
  const recyclage_equipement = {} as Record<RareteEquipement, number>;
  for (const r of RARETES_EQUIPEMENT) {
    drop_rates_equipement[r] = nombre(`drop_rate_equipement_${slug(r)}`);
    recyclage_equipement[r] = nombre(`recyclage_equipement_${slug(r)}`);
  }
  const sommeEquip = Object.values(drop_rates_equipement).reduce((s, v) => s + v, 0);
  if (Math.abs(sommeEquip - 1) > 0.001) {
    throw new Error(
      `config : les drop_rate_equipement_* ne totalisent pas 100 % (somme = ${(sommeEquip * 100).toFixed(2)} %). ` +
      `Corrige avant de continuer (§4ter GAME_DESIGN).`,
    );
  }

  // Le compteur de recyclage. Une rareté sans rien au-dessus (le Bleu aujourd'hui) n'a pas
  // de clé : il n'y a pas de coffre à garantir. 0 = mécanique éteinte, ce qui reste valide.
  const compteur_equipement: Partial<Record<RareteEquipement, number>> = {};
  for (let i = 0; i < RARETES_EQUIPEMENT.length - 1; i++) {
    const r = RARETES_EQUIPEMENT[i];
    const seuil = nombre(`equipement_compteur_${slug(r)}`);
    if (!Number.isInteger(seuil) || seuil < 0) {
      throw new Error(`config : "equipement_compteur_${slug(r)}" doit être un entier positif ou nul (0 = désactivé), reçu ${seuil}.`);
    }
    compteur_equipement[r] = seuil;
  }

  const equipement_catalogue = chargerEquipementCatalogue(lire('equipement_catalogue'), hp_scale);

  return {
    hp_scale,
    esquive_base: nombre('esquive_base'),
    esquive_logia: nombre('esquive_logia'),
    crit_sabreur: nombre('crit_sabreur'),
    crit_mult: nombre('crit_mult'),
    zoan_regen: nombre('zoan_regen'),
    sniper_ouverture: booleen('sniper_ouverture'),
    counter_mult: nombre('counter_mult'),
    max_tours: nombre('max_tours'),
    triangle,
    budgets,
    profils,
    drop_rates,
    drop_rates_premium,
    cout_tirage_perso,
    recyclage_doublon,
    gain_combat_gagne: nombre('gain_combat_gagne'),
    gain_combat_perdu: nombre('gain_combat_perdu'),
    gain_presence_tranche: nombre('gain_presence_tranche'),
    gain_bonus_connexion_live: nombre('gain_bonus_connexion_live'),
    xp_combat_gagne: nombre('xp_combat_gagne'),
    xp_combat_perdu: nombre('xp_combat_perdu'),
    xp_niveau_2,
    xp_niveau_3,
    energie_max: nombre('energie_max'),
    changements_par_semaine: nombre('changements_par_semaine'),
    changement_prix_paliers: listeNombres('changement_prix_paliers'),
    fuseau_horaire,
    heure_reset: entierEntre('heure_reset', 0, 23),
    jour_reset_hebdo: entierEntre('jour_reset_hebdo', 0, 6),
    defaites_avant_bot_faible: nombre('defaites_avant_bot_faible'),
    bot_faible_raretes,
    bot_pseudos: listeTexte('bot_pseudos'),
    bots_pool: chargerBotsPool(lire('bots_pool')),
    anti_repetition_combats: entierEntre('anti_repetition_combats', 0, 20),
    prime_par_rarete,
    prime_bonus_niveau: nombre('prime_bonus_niveau'),
    quetes_catalogue,
    cout_coffre_equipement: nombre('cout_coffre_equipement'),
    drop_rates_equipement,
    recyclage_equipement,
    compteur_equipement,
    equipement_catalogue,
  };
}

// ---------------------------------------------------------------------------
// §4ter : le catalogue d'équipement
// ---------------------------------------------------------------------------

const PROFILS_EQUIPEMENT: ProfilEquipement[] = ['equilibre', 'pv', 'atk'];

/**
 * Valide le catalogue des objets (clé `equipement_catalogue` de la table config).
 *
 * La vérification qui compte vraiment est la DERNIÈRE : tous les objets d'une même rareté
 * doivent coûter exactement le même budget (`hp / hp_scale + attack`, §4 EQUILIBRAGE_FINAL).
 * C'est ce qui garantit que les trois profils sont interchangeables — un Chapeau orienté PV
 * et un Chapeau orienté Attack de même rareté doivent valoir pareil, sinon l'un des deux
 * devient un piège. Une faute de frappe sur un `hp` ne se verrait jamais autrement : l'objet
 * sortirait des coffres pendant des semaines en étant simplement meilleur que ses voisins.
 *
 * Le budget attendu n'est volontairement PAS écrit ici : il se déduit du catalogue lui-même.
 * Rééquilibrer une rareté = changer ses 6 objets en base, sans toucher au code.
 */
export function chargerEquipementCatalogue(brut: unknown, hp_scale: number): ObjetEquipement[] {
  if (!Array.isArray(brut) || brut.length === 0) {
    throw new Error('config : "equipement_catalogue" devrait être une liste d\'objets non vide.');
  }

  const clesVues = new Set<string>();
  const objets: ObjetEquipement[] = brut.map((x, i) => {
    const ou = `equipement_catalogue[${i}]`;
    if (typeof x !== 'object' || x === null) throw new Error(`config : ${ou} n'est pas un objet.`);
    const o = x as Record<string, unknown>;

    const cle = o.cle;
    if (typeof cle !== 'string' || cle.trim() === '') throw new Error(`config : ${ou}.cle doit être un texte non vide.`);
    if (clesVues.has(cle)) {
      throw new Error(`config : deux objets partagent la clé "${cle}". Elle identifie l'objet en base — elle doit être unique.`);
    }
    clesVues.add(cle);

    const dans = <T extends string>(champ: string, liste: T[]): T => {
      const v = o[champ];
      if (typeof v !== 'string' || !(liste as string[]).includes(v)) {
        throw new Error(`config : ${ou}.${champ} ("${String(v)}") invalide. Attendu : ${liste.join(', ')}.`);
      }
      return v as T;
    };

    if (typeof o.nom !== 'string' || o.nom.trim() === '') throw new Error(`config : ${ou}.nom doit être un texte non vide.`);

    const entierPositif = (champ: string): number => {
      const v = o[champ];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
        throw new Error(`config : ${ou}.${champ} doit être un entier positif ou nul, reçu ${JSON.stringify(v)}.`);
      }
      return v;
    };
    const hp = entierPositif('hp');
    const attack = entierPositif('attack');
    if (hp === 0 && attack === 0) {
      throw new Error(`config : ${ou} ("${o.nom}") ne donne ni PV ni Attack — un objet vide n'a aucune raison d'exister.`);
    }

    return {
      cle,
      type: dans<TypeEquipement>('type', TYPES_EQUIPEMENT),
      rarete: dans<RareteEquipement>('rarete', RARETES_EQUIPEMENT),
      profil: dans<ProfilEquipement>('profil', PROFILS_EQUIPEMENT),
      nom: o.nom,
      hp,
      attack,
    };
  });

  // Chaque combinaison type × rareté doit exister : sans ça, un coffre peut tirer une
  // combinaison vide et planter le joueur au moment de l'ouverture.
  for (const type of TYPES_EQUIPEMENT) {
    for (const rarete of RARETES_EQUIPEMENT) {
      if (!objets.some((o) => o.type === type && o.rarete === rarete)) {
        throw new Error(`config : "equipement_catalogue" ne contient aucun ${type} de rareté ${rarete}.`);
      }
    }
  }

  // Un budget unique par rareté, et strictement croissant d'une rareté à l'autre.
  const budgets = new Map<RareteEquipement, number>();
  for (const o of objets) {
    const budget = o.hp / hp_scale + o.attack;
    const attendu = budgets.get(o.rarete);
    if (attendu === undefined) { budgets.set(o.rarete, budget); continue; }
    if (Math.abs(budget - attendu) > 1e-9) {
      throw new Error(
        `config : "${o.nom}" (${o.cle}) coûte ${budget.toFixed(2)} points de budget alors que les autres ` +
        `objets ${o.rarete} en coûtent ${attendu.toFixed(2)}. À rareté égale, tous les objets doivent valoir ` +
        `exactement pareil (hp / hp_scale + attack), sinon un profil devient meilleur qu'un autre.`,
      );
    }
  }
  for (let i = 1; i < RARETES_EQUIPEMENT.length; i++) {
    const bas = budgets.get(RARETES_EQUIPEMENT[i - 1])!;
    const haut = budgets.get(RARETES_EQUIPEMENT[i])!;
    if (!(haut > bas)) {
      throw new Error(
        `config : les objets ${RARETES_EQUIPEMENT[i]} (${haut} points) ne sont pas meilleurs que les ` +
        `${RARETES_EQUIPEMENT[i - 1]} (${bas} points). La rareté doit toujours valoir plus.`,
      );
    }
  }

  return objets;
}

// ---------------------------------------------------------------------------
// §8 : quêtes
// ---------------------------------------------------------------------------

const CATEGORIES_QUETE: CategorieQuete[] = ['jour', 'semaine', 'collection'];
const TYPES_QUETE: TypeQuete[] = [
  'combats_joues', 'combats_gagnes', 'coffres_ouverts', 'collection_classe', 'collection_rarete',
];

/**
 * Valide le catalogue de quêtes (clé `quetes_catalogue` de la table config).
 *
 * On plante au démarrage sur la moindre entrée mal formée plutôt que de la sauter en silence :
 * une quête invalide, c'est soit une récompense qui ne tombe jamais, soit une clé en double qui
 * escamote une réclamation — deux bugs qu'on ne verrait qu'en production, sur un vrai joueur.
 */
/**
 * §4bis : le pool de bots. Chaque bot est écrit à la main en config (perso + niveau), jamais
 * généré — c'est ce qui donne le contrôle sur la difficulté servie à un joueur seul.
 *
 * Le nom du perso n'est PAS vérifié ici contre `characters` : chargerConfig() ne connaît que
 * la config, pas le catalogue. C'est combat-api.ts qui plante à la sélection si un bot désigne
 * un perso inexistant — avec le nom fautif dans le message.
 */
export function chargerBotsPool(brut: unknown): BotDef[] {
  if (!Array.isArray(brut) || brut.length === 0) {
    throw new Error('config : "bots_pool" devrait être une liste de bots non vide (§4bis).');
  }

  const clesVues = new Set<string>();
  const pool = brut.map((b, i) => {
    const ou = `bots_pool[${i}]`;
    if (typeof b !== 'object' || b === null) throw new Error(`config : ${ou} n'est pas un objet.`);
    const o = b as Record<string, unknown>;

    for (const champ of ['cle', 'pseudo', 'perso'] as const) {
      if (typeof o[champ] !== 'string' || (o[champ] as string).trim() === '') {
        throw new Error(`config : ${ou}.${champ} doit être un texte non vide.`);
      }
    }
    const cle = o.cle as string;
    if (clesVues.has(cle)) {
      throw new Error(`config : deux bots partagent la clé "${cle}". Elle doit être unique (l'anti-répétition s'en sert pour les distinguer).`);
    }
    clesVues.add(cle);

    if (typeof o.niveau !== 'number' || !Number.isInteger(o.niveau) || o.niveau < 1 || o.niveau > 3) {
      throw new Error(`config : ${ou}.niveau doit être un entier entre 1 et 3, reçu ${JSON.stringify(o.niveau)}.`);
    }
    if (typeof o.faible !== 'boolean') throw new Error(`config : ${ou}.faible doit être true ou false.`);

    return { cle, pseudo: o.pseudo as string, perso: o.perso as string, niveau: o.niveau, faible: o.faible };
  });

  // Sans bot faible, l'anti-frustration n'a rien à servir après N défaites — et un joueur en
  // pleine mauvaise passe continuerait d'enchaîner les défaites, exactement ce que le §4bis
  // cherche à éviter.
  if (!pool.some((b) => b.faible)) {
    throw new Error('config : "bots_pool" ne contient aucun bot avec faible:true — l\'anti-frustration (§4bis) n\'aurait rien à proposer.');
  }
  if (!pool.some((b) => !b.faible)) {
    throw new Error('config : "bots_pool" ne contient que des bots faibles — un joueur sans adversaire ne rencontrerait que des combats gagnés d\'avance.');
  }

  return pool;
}

export function chargerQuetesCatalogue(brut: unknown): QueteDef[] {
  if (!Array.isArray(brut) || brut.length === 0) {
    throw new Error('config : "quetes_catalogue" devrait être une liste de quêtes non vide.');
  }

  const clesVues = new Set<string>();
  return brut.map((q, i) => {
    const ou = `quetes_catalogue[${i}]`;
    if (typeof q !== 'object' || q === null) throw new Error(`config : ${ou} n'est pas un objet.`);
    const o = q as Record<string, unknown>;

    const cle = o.cle;
    if (typeof cle !== 'string' || cle.trim() === '') throw new Error(`config : ${ou}.cle doit être un texte non vide.`);
    if (clesVues.has(cle)) throw new Error(`config : deux quêtes partagent la clé "${cle}". Chaque clé doit être unique (elle sert de clé de réclamation).`);
    clesVues.add(cle);

    const categorie = o.categorie;
    if (!(CATEGORIES_QUETE as string[]).includes(categorie as string)) {
      throw new Error(`config : ${ou}.categorie ("${String(categorie)}") inconnue. Attendu : ${CATEGORIES_QUETE.join(', ')}.`);
    }
    const type = o.type;
    if (!(TYPES_QUETE as string[]).includes(type as string)) {
      throw new Error(`config : ${ou}.type ("${String(type)}") inconnu. Attendu : ${TYPES_QUETE.join(', ')}.`);
    }
    if (typeof o.titre !== 'string' || o.titre.trim() === '') throw new Error(`config : ${ou}.titre doit être un texte non vide.`);
    if (typeof o.recompense !== 'number' || !Number.isFinite(o.recompense) || o.recompense < 0) {
      throw new Error(`config : ${ou}.recompense doit être un nombre positif, reçu ${JSON.stringify(o.recompense)}.`);
    }
    if (typeof o.actif !== 'boolean') throw new Error(`config : ${ou}.actif doit être true ou false.`);

    const estCollection = type === 'collection_classe' || type === 'collection_rarete';
    if (estCollection) {
      // L'objectif d'une quête de collection est calculé en direct (nb de persos concernés) :
      // le figer ici le désynchroniserait dès qu'on ajoute un perso.
      const listeAttendue = type === 'collection_classe' ? CLASSES : RARETES;
      if (typeof o.filtre !== 'string' || !(listeAttendue as string[]).includes(o.filtre)) {
        throw new Error(`config : ${ou}.filtre ("${String(o.filtre)}") invalide. Attendu une valeur parmi : ${listeAttendue.join(', ')}.`);
      }
    } else {
      // Quête de combat/coffre : un palier chiffré est obligatoire.
      if (typeof o.objectif !== 'number' || !Number.isInteger(o.objectif) || o.objectif <= 0) {
        throw new Error(`config : ${ou}.objectif doit être un entier positif pour une quête de type "${type}", reçu ${JSON.stringify(o.objectif)}.`);
      }
    }

    return {
      cle,
      categorie: categorie as CategorieQuete,
      type: type as TypeQuete,
      titre: o.titre,
      recompense: o.recompense,
      objectif: typeof o.objectif === 'number' ? o.objectif : undefined,
      filtre: typeof o.filtre === 'string' ? o.filtre : undefined,
      actif: o.actif,
    };
  });
}

// ---------------------------------------------------------------------------
// characters
// ---------------------------------------------------------------------------

/**
 * Lit le déclencheur tel qu'il est stocké en base : 'tour<=8' ou 'pv<=60%'.
 * - 'tour<=8' : tour de sortie tiré au hasard, garanti au plus tard au tour 8.
 * - 'pv<=60%' : sort dès que le perso passe sous 60 % de ses PV.
 */
export function lireDeclencheur(texte: string): Declencheur {
  const tour = /^tour<=(\d+(?:\.\d+)?)$/.exec(texte.trim());
  if (tour) return { type: 'tour', valeur: Number(tour[1]) };

  const pv = /^pv<=(\d+(?:\.\d+)?)%$/.exec(texte.trim());
  if (pv) return { type: 'pv', valeur: Number(pv[1]) / 100 };

  throw new Error(
    `characters.competence_declencheur : "${texte}" est illisible. ` +
    `Formats acceptés : "tour<=8" ou "pv<=60%".`,
  );
}

/** Construit un perso du moteur à partir d'une ligne de `characters`. */
export function chargerPerso(l: LigneCharacter): Perso {
  const dansListe = <T extends string>(valeur: string, liste: T[], colonne: string): T => {
    if (!(liste as string[]).includes(valeur)) {
      throw new Error(`characters."${colonne}" : "${valeur}" inconnu pour le perso ${l.nom}. Attendu : ${liste.join(', ')}.`);
    }
    return valeur as T;
  };

  let competence: Competence | null = null;
  if (l.competence_nom) {
    if (!l.competence_type || !l.competence_declencheur) {
      throw new Error(`${l.nom} : competence_type et competence_declencheur sont obligatoires dès qu'il y a une competence_nom.`);
    }
    if (l.competence_effet === null || l.competence_effet === undefined || l.competence_effet === '') {
      throw new Error(
        `${l.nom} : competence_effet est vide. Les chiffres de la compétence (×1.6, vol de vie...) ` +
        `doivent être en base — exécute supabase/seed/03_competences.sql.`,
      );
    }
    const effet: EffetCompetence = typeof l.competence_effet === 'string'
      ? JSON.parse(l.competence_effet)
      : (l.competence_effet as EffetCompetence);

    const type = dansListe(l.competence_type, ['dmg', 'buff', 'transfo'], 'competence_type');
    if (type === 'dmg' && typeof effet.mult !== 'number') {
      throw new Error(`${l.nom} : une compétence de type "dmg" doit avoir un "mult" dans competence_effet.`);
    }

    competence = {
      nom: l.competence_nom,
      type,
      declencheur: lireDeclencheur(l.competence_declencheur),
      effet,
    };
  }

  return {
    nom: l.nom,
    classe: dansListe(l.classe, CLASSES, 'classe'),
    rarete: dansListe(l.rarete, RARETES, 'rarete'),
    profil: dansListe(l.profil, PROFILS, 'profil'),
    cout_kit_pct: Number(l.cout_kit_pct),
    // §3 : la résistance vaut 0 par défaut → rétrocompatible avec tout l'existant.
    resistance: Number(l.resistance ?? 0),
    competence,
  };
}
