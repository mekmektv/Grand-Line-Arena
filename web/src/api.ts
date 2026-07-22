// ONE PIECE ARENA — client HTTP vers le backend (server/). Le cookie de session part tout
// seul avec `credentials: 'include'` : pas de token à gérer côté front.

// En production, front et API sont servis par le même domaine Vercel : l'API vit sous /api,
// une adresse relative suffit donc et il n'y a AUCUNE variable à configurer côté hébergeur —
// une variable oubliée ou mal recopiée est la première cause de « ça marche en local, pas en
// ligne ». En local, web/.env pointe vers http://localhost:8787, l'API ayant son propre port.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface PersoActif {
  collection_id: number;
  nom: string;
  classe: string;
  rarete: string;
  niveau: number;
  xp: number;
  pv: number;
  attack: number;
  sprite_folder: string;
  image_menu_url: string | null;
}

/** Les étapes de l'arrivée d'un joueur (§4). Doit rester aligné sur server/src/onboarding.ts. */
export const ETAPE_PREMIER_TIRAGE = 0;
export const ETAPE_TUTO_ACCUEIL = 1;
export const ETAPE_COFFRE_OFFERT = 2;
export const ETAPE_TERMINE = 3;

export interface EtatJoueur {
  pseudo: string;
  /** Photo de profil Twitch. null pour les comptes de dev, qui n'en ont pas. */
  avatar_url: string | null;
  /** Où en est le joueur dans son parcours d'arrivée (§4). 3 = terminé. */
  onboarding_etape: number;
  berrys: number;
  energie: number;
  changements_restants: number;
  /** Ce que coûtera le prochain changement de perso. 0 = encore gratuit (§3). */
  prochain_changement_cout: number;
  perso_actif: PersoActif | null;
  /** Brique 6 : Berrys de présence live pas encore encaissés (le joueur clique pour les récupérer). */
  presence_berrys_en_attente: number;
  /** Brique 6 : coffres premium en stock, à ouvrir depuis l'écran Tirage. */
  coffres_premium_perso: number;
  /** Brique 6 : true si le live est en cours. */
  live_en_direct: boolean;
}

export class ErreurAuth extends Error {}

export async function recupererEtat(): Promise<EtatJoueur> {
  const res = await fetch(`${API_URL}/etat`, { credentials: 'include' });
  if (res.status === 401) throw new ErreurAuth('non connecté');
  if (!res.ok) throw new Error(`GET /etat → ${res.status}`);
  return res.json();
}

export function urlLoginTwitch(): string {
  return `${API_URL}/auth/twitch/login`;
}

export function urlLoginDev(pseudo: string): string {
  return `${API_URL}/auth/dev/login?pseudo=${encodeURIComponent(pseudo)}`;
}

export async function seDeconnecter(): Promise<void> {
  await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
}

export interface CarteCollection {
  character_id: number;
  nom: string;
  classe: string;
  rarete: string;
  image_menu_url: string | null;
  possede: boolean;
  actif: boolean;
  collection_id?: number;
  niveau?: number;
  xp?: number;
  progression_pct?: number;
  xp_avant_prochain_niveau?: number | null;
  pv?: number;
  attack?: number;
  competence_nom?: string | null;
  competence_desc?: string | null;
}

export type ResultatRecyclage =
  | { ok: true; berrys_gagnes: number; berrys_total: number; nom: string }
  | { ok: false; erreur: string };

/** Recycle un perso possédé contre des Berrys — depuis le tirage OU la collection (§4). */
export async function recyclerPerso(collectionId: number): Promise<ResultatRecyclage> {
  const res = await fetch(`${API_URL}/recycler`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection_id: collectionId }),
  });
  return res.json();
}

