// ONE PIECE ARENA — le vocabulaire du moteur de combat.
// Ce fichier ne contient AUCUN chiffre : que des noms de choses.
// Les chiffres vivent en base (tables `config` et `characters`), jamais ici. (§6 GAME_DESIGN)

export type Classe = 'Haki' | 'Logia' | 'Paramecia' | 'Zoan' | 'Sniper' | 'Sabreur';
export type Rarete = 'Commun' | 'Peu commun' | 'Rare' | 'Epique' | 'Legendaire';
export type Profil = 'Bourrin' | 'Equilibre' | 'Tank';
export type Niveau = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// §4ter : L'ÉQUIPEMENT.
//
// Raretés VOLONTAIREMENT distinctes de celles des persos : un objet n'a rien à voir avec un
// perso Commun/Rare, et mélanger les deux échelles finirait par mélanger leurs taux de drop.
// L'ordre du tableau fait foi (du pire au meilleur) — c'est lui qui définit "la rareté
// au-dessus" pour le compteur de recyclage. Le Violet du §4 s'ajoutera à la fin.
// ---------------------------------------------------------------------------
export type RareteEquipement = 'Gris' | 'Vert' | 'Bleu';
export type TypeEquipement = 'Chapeau' | 'Tenue';

/** Le profil ne fait que répartir le budget entre PV et Attack : à rareté égale, les trois
 *  se valent exactement (§4 EQUILIBRAGE_FINAL). C'est un choix de style, pas de puissance. */
export type ProfilEquipement = 'equilibre' | 'pv' | 'atk';

/** Une entrée de `config.equipement_catalogue`. Les 18 objets du lancement. */
export interface ObjetEquipement {
  /** Identifiant stable ('chapeau_bleu_pv'). C'est la SEULE chose stockée en base sur un
   *  objet possédé : ses stats se relisent ici, pour qu'un rééquilibrage s'applique à tous. */
  cle: string;
  type: TypeEquipement;
  rarete: RareteEquipement;
  profil: ProfilEquipement;
  nom: string;
  /** ⚠️ §4ter : un objet ne donne QUE des PV et de l'Attack. Jamais d'esquive ni de crit,
   *  qui appartiennent aux classes — sinon le triangle du §2 se dérègle. */
  hp: number;
  attack: number;
}

// ---------------------------------------------------------------------------
// La config = la table `config`, chargée en mémoire au démarrage.
// Rééquilibrer le jeu = changer une ligne en base, pas une ligne de code.
// ---------------------------------------------------------------------------
export interface Config {
  hp_scale: number;          // 1 point de budget PV = N PV
  esquive_base: number;      // esquive de toutes les classes
  esquive_logia: number;     // bonus d'esquive Logia / Paramecia
  crit_sabreur: number;      // chance de critique du Sabreur
  crit_mult: number;         // multiplicateur des dégâts critiques
  zoan_regen: number;        // % des PV max régénérés par tour par le Zoan
  sniper_ouverture: boolean; // le Sniper tire-t-il avant le tour 1 ?
  counter_mult: number;      // bonus de dégâts quand on frappe la classe qu'on contre
  max_tours: number;         // garde-fou anti-combat infini
  triangle: Record<Classe, Classe[]>; // qui contre qui
  budgets: Record<Rarete, [number, number, number]>; // budget de puissance par niveau
  profils: Record<Profil, number>;    // le "h" de la formule du §4

  // §3bis / §4 : le tirage de perso (gacha). Absentes pour Légendaire tant qu'elle n'est
  // pas tirable — voir RARETES_TIRAGE dans config.ts.
  drop_rates: Partial<Record<Rarete, number>>;        // taux GLOBAL par rareté (se partage entre ses persos)
  cout_tirage_perso: number;                           // Berrys, un tirage
  recyclage_doublon: Partial<Record<Rarete, number>>;  // Berrys gagnés en recyclant un doublon

  // Brique 6 : tirage premium (points de chaîne Twitch). Même pool de persos que drop_rates,
  // meilleurs taux — jamais de contenu exclusif (§5bis GAME_DESIGN).
  drop_rates_premium: Partial<Record<Rarete, number>>;

  // §4 : gains de combat.
  gain_combat_gagne: number;  // Berrys si le combat est gagné
  gain_combat_perdu: number;  // Berrys même en perdant (plancher garanti)

  // Brique 6 : présence en live (§3 GAME_DESIGN). Crédités dans un compteur "en attente",
  // jamais versés automatiquement — le joueur encaisse lui-même depuis l'accueil.
  gain_presence_tranche: number;      // Berrys par tranche de 30 min de présence détectée
  gain_bonus_connexion_live: number;  // Berrys, une fois par live, à la première présence détectée

