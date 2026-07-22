// GRAND LINE ARENA — déclenche un combat réel : choisit l'adversaire, appelle le vrai moteur
// (combat.ts, jamais modifié), persiste le résultat, distribue les gains, prépare les sprites.
//
// Le §4bis est désormais couvert en entier (22/07/2026) : appariement aléatoire parmi les vrais
// joueurs, pool de bots défini à la main en config, anti-frustration (bot faible après N
// défaites) et anti-répétition sur les N derniers adversaires.

import type { Niveau, Config } from './index.ts';
import type { BotDef, Rarete } from './types.ts';
import { primeApresCombat } from './prime.ts';
import { chargerConfig, chargerPerso, simulerCombat } from './index.ts';
import { appliquerXpCombat, type GainXp } from './progression.ts';
import { appliquerRecharges } from './recharge-api.ts';
import { equipementDuPerso } from './equipement-api.ts';
import { supabaseSelect, supabaseSelectUn, supabaseInsert, supabaseUpdate } from './supabase.ts';
import { construirePacketSprite, type PacketSprite, type LigneCharacterRendu } from './sprites.ts';
import { urlPublique } from './assets.ts';
import type { ResultatCombat } from './types.ts';

interface LigneCharacterComplete extends LigneCharacterRendu {
  id: number;
  rarete: string;
  profil: string;
  cout_kit_pct: number;
  competence_nom: string | null;
  competence_type: string | null;
  competence_declencheur: string | null;
  // Le même type que `LigneCharacter` (config.ts), et non `unknown` : ces lignes sont
  // passées telles quelles à chargerPerso(), donc les deux déclarations doivent concorder.
  // Avec `unknown`, TypeScript refusait l'appel — une erreur qui dormait depuis le début du
  // projet, `server/` n'ayant jamais été vérifié faute de tsconfig.json.
  competence_effet?: string | Record<string, unknown> | null;
  image_menu: string | null;
  forme_transformee_id: number | null;
}

interface LigneJoueur {
  id: string;
  pseudo: string;
  berrys: number;
  energie: number;
  changements_restants: number;
  perso_actif_id: number | null;
  defaites_consecutives: number;
  prime: number;
  derniere_recharge: string;
  derniere_recharge_changements: string | null;
}

function clampNiveau(n: number): Niveau {
  return Math.min(3, Math.max(1, n)) as Niveau;
}

export interface SpritesCombattant {
  base: PacketSprite;
  transforme: PacketSprite | null;
  /** Le portrait fixe (image_menu), pour l'écran "VS" avant le combat — pas une frame d'anim. */
  portrait: string | null;
}

/** Ce que le front affiche sous le portrait de droite sur l'écran VS (§4bis).
 *  `est_bot` ne sort JAMAIS de l'API : un joueur qui inspecterait la réponse verrait
 *  immédiatement qu'on lui sert un bot, ce qui ruine tout l'intérêt de l'anti-frustration. */
export interface AdversaireAffiche {
  pseudo: string;
  niveau: Niveau;
  rarete: string;
}

export interface ResultatCombatComplet {
  resultat: ResultatCombat;
  spritesA: SpritesCombattant;
  spritesB: SpritesCombattant;
  /** Le joueur (ou la façade de bot) en face — « le pirate de Kevin ». */
  adversaire: AdversaireAffiche;
  /** Le niveau et la rareté du perso du joueur, pour l'écran VS. */
  moi: { pseudo: string; niveau: Niveau; rarete: string };
  /** §2 : qui bénéficie du triangle des classes, s'il joue. Calculé ici et pas côté front —
   *  le triangle vit dans `config`, le front n'a aucune raison d'en garder une copie en dur. */
  avantage: { camp: 'a' | 'b'; multiplicateur: number } | null;
  gains: {
    berrys: number; berrys_total: number; energie_restante: number;
    /** §3 : la progression du perso actif sur ce combat. */
    xp: GainXp;
    /** §8 point 7 : 0 contre un bot ou en cas de défaite — la prime ne bouge alors pas. */
    prime: number;
    prime_totale: number;
  };
}

async function chargerLigneCharacter(characterId: number): Promise<LigneCharacterComplete> {
  const ligne = await supabaseSelectUn<LigneCharacterComplete>('characters', { id: `eq.${characterId}`, select: '*' });
  if (!ligne) throw new Error(`Perso ${characterId} introuvable en base.`);
  return ligne;
}