export async function recupererCollection(): Promise<CarteCollection[]> {
  const res = await fetch(`${API_URL}/collection`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /collection → ${res.status}`);
  return res.json();
}

export type ResultatChangementPerso =
  | {
    ok: true; gratuit: boolean; cout: number;
    changements_restants: number; berrys: number; prochain_cout: number;
  }
  | { ok: false; erreur: string };

export async function changerPersoActif(collectionId: number): Promise<ResultatChangementPerso> {
  const res = await fetch(`${API_URL}/perso-actif`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection_id: collectionId }),
  });
  return res.json();
}

export interface ResultatTirage {
  /** Stats au niveau 1 (un perso tiré n'a pas d'XP) — pour la révélation en cascade. */
  perso: {
    nom: string; classe: string; rarete: string; image_menu_url: string | null;
    pv: number; attack: number;
    competence_nom: string | null; competence_desc: string | null;
  };
  doublon: boolean;
  recyclage_gagne: number | null;
  collection_id: number | null;
  berrys_apres: number;
}

export async function tirerPerso(): Promise<ResultatTirage> {
  const res = await fetch(`${API_URL}/tirage`, { method: 'POST', credentials: 'include' });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /tirage → ${res.status}`);
  return corps;
}

/** Brique 6 : ouvre un coffre premium (stock gagné via points de chaîne). Même forme de
 *  résultat qu'un tirage normal, meilleurs taux. */
export async function ouvrirCoffrePremium(): Promise<ResultatTirage> {
  const res = await fetch(`${API_URL}/tirage/premium`, { method: 'POST', credentials: 'include' });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /tirage/premium → ${res.status}`);
  return corps;
}

/** Brique 6 : encaisse les Berrys de présence en attente vers le solde réel. */
export async function encaisserPresence(): Promise<{ berrys: number }> {
  const res = await fetch(`${API_URL}/presence/encaisser`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`POST /presence/encaisser → ${res.status}`);
  return res.json();
}

/** Le tirage de départ : Commun garanti, gratuit. Même forme de résultat qu'un tirage
 *  normal, pour que l'écran de roulette n'ait rien à traiter à part. */
export async function tirerPremierPerso(): Promise<ResultatTirage> {
  const res = await fetch(`${API_URL}/onboarding/premier-tirage`, { method: 'POST', credentials: 'include' });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /onboarding/premier-tirage → ${res.status}`);
  return corps;
}

/** Le coffre offert de fin d'onboarding : taux normaux, mais gratuit. */
export async function tirerCoffreOffert(): Promise<ResultatTirage> {
  const res = await fetch(`${API_URL}/onboarding/tirage-offert`, { method: 'POST', credentials: 'include' });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /onboarding/tirage-offert → ${res.status}`);
  return corps;
}

export async function avancerOnboarding(etape: number): Promise<void> {
  await fetch(`${API_URL}/onboarding/etape`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etape }),
  });
}

// ---------------------------------------------------------------------------
// Quêtes (§8). Le serveur renvoie déjà tout calculé (progression, accomplie, réclamable) :
// le front n'affiche que le résultat, il ne décide de rien.
// ---------------------------------------------------------------------------
export interface QueteAffichee {
  cle: string;
  categorie: 'jour' | 'semaine' | 'collection';
  titre: string;
  recompense: number;
  progression: number;
  objectif: number;
  accomplie: boolean;
  reclamee: boolean;
  reclamable: boolean;
}

export interface EtatQuetes {
  jour: QueteAffichee | null;
  semaine: QueteAffichee | null;
  collection: QueteAffichee[];
}

export async function recupererQuetes(): Promise<EtatQuetes> {
  const res = await fetch(`${API_URL}/quetes`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /quetes → ${res.status}`);
  return res.json();
}

export type ResultatReclamation =
  | { ok: true; recompense: number; berrys: number }
  | { ok: false; erreur: string };