  // §3 : progression du perso actif. Les seuils sont des XP CUMULÉS, strictement croissants.
  xp_combat_gagne: number;
  xp_combat_perdu: number;
  xp_niveau_2: number;
  xp_niveau_3: number;

  // §4 : recharge de l'énergie (quotidienne) et des changements de perso (hebdomadaire).
  energie_max: number;               // combats gratuits par jour
  changements_par_semaine: number;   // changements de perso actif gratuits par semaine
  /** Prix en Berrys des changements AU-DELÀ du quota gratuit, dans l'ordre : le 1er payant
   *  coûte la 1re valeur, le 2e la 2e, etc. La DERNIÈRE valeur fait plafond et se répète
   *  indéfiniment — c'est ce qui évite un prix qui exploserait sans limite. */
  changement_prix_paliers: number[];
  /** Fuseau IANA qui définit quand tombe "minuit" pour la recharge (ex: "Europe/Paris"). */
  fuseau_horaire: string;
  /** Heure locale de la remise à zéro, 0–23. 0 = minuit. */
  heure_reset: number;
  /** Jour de la remise à zéro hebdomadaire : 0 = dimanche … 6 = samedi. */
  jour_reset_hebdo: number;

  // §4bis : matchmaking anti-frustration.
  defaites_avant_bot_faible: number;
  bot_faible_raretes: Rarete[];  // raretés dans lesquelles un bot faible pioche
  bot_pseudos: string[];         // façade des bots — jamais rien qui trahisse un bot
  /** §4bis : le pool de bots, chacun défini à la main (perso + niveau). Remplace le tirage
   *  d'un perso au hasard dans le catalogue, qui ne donnait aucun contrôle sur la difficulté. */
  bots_pool: BotDef[];
  /** §4bis : un joueur ne doit pas retomber sur le même adversaire dans ses N derniers combats. */
  anti_repetition_combats: number;

  // §8 point 7 : la prime du classement. Ne monte jamais qu'en battant un VRAI joueur.
  prime_par_rarete: Record<Rarete, number>;  // points pour une victoire, selon la rareté battue
  prime_bonus_niveau: number;                // + ce ratio par niveau de l'adversaire au-dessus de 1

  // §8 : les quêtes. Le CONTENU (quelles quêtes, combien, quelle récompense) vit ici, en base ;
  // seule la façon de MESURER la progression est dans le code (quetes.ts). Ajouter/retirer une
  // quête = éditer cette liste, jamais le code.
  quetes_catalogue: QueteDef[];

  // §4ter : l'équipement.
  cout_coffre_equipement: number;                                // Berrys, un coffre
  drop_rates_equipement: Record<RareteEquipement, number>;       // doivent totaliser 100 %
  recyclage_equipement: Record<RareteEquipement, number>;        // Berrys rendus par une destruction
  /** Pièces à sacrifier pour un coffre GARANTI de la rareté au-dessus. Une rareté absente
   *  (ou à 0) n'est pas échangeable — c'est le cas du Bleu, qui n'a rien au-dessus tant que
   *  le Violet du §4 n'existe pas. Réglé à 6 Gris / 4 Vert, chiffré par
   *  `server/scripts/simu-equipement.ts`. */
  compteur_equipement: Partial<Record<RareteEquipement, number>>;
  /** Les 18 objets. Ajouter un objet = ajouter une ligne en base, jamais du code. */
  equipement_catalogue: ObjetEquipement[];
}

// ---------------------------------------------------------------------------
// §8 : LES QUÊTES.
//
// Trois familles, distinguées par `categorie` :
//  - 'jour'       : une seule affichée par jour, choisie par rotation (§8). Récompense à la
//                   remise à zéro quotidienne — donc réclamable de nouveau chaque jour.
//  - 'semaine'    : réinitialisée chaque semaine (même horloge que les changements de perso).
//  - 'collection' : succès PERMANENT, réclamable une seule fois à vie (compléter une classe
//                   ou une rareté). L'objectif est DYNAMIQUE : "tous les Épiques" suit
//                   automatiquement le nombre d'Épiques en base, sans rien changer ici.
// ---------------------------------------------------------------------------
export type CategorieQuete = 'jour' | 'semaine' | 'collection';