async function construirePaquetPourPerso(ligne: LigneCharacterComplete): Promise<SpritesCombattant> {
  const base = await construirePacketSprite(ligne);
  const portrait = ligne.image_menu ? urlPublique(`${ligne.sprite_folder}/${ligne.image_menu}`) : null;
  if (ligne.forme_transformee_id === null) return { base, transforme: null, portrait };
  const ligneTransfo = await chargerLigneCharacter(ligne.forme_transformee_id);
  return { base, transforme: await construirePacketSprite(ligneTransfo), portrait };
}

const auHasard = <T>(liste: T[]): T => liste[Math.floor(Math.random() * liste.length)];

interface Adversaire {
  /** null = bot. Ne doit jamais transiter jusqu'au front tel quel (voir AdversaireAffiche). */
  joueurBId: string | null;
  characterId: number;
  niveau: Niveau;
  /** §4ter : l'entrée de collection de l'adversaire, pour retrouver son équipement.
   *  null pour un bot — les bots n'en portent JAMAIS. C'est voulu : leur équilibrage a été
   *  chiffré sans, et le bot faible de l'anti-frustration doit rester faible. */
  collectionId: number | null;
  /** Pseudo affiché : le vrai pseudo du joueur, ou celui du bot défini en config (§4bis). */
  pseudo: string;
  /** La clé du bot affronté, null pour un vrai joueur. Stockée dans `fights` pour que
   *  l'anti-répétition sache quel bot a déjà été servi — `joueur_b` est null dans ce cas. */
  botCle: string | null;
}

/**
 * Les adversaires des N derniers combats du joueur (§4bis anti-répétition).
 *
 * Deux identités distinctes selon la nature de l'adversaire : l'uuid pour un vrai joueur,
 * la clé du bot pour un bot. Un bot n'a pas de ligne dans `players`, et son pseudo seul ne
 * suffirait pas — deux bots peuvent partager un perso, seule la clé les sépare.
 */
async function adversairesRecents(playerId: string, config: Config): Promise<Set<string>> {
  if (config.anti_repetition_combats <= 0) return new Set();

  const derniers = await supabaseSelect<{ joueur_b: string | null; adversaire_bot_cle: string | null }>(
    'fights',
    {
      joueur_a: `eq.${playerId}`,
      select: 'joueur_b,adversaire_bot_cle',
      order: 'date.desc',
      limit: String(config.anti_repetition_combats),
    },
  );

  const vus = new Set<string>();
  for (const f of derniers) {
    if (f.joueur_b) vus.add(`joueur:${f.joueur_b}`);
    else if (f.adversaire_bot_cle) vus.add(`bot:${f.adversaire_bot_cle}`);
  }
  return vus;
}

/**
 * Écarte les candidats déjà affrontés récemment — SAUF si ça ne laisse plus personne.
 *
 * Ce repli n'est pas un détail : avec 2 joueurs inscrits et une exclusion sur 4 combats, la
 * règle stricte rendrait tout combat impossible. Mieux vaut répéter un adversaire que refuser
 * un combat déjà payé en énergie.
 */
function filtrerRecents<T>(candidats: T[], identite: (c: T) => string, vus: Set<string>): T[] {
  const restants = candidats.filter((c) => !vus.has(identite(c)));
  return restants.length > 0 ? restants : candidats;
}

/**
 * Choisit l'adversaire (§4bis).
 *
 * Ordre des règles :
 *   1. Anti-frustration — après N défaites consécutives, un bot faible du pool, déguisé en vrai
 *      viewer. C'est la règle prioritaire : un joueur qui enchaîne les défaites doit gagner le
 *      combat suivant, quel que soit le reste du pool.
 *   2. Sinon, un vrai joueur au hasard parmi ceux qui ont un perso actif (PvP asynchrone).
 *   3. Sinon (personne d'autre n'a encore joué), un bot ordinaire du pool.
 *
 * À chaque étape, les adversaires des N derniers combats sont écartés en priorité.
 */