export async function reclamerQuete(cle: string): Promise<ResultatReclamation> {
  const res = await fetch(`${API_URL}/quetes/reclamer`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cle }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Équipement (§4ter). Comme partout, le front n'a AUCUN chiffre : les stats des objets, les
// prix, les seuils du compteur arrivent tous du serveur, qui les lit en base.
// ---------------------------------------------------------------------------
export type RareteEquipement = 'Gris' | 'Vert' | 'Bleu';

export interface ObjetPossede {
  id: number;
  cle: string;
  type: 'Chapeau' | 'Tenue';
  rarete: RareteEquipement;
  profil: 'equilibre' | 'pv' | 'atk';
  nom: string;
  hp: number;
  attack: number;
  /** null = dans l'inventaire · sinon le perso sur lequel l'objet est soudé (§4ter). */
  collection_id: number | null;
}

/** Un sacrifice proposé : N objets d'une rareté détruits → 1 coffre garanti au-dessus. */
export interface SacrificePossible {
  rarete: RareteEquipement;
  rarete_obtenue: RareteEquipement;
  requis: number;
  /** Combien le joueur en a dans son INVENTAIRE (les objets portés ne comptent pas, §4ter). */
  disponibles: number;
  possible: boolean;
}

export interface EtatEquipement {
  inventaire: ObjetPossede[];
  /** Les objets portés, indexés par `collection_id`. */
  equipes: Record<number, ObjetPossede[]>;
  sacrifices: SacrificePossible[];
  cout_coffre: number;
  berrys: number;
  catalogue: Omit<ObjetPossede, 'id' | 'collection_id'>[];
}

export async function recupererEquipement(): Promise<EtatEquipement> {
  const res = await fetch(`${API_URL}/equipement`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /equipement → ${res.status}`);
  return res.json();
}

export interface ResultatCoffre {
  objet: ObjetPossede;
  berrys_apres: number;
  rarete_garantie: RareteEquipement;
  /** Les objets détruits par le sacrifice (vide pour un coffre payé en Berrys). */
  sacrifies: Omit<ObjetPossede, 'id' | 'collection_id'>[];
  sacrifices: SacrificePossible[];
  /** Ce que le perso visé porte déjà dans ce slot, pour la comparaison. null = slot libre. */
  actuel: ObjetPossede | null;
}

/**
 * Ouvre un coffre.
 *  - sans rien : payé en Berrys
 *  - `{ sacrifier: [ids] }` : détruit ces objets de l'inventaire pour un coffre garanti
 *  - `cible` : le perso auquel comparer le résultat (le perso actif par défaut)
 */
export async function ouvrirCoffre(
  options: { sacrifier?: number[]; cible?: number | null } = {},
): Promise<ResultatCoffre> {
  const corps: Record<string, unknown> = {};
  if (options.sacrifier?.length) corps.sacrifier = options.sacrifier;
  if (options.cible !== null && options.cible !== undefined) corps.cible = options.cible;

  const res = await fetch(`${API_URL}/coffre`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const reponse = await res.json();
  if (!res.ok) throw new Error(reponse.erreur ?? `POST /coffre → ${res.status}`);
  return reponse;
}

export interface ResultatEquiper {
  objet: ObjetPossede;
  equipes: ObjetPossede[];
  bonus: { hp: number; attack: number };
}

/** Soude un objet sur un perso. Échoue si le slot est occupé : il faut recycler d'abord. */
export async function equiperObjet(equipementId: number, collectionId: number): Promise<ResultatEquiper> {
  const res = await fetch(`${API_URL}/equipement/equiper`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipement_id: equipementId, collection_id: collectionId }),
  });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /equipement/equiper → ${res.status}`);
  return corps;
}

export interface ResultatRecyclageEquipement {
  berrys_gagnes: number;
  berrys_apres: number;
  etait_equipe: boolean;
  sacrifices: SacrificePossible[];
}

/** Détruit un objet contre des Berrys — la seule façon de libérer un slot (§4ter). */
export async function recyclerEquipement(equipementId: number): Promise<ResultatRecyclageEquipement> {
  const res = await fetch(`${API_URL}/equipement/recycler`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipement_id: equipementId }),
  });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /equipement/recycler → ${res.status}`);
  return corps;
}

export interface LigneClassement {
  rang: number; pseudo: string; prime: number; moi: boolean;
  /** Photo de profil Twitch. null pour les comptes de dev, qui n'en ont pas. */
  avatar_url: string | null;
}
export interface Classement { top: LigneClassement[]; moi: LigneClassement; }

export async function recupererClassement(): Promise<Classement> {
  const res = await fetch(`${API_URL}/classement`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /classement → ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Combat — le contrat d'événements de server/src/types.ts, dupliqué ici (pas de build
// partagé entre web/ et server/). Le front NE CALCULE RIEN : il rejoue cette liste (§6).
// ---------------------------------------------------------------------------
export type Camp = 'a' | 'b';
interface Base { tour: number; }

export type Evenement =
  | (Base & { type: 'attaque'; acteur: Camp; cible: Camp; ouverture?: true })
  | (Base & { type: 'special'; acteur: Camp; cible: Camp; nom: string; categorie: 'dmg' | 'buff' | 'transfo' })
  | (Base & { type: 'esquive'; acteur: Camp; cible: Camp })
  | (Base & { type: 'crit'; acteur: Camp; cible: Camp; multiplicateur: number })
  | (Base & { type: 'counter'; acteur: Camp; cible: Camp; multiplicateur: number })
  | (Base & { type: 'resistance'; cible: Camp; valeur: number; degats_evites: number })
  | (Base & { type: 'degats'; acteur: Camp; cible: Camp; valeur: number; pv_restants: number; pv_max: number })
  | (Base & { type: 'soin'; acteur: Camp; source: 'vol_de_vie'; valeur: number; pv_restants: number; pv_max: number })
  | (Base & { type: 'buff'; acteur: Camp; stat: 'attack'; pct: number; avant: number; apres: number })
  | (Base & { type: 'transformation'; acteur: Camp; resistance?: number; attack_pct?: number; esquive_pct?: number })
  | (Base & { type: 'debuff'; acteur: Camp; cible: Camp; stat: 'attack' | 'esquive' | 'regen'; valeur: number; tours: number })
  | (Base & { type: 'regen'; acteur: Camp; valeur: number; pv_restants: number; pv_max: number })
  | (Base & { type: 'poison'; cible: Camp; valeur: number; pv_restants: number; pv_max: number })
  | (Base & { type: 'ko'; perso: Camp })
  | (Base & { type: 'fin'; vainqueur: Camp; raison: 'ko' | 'double_ko' | 'limite_tours' });

export interface Combattant {
  camp: Camp; nom: string; classe: string; niveau: number; pv_max: number; attack: number;
}

export interface ResultatCombatBrut {
  vainqueur: Camp; tours: number; seed: number;
  combattants: [Combattant, Combattant];
  evenements: Evenement[];
}

export interface PacketSprite {
  nom: string; classe: string; taille: number; resistanceBase: number;
  urls: {
    idle: string[]; run: string[]; attack: string[]; hit: string[]; death: string[];
    special: string[]; special_effet: string[]; special_projectile: string[]; projectile: string[];
  };
  projSize: number; projH: number;
  spProjSize: number; spProjH: number;
  specialFps: number; spProjDur: number; spDelay: number;
  efX: number; efY: number; efSize: number; efOp: number; efFps: number;
  efPlan: 'derriere' | 'devant' | 'arriere';
  efLoop: boolean;
}

export interface SpritesCombattant { base: PacketSprite; transforme: PacketSprite | null; portrait: string | null; }

/** §3 : la progression du perso actif sur ce combat, calculée par le serveur (progression.ts). */
export interface GainXp {
  xp_gagnee: number;
  xp_avant: number;
  xp_apres: number;
  niveau_avant: number;
  niveau_apres: number;
  niveau_gagne: boolean;
  progression_pct: number;
  xp_avant_prochain_niveau: number | null;
}

/** §4bis : ce qu'on affiche du camp d'en face. Le serveur ne dit jamais si c'est un bot. */
export interface AdversaireAffiche { pseudo: string; niveau: number; rarete: string; }

export interface ResultatCombatComplet {
  resultat: ResultatCombatBrut;
  spritesA: SpritesCombattant;
  spritesB: SpritesCombattant;
  adversaire: AdversaireAffiche;
  moi: { pseudo: string; niveau: number; rarete: string };
  /** §2 : qui profite du triangle des classes. null si aucun des deux ne contre l'autre. */
  avantage: { camp: Camp; multiplicateur: number } | null;
  gains: {
    berrys: number; berrys_total: number; energie_restante: number; xp: GainXp;
    /** §8 point 7 : 0 contre un bot ou en cas de défaite — la prime ne bouge alors pas. */
    prime: number; prime_totale: number;
  };
}

export async function lancerCombat(): Promise<ResultatCombatComplet> {
  const res = await fetch(`${API_URL}/combat`, { method: 'POST', credentials: 'include' });
  const corps = await res.json();
  if (!res.ok) throw new Error(corps.erreur ?? `POST /combat → ${res.status}`);
  return corps;
}