/**
 * Le `type` décide QUELLE mesure alimente la progression (voir quetes.ts) :
 *  - 'combats_joues'      : nombre de combats lancés sur la période.
 *  - 'combats_gagnes'     : nombre de combats gagnés sur la période.
 *  - 'coffres_ouverts'    : coffres d'équipement ouverts (dépend de l'équipement, §4ter).
 *  - 'collection_classe'  : posséder tous les persos d'une classe (`filtre` = la classe).
 *  - 'collection_rarete'  : posséder tous les persos d'une rareté (`filtre` = la rareté).
 */
export type TypeQuete =
  | 'combats_joues' | 'combats_gagnes' | 'coffres_ouverts'
  | 'collection_classe' | 'collection_rarete';

/** Un bot du pool (§4bis). Défini à la main, jamais généré : c'est ce qui permet de garder la
 *  main sur la difficulté rencontrée par un joueur qui n'a personne d'autre à affronter. */
export interface BotDef {
  /** Identité stable, utilisée par l'anti-répétition pour reconnaître un bot déjà affronté. */
  cle: string;
  /** Le pseudo montré au joueur. Ne doit JAMAIS trahir qu'il s'agit d'un bot. */
  pseudo: string;
  /** Le nom du perso dans `characters`. */
  perso: string;
  niveau: number;
  /** true = réservé à l'anti-frustration (quasi-victoire garantie après N défaites). */
  faible: boolean;
}

export interface QueteDef {
  /** Identifiant stable, sert de clé de réclamation en base. Ne jamais renommer une clé
   *  existante : ça rouvrirait une quête déjà réclamée. */
  cle: string;
  categorie: CategorieQuete;
  type: TypeQuete;
  /** Titre affiché au joueur ("Gagner 3 combats"). */
  titre: string;
  /** Berrys versés à la réclamation. */
  recompense: number;
  /** Palier à atteindre pour les quêtes de combat. Absent pour les quêtes de collection,
   *  dont l'objectif se calcule dynamiquement (nombre de persos concernés en base). */
  objectif?: number;
  /** La classe ou la rareté visée, pour les quêtes de collection. */
  filtre?: string;
  /** Une quête inactive reste en base mais n'est jamais proposée. Sert à préparer une quête
   *  dont le système n'existe pas encore (ex: "ouvrir un coffre" tant que l'équipement §4ter
   *  n'est pas construit) sans la coder en dur ni la supprimer. */
  actif: boolean;
}

// ---------------------------------------------------------------------------
// La compétence = les colonnes competence_* de la table `characters`.
// Toutes les propriétés d'effet sont optionnelles : un perso n'en utilise que 2 ou 3.
// ---------------------------------------------------------------------------
export type TypeCompetence = 'dmg' | 'buff' | 'transfo';

/** 'tour<=8' → au hasard, garanti au plus tard au tour 8. 'pv<=50%' → sous 50 % de PV. */
export type Declencheur =
  | { type: 'tour'; valeur: number }
  | { type: 'pv'; valeur: number };

export interface EffetCompetence {
  mult?: number;               // multiplicateur de dégâts du coup spécial
  crit_garanti?: boolean;      // ce coup est critique d'office
  vol_de_vie?: number;         // soigne l'attaquant de X % des dégâts infligés
  poison_pct?: number;         // poison : X % de l'Attack de base de l'attaquant, par tour
  poison_tours?: number;
  debuff_attack?: number;      // −X % d'Attack sur la cible
  debuff_esquive?: number;     // −X points d'esquive sur la cible
  debuff_tours?: number;
  bloque_regen_tours?: number; // bloque la régén Zoan de la cible pendant X tours
  atk_pct?: number;            // +X % d'Attack sur soi (buff / transfo)
  resistance?: number;         // résistance gagnée (transfo)
  esquive_pct?: number;        // +X points d'esquive sur soi (transfo)
}

export interface Competence {
  nom: string;
  type: TypeCompetence;
  declencheur: Declencheur;
  effet: EffetCompetence;
}

// ---------------------------------------------------------------------------
// Le perso du catalogue = une ligne de la table `characters`.
// ---------------------------------------------------------------------------
export interface Perso {
  nom: string;
  classe: Classe;
  rarete: Rarete;
  profil: Profil;
  cout_kit_pct: number;    // coût du kit, en POURCENT (1.1 = 1,1 %)
  resistance: number;      // résistance de base, 0 pour tout le monde aujourd'hui (§3)
  competence: Competence | null;
}