async function choisirAdversaire(
  playerId: string, defaitesConsecutives: number, config: Config,
): Promise<Adversaire> {
  const vus = await adversairesRecents(playerId, config);

  /** Traduit un bot du pool en adversaire jouable. Plante si le bot désigne un perso absent
   *  du catalogue : c'est une faute de config, elle doit se voir tout de suite. */
  const depuisPool = async (bot: BotDef): Promise<Adversaire> => {
    const ligne = await supabaseSelectUn<{ id: number }>(
      'characters', { nom: `eq.${bot.perso}`, jouable: 'eq.true', select: 'id' },
    );
    if (!ligne) {
      throw new Error(
        `config : le bot "${bot.cle}" désigne le perso "${bot.perso}", introuvable parmi les persos jouables. `
        + 'Corrige `bots_pool` en config (§4bis).',
      );
    }
    return {
      joueurBId: null, characterId: ligne.id, niveau: clampNiveau(bot.niveau),
      collectionId: null, pseudo: bot.pseudo, botCle: bot.cle,
    };
  };

  // 1. Anti-frustration : bot faible garanti après N défaites d'affilée.
  if (defaitesConsecutives >= config.defaites_avant_bot_faible) {
    const faibles = config.bots_pool.filter((b) => b.faible);
    // chargerBotsPool() garantit qu'il y en a au moins un — pas de repli à prévoir ici.
    return depuisPool(auHasard(filtrerRecents(faibles, (b) => `bot:${b.cle}`, vus)));
  }

  // 2. Un vrai joueur.
  const autresJoueurs = await supabaseSelect<{ id: string; pseudo: string; perso_actif_id: number }>(
    'players', { id: `neq.${playerId}`, perso_actif_id: 'not.is.null', select: 'id,pseudo,perso_actif_id' },
  );
  if (autresJoueurs.length > 0) {
    const choisi = auHasard(filtrerRecents(autresJoueurs, (j) => `joueur:${j.id}`, vus));
    const coll = await supabaseSelectUn<{ character_id: number; niveau: number }>(
      'collection', { id: `eq.${choisi.perso_actif_id}`, select: 'character_id,niveau' },
    );
    if (coll) {
      return {
        joueurBId: choisi.id, characterId: coll.character_id,
        niveau: clampNiveau(coll.niveau), collectionId: choisi.perso_actif_id, pseudo: choisi.pseudo,
        botCle: null,
      };
    }
  }

  // 3. Bot ordinaire du pool. Son niveau est celui écrit en config et NON celui du joueur :
  //    le §4bis veut un pool défini à la main, donc une difficulté choisie, pas recalculée.
  const ordinaires = config.bots_pool.filter((b) => !b.faible);
  return depuisPool(auHasard(filtrerRecents(ordinaires, (b) => `bot:${b.cle}`, vus)));
}

/**
 * Qui profite du triangle des classes (§2) ? Sert uniquement à l'affichage de l'écran VS —
 * le vrai calcul de dégâts reste entier dans combat.ts, qui n'est jamais modifié.
 * Les deux sens sont testés : le triangle n'est pas symétrique (Zoan contre Haki, pas l'inverse).
 */
function calculerAvantage(
  classeA: string, classeB: string, config: Config,
): { camp: 'a' | 'b'; multiplicateur: number } | null {
  const contre = (x: string, y: string) => (config.triangle[x as keyof typeof config.triangle] ?? []).includes(y as never);
  if (contre(classeA, classeB)) return { camp: 'a', multiplicateur: config.counter_mult };
  if (contre(classeB, classeA)) return { camp: 'b', multiplicateur: config.counter_mult };
  return null;
}