/** Ce qu'on envoie au moteur : un perso du catalogue + le niveau du joueur. */
export interface Engage {
  perso: Perso;
  niveau: Niveau;
  /** §4ter : les objets équipés sur CE perso (0 à 2 : un Chapeau, une Tenue).
   *
   *  ⚠️ Leur bonus s'AJOUTE aux stats une fois la formule du §4 appliquée, jamais avant.
   *  L'injecter dans le budget le ferait passer par la racine carrée du profil, et un même
   *  objet ne vaudrait alors plus la même chose sur un Tank et sur un Bourrin. */
  equipement?: readonly ObjetEquipement[];
}

// ---------------------------------------------------------------------------
// LES ÉVÉNEMENTS — le contrat entre le back et le front. (§6 GAME_DESIGN)
// Le serveur calcule tout, le front ne fait que rejouer cette liste dans l'ordre.
//
// `acteur` / `cible` valent 'a' ou 'b' : le camp. Le front sait qui est qui.
// `tour` vaut 0 pour le tir d'ouverture du Sniper (il a lieu AVANT le tour 1).
// ---------------------------------------------------------------------------
export type Camp = 'a' | 'b';

interface Base {
  tour: number;
}

export type Evenement =
  /** Coup normal. Suivi soit d'une `esquive`, soit d'un enchaînement crit/counter/resistance/degats. */
  | (Base & { type: 'attaque'; acteur: Camp; cible: Camp; ouverture?: true })

  /** Coup spécial. Remplace l'`attaque` sur le tour où il sort. */
  | (Base & { type: 'special'; acteur: Camp; cible: Camp; nom: string; categorie: TypeCompetence })

  /** La cible a esquivé : le coup ne fait rien, aucun `degats` ne suivra. */
  | (Base & { type: 'esquive'; acteur: Camp; cible: Camp })

  /** Coup critique (Sabreur, ou crit garanti d'un spécial). */
  | (Base & { type: 'crit'; acteur: Camp; cible: Camp; multiplicateur: number })

  /** L'attaquant contre la classe de la cible → bonus de dégâts (×1.1). */
  | (Base & { type: 'counter'; acteur: Camp; cible: Camp; multiplicateur: number })

  /** La cible encaisse mieux (transfo) : une partie des dégâts est absorbée. */
  | (Base & { type: 'resistance'; cible: Camp; valeur: number; degats_evites: number })

  /** Les dégâts réellement infligés. `valeur` est déjà tout compris (crit, counter, résistance). */
  | (Base & { type: 'degats'; acteur: Camp; cible: Camp; valeur: number; pv_restants: number; pv_max: number })

  /** Vol de vie : l'attaquant récupère des PV. La barre de vie MONTE. */
  | (Base & { type: 'soin'; acteur: Camp; source: 'vol_de_vie'; valeur: number; pv_restants: number; pv_max: number })

  /** Buff permanent sur soi (Kuroobi, Luffy). Aucun dégât ce tour-là. */
  | (Base & { type: 'buff'; acteur: Camp; stat: 'attack'; pct: number; avant: number; apres: number })

  /** Transformation (Dalton, Chopper, Pell) : le front bascule sur les assets de la forme transformée. */
  | (Base & { type: 'transformation'; acteur: Camp; resistance?: number; attack_pct?: number; esquive_pct?: number })

  /** Malus infligé à la cible pour quelques tours. */
  | (Base & { type: 'debuff'; acteur: Camp; cible: Camp; stat: 'attack' | 'esquive' | 'regen'; valeur: number; tours: number })

  /** Régénération Zoan, en fin de tour. */
  | (Base & { type: 'regen'; acteur: Camp; valeur: number; pv_restants: number; pv_max: number })

  /** Dégâts de poison, en fin de tour. Ignore la résistance. */
  | (Base & { type: 'poison'; cible: Camp; valeur: number; pv_restants: number; pv_max: number })

  /** PV tombés à 0. */
  | (Base & { type: 'ko'; perso: Camp })

  /** Toujours le dernier événement de la liste. */
  | (Base & { type: 'fin'; vainqueur: Camp; raison: 'ko' | 'double_ko' | 'limite_tours' });

// ---------------------------------------------------------------------------
// Le résultat d'un combat : ce que le back renvoie et stocke dans `fights.log`.
// ---------------------------------------------------------------------------
export interface Combattant {
  camp: Camp;
  nom: string;
  classe: Classe;
  niveau: Niveau;
  pv_max: number;
  attack: number;
}

export interface ResultatCombat {
  vainqueur: Camp;
  tours: number;
  seed: number;                 // rejouer le combat avec ce seed redonne exactement le même
  combattants: [Combattant, Combattant];
  evenements: Evenement[];
}