export async function lancerCombat(playerId: string): Promise<ResultatCombatComplet> {
  const [joueur, lignesConfig] = await Promise.all([
    supabaseSelectUn<LigneJoueur>('players', { id: `eq.${playerId}`, select: '*' }),
    supabaseSelect('config', { select: 'cle,valeur' }),
  ]);
  if (!joueur) throw new Error('Joueur introuvable.');
  if (joueur.perso_actif_id === null) throw new Error('Aucun perso actif — va d\'abord en incarner un.');

  const config = chargerConfig(lignesConfig as { cle: string; valeur: unknown }[]);

  // La recharge passe AVANT le contrôle d'énergie : un joueur qui revient le lendemain doit
  // pouvoir combattre même s'il n'a pas rouvert l'accueil entre-temps.
  const recharge = await appliquerRecharges(joueur, config);
  if (recharge.energie <= 0) {
    throw new Error(
      `Plus de combats gratuits aujourd'hui (${config.energie_max}/jour) — reviens après la recharge quotidienne.`,
    );
  }

  const collActive = await supabaseSelectUn<{ character_id: number; niveau: number; xp: number }>(
    'collection', { id: `eq.${joueur.perso_actif_id}`, select: 'character_id,niveau,xp' },
  );
  if (!collActive) throw new Error('Perso actif introuvable dans la collection.');

  const niveauA = clampNiveau(collActive.niveau);
  const ligneA = await chargerLigneCharacter(collActive.character_id);
  const persoA = chargerPerso(ligneA);

  const adversaire = await choisirAdversaire(playerId, joueur.defaites_consecutives, config);
  const ligneB = await chargerLigneCharacter(adversaire.characterId);
  const persoB = chargerPerso(ligneB);

  // §4ter : chacun combat avec l'équipement soudé à SON perso. Les deux lectures partent
  // ensemble — l'adversaire n'en a aucun si c'est un bot (collectionId null).
  const [equipementA, equipementB] = await Promise.all([
    equipementDuPerso(joueur.perso_actif_id, config),
    adversaire.collectionId !== null
      ? equipementDuPerso(adversaire.collectionId, config)
      : Promise.resolve([]),
  ]);

  const resultat = simulerCombat(
    { perso: persoA, niveau: niveauA, equipement: equipementA },
    { perso: persoB, niveau: adversaire.niveau, equipement: equipementB },
    config,
  );

  const gagne = resultat.vainqueur === 'a';
  const gainBerrys = gagne ? config.gain_combat_gagne : config.gain_combat_perdu;
  const berrysTotal = joueur.berrys + gainBerrys;
  // Décrémente la valeur RECHARGÉE, pas celle de la ligne lue avant recharge.
  const energieRestante = recharge.energie - 1;

  // §3 : l'XP va au PERSO (collection), pas au compte — c'est lui qui monte en niveau.
  const xp = appliquerXpCombat(collActive.xp, gagne, config);

  // §4bis : la série de défaites ne compte que les vrais joueurs. Sans ce filtre, perdre contre
  // un bot déclencherait l'anti-frustration et le joueur ne verrait plus que des bots faibles.
  const contreVraiJoueur = adversaire.joueurBId !== null;
  const defaitesConsecutives = gagne ? 0
    : (contreVraiJoueur ? joueur.defaites_consecutives + 1 : joueur.defaites_consecutives);

  const vainqueurId = gagne ? playerId : adversaire.joueurBId;

  // §8 point 7 : la prime ne monte qu'en battant un VRAI joueur, et jamais ne redescend.
  const prime = primeApresCombat({
    primeAvant: joueur.prime,
    gagne,
    contreVraiJoueur,
    rareteAdversaire: ligneB.rarete as Rarete,
    niveauAdversaire: adversaire.niveau,
    config,
  });

  await Promise.all([
    supabaseUpdate('players', { id: `eq.${playerId}` }, {
      berrys: berrysTotal, energie: energieRestante, defaites_consecutives: defaitesConsecutives,
      prime: prime.prime,
    }),
    // Écrit même si le niveau n'a pas bougé : c'est l'XP qui avance à chaque combat.
    supabaseUpdate('collection', { id: `eq.${joueur.perso_actif_id}` }, {
      xp: xp.xp_apres, niveau: xp.niveau_apres,
    }),
    supabaseInsert('fights', {
      joueur_a: playerId,
      joueur_b: adversaire.joueurBId,
      vainqueur: vainqueurId,
      log: resultat.evenements,
      adversaire_character_id: adversaire.characterId,
      adversaire_pseudo: adversaire.pseudo,
      adversaire_bot_cle: adversaire.botCle,
      // Le perso QUE J'AI JOUÉ — nécessaire à la fiche joueur (palmarès, perso favori), qui ne
      // pouvait rien reconstruire sans ça (voir A_APPLIQUER_fiche_joueur.sql).
      joueur_a_character_id: collActive.character_id,
    }),
  ]);

  const [spritesA, spritesB] = await Promise.all([
    construirePaquetPourPerso(ligneA),
    construirePaquetPourPerso(ligneB),
  ]);

  return {
    resultat,
    spritesA,
    spritesB,
    adversaire: { pseudo: adversaire.pseudo, niveau: adversaire.niveau, rarete: ligneB.rarete },
    moi: { pseudo: joueur.pseudo, niveau: niveauA, rarete: ligneA.rarete },
    avantage: calculerAvantage(persoA.classe, persoB.classe, config),
    gains: {
      berrys: gainBerrys, berrys_total: berrysTotal, energie_restante: energieRestante, xp,
      prime: prime.gain, prime_totale: prime.prime,
    },
  };
}
