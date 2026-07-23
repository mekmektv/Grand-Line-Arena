import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  tirerPerso, tirerPremierPerso, tirerCoffreOffert, ouvrirCoffrePremium, recyclerPerso,
  type ResultatTirage, type CarteCollection, type EtatEquipement,
} from '../api';
import { Berry } from '../components/Berry';
import { CoffreSvg } from '../components/CoffreSvg';
import { CoffreEquipement } from '../components/Equipement';

const COULEUR_CLASSE: Record<string, string> = {
  Haki: 'var(--classe-haki)', Logia: 'var(--classe-logia)', Paramecia: 'var(--classe-paramecia)',
  Zoan: 'var(--classe-zoan)', Sniper: 'var(--classe-sniper)', Sabreur: 'var(--classe-sabreur)',
};
const COULEUR_RARETE: Record<string, string> = {
  Commun: 'var(--rarete-commun)', 'Peu commun': 'var(--rarete-peu-commun)', Rare: 'var(--rarete-rare)',
  Epique: 'var(--rarete-epique)', Legendaire: 'var(--rarete-legendaire)',
};

// L'ordre des raretés, du plus banal au plus rare. Sert à savoir ce qui est "supérieur"
// au gagnant pour le frôlement de la roulette.
const ORDRE_RARETE = ['Commun', 'Peu commun', 'Rare', 'Epique', 'Legendaire'];

// ── LA PHASE COFFRE EST NEUTRE, ET C'EST VOLONTAIRE ────────────────────────
// Une version précédente faisait monter le halo du coffre par paliers de rareté (le "tell"
// classique du genre). C'était bon TANT QUE la carte suivait immédiatement — mais depuis
// que la roulette porte le suspense, annoncer la rareté avant de la lancer tue le seul
// moment qui compte : le joueur sait déjà ce qu'il aura pendant que ça défile.
//
// Tout ce qui pourrait trahir le résultat est donc constant, quelle que soit la rareté :
// la couleur, l'intensité de la secousse, ET la durée (un coffre qui tremble plus longtemps
// serait un tell aussi lisible qu'une couleur).
const COFFRE_SECOUSSE_MS = 750;
const COFFRE_OUVERTURE_MS = 340;
const COFFRE_COULEUR = 'var(--or)';

// ═══════════════════════════════════════════════════════════════════════════
// LA ROULETTE — le cœur du ressenti gacha.
//
// Un défilé de portraits qui décélère et s'arrête sur le perso tiré. Ce qui fait
// l'effet, ce n'est pas l'arrêt : c'est de VOIR ce qu'on a frôlé. Le joueur lit
// "j'ai failli avoir Crocodile", et c'est ça qui donne envie de relancer.
//
// ⚠️ Le défilé est PUREMENT DÉCORATIF : il ne change jamais ce qu'on obtient.
//    Le perso gagnant vient du serveur (tirerPerso) et est connu AVANT que la
//    roulette ne démarre — elle est juste construite pour s'arrêter dessus.
//    C'est pour ça que ces réglages sont ici et pas dans `config` : la règle
//    "aucune valeur de gameplay en dur" vise les valeurs qui changent les
//    chances. Celles-ci ne peuvent pas, par construction.
// ═══════════════════════════════════════════════════════════════════════════

/** Combien de fois chaque rareté apparaît dans le défilé, LES UNES PAR RAPPORT AUX AUTRES.
 *  Volontairement PLUS généreux que les vrais taux (70/22/7,5/0,5) : un défilé fidèle aux
 *  vraies chances serait gris du début à la fin et ne donnerait envie de rien.
 *  Les raretés du haut (RARETES_RATIONNEES) ne sont PAS ici : leur nombre est décidé à part. */
const POIDS_DEFILE: Record<string, number> = {
  Commun: 52, 'Peu commun': 33, Rare: 15,
};

/** Les raretés trop précieuses pour être laissées au hasard des poids.
 *  Mesuré : avec de simples poids, un défilé sortait 3 Épiques d'affilée — et comme le
 *  catalogue n'a qu'UN Épique (Crocodile), on le voyait passer trois fois dans le même
 *  ruban. Un joueur comprend la supercherie en deux tirages. On rationne donc explicitement. */
const RARETES_RATIONNEES = ['Epique', 'Legendaire'];

/** Combien de tuiles rationnées par défilé, et à quelle fréquence.
 *  Lu comme : 45 % des roulettes n'en montrent aucune, 40 % en montrent une, 15 % deux.
 *  C'est ce qui fait qu'en croiser une reste un petit événement. */
const QUOTA_RATIONNE: { nombre: number; poids: number }[] = [
  { nombre: 0, poids: 45 },
  { nombre: 1, poids: 40 },
  { nombre: 2, poids: 15 },
];

function tirerQuotaRationne(): number {
  const total = QUOTA_RATIONNE.reduce((s, q) => s + q.poids, 0);
  let t = Math.random() * total;
  for (const q of QUOTA_RATIONNE) { t -= q.poids; if (t <= 0) return q.nombre; }
  return 0;
}

/** Probabilité de coller volontairement une rareté SUPÉRIEURE juste à côté du gagnant
 *  (le "frôlement"). À 1 ce serait à chaque tirage et donc éventé ; à 0 on perdrait le
 *  meilleur moment de la roulette. */
const PROBA_FROLEMENT = 0.35;

const NB_TUILES = 58;        // longueur du ruban
const IDX_GAGNANT = 50;      // position du gagnant : laisse 7 tuiles visibles APRÈS lui
const LARGEUR_TUILE = 96;    // px
const HAUTEUR_TUILE = 112;   // px — portrait entier + bandeau de rareté
const ECART_TUILE = 18;      // px — les tuiles étaient trop collées (retour utilisateur)
const PAS = LARGEUR_TUILE + ECART_TUILE;

// ── Le ralentissement, en DEUX phases ──────────────────────────────────────
// Une transition CSS unique décélère de façon asymptotique : la roulette couvre 99 % de la
// distance dans la première moitié du temps, puis rampe sur quelques pixels. Résultat, on ne
// "voit" jamais la roulette hésiter — elle a l'air arrivée bien avant de s'arrêter.
//
// D'où deux transitions enchaînées :
//   · phase 1 — l'emballement : couvre tout sauf les dernières tuiles, à peine freiné ;
//   · phase 2 — l'hésitation : les dernières tuiles seulement, sur un temps long, si bien
//     qu'on les voit défiler une par une jusqu'au bout.
// ⚠️ Les deux courbes doivent RACCORDER LEURS VITESSES à la jonction, sinon on voit une
// accélération parasite au passage de la phase 1 à la phase 2 (constaté à l'usage).
//
// Pour une cubic-bezier(x1,y1,x2,y2) : pente de départ = y1/x1, pente d'arrivée = (1-y2)/(1-x2).
// La vitesse réelle vaut cette pente × (distance de la phase / durée de la phase).
//
//   phase 1 : pente finale 0.75 × (4211 px / 1890 ms) = 1.67 px/ms
//   phase 2 : pente initiale 2.82 × (1368 px / 2310 ms) = 1.67 px/ms   ← identique, donc fluide
//
// Si tu retouches les durées, les distances ou une courbe, refais ce calcul — c'est la seule
// chose qui garantit qu'on ne réintroduit pas le à-coup.
const TUILES_PHASE_FINALE = 12;     // combien de tuiles se jouent au ralenti
const PART_PHASE_FINALE = 0.55;     // et sur quelle part du temps total
const COURBE_EMBALLEMENT = 'cubic-bezier(.2,.05,.6,.7)';   // pente finale = .3/.4 = 0.75
const COURBE_HESITATION = 'cubic-bezier(.22,.62,.3,1)';    // pente initiale = .62/.22 = 2.82

// ⚠️ Ce profil ne s'applique QU'APRÈS l'arrêt de la roulette. Rien ici ne doit influencer la
// phase coffre ni le défilé : ce sont les deux moments où le joueur ne doit pas encore savoir.
// Seule exception assumée : la durée du défilé, qui est plus longue pour les grosses raretés
// — mais elle n'est pas perceptible comme un tell, personne ne chronomètre une roulette.
interface ProfilRarete {
  roulette: number;    // durée du défilé (ms) — c'est LUI qui porte le suspense maintenant
  confettis: boolean;  // réservés au Rare+ : c'est ce qui leur garde leur valeur
  rayons: boolean;
  silhouette: boolean;
  /** Vitesse de pulsation du halo derrière la carte révélée. */
  intensiteHalo: number;
  /** Durée d'un balayage du brillant holographique, en secondes. 0 = pas de brillant. */
  holo: number;
}

// La secousse a été RACCOURCIE par rapport à la version sans roulette : le suspense est
// désormais porté par le défilé, pas par le coffre. Faire les deux en long donnerait une
// cérémonie interminable sur un Commun, qui représente 70 % des tirages.
const PROFILS: Record<string, ProfilRarete> = {
  Commun: { roulette: 4200, confettis: false, rayons: false, silhouette: false, intensiteHalo: 1, holo: 0 },
  'Peu commun': { roulette: 4800, confettis: false, rayons: false, silhouette: false, intensiteHalo: 0.85, holo: 0 },
  Rare: { roulette: 5600, confettis: true, rayons: true, silhouette: false, intensiteHalo: 0.7, holo: 3.2 },
  Epique: { roulette: 6800, confettis: true, rayons: true, silhouette: true, intensiteHalo: 0.5, holo: 2.1 },
  Legendaire: { roulette: 7400, confettis: true, rayons: true, silhouette: true, intensiteHalo: 0.42, holo: 1.7 },
};
const PROFIL_DEFAUT = PROFILS.Commun;

type Etat = 'idle' | 'secousse' | 'ouverture' | 'roulette' | 'revele' | 'erreur';

/** Une tuile du ruban : juste ce qu'il faut pour la dessiner. */
interface Tuile { nom: string; rarete: string; image: string | null; }

const CONFETTIS = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  couleur: ['#ff2d6b', '#ffc53d', '#25d3df', '#5fbf4d'][i % 4],
  duree: `${1.1 + (i % 4) * 0.2}s`,
  delai: `${(i % 6) * 0.08}s`,
}));

/** Tire un perso au hasard du catalogue selon POIDS_DEFILE (décoratif, cf. bloc ci-dessus). */
function tuileAleatoire(parRarete: Map<string, CarteCollection[]>, exclure?: string): Tuile | null {
  const raretes = [...parRarete.keys()].filter((r) => (parRarete.get(r)?.length ?? 0) > 0);
  if (!raretes.length) return null;
  const total = raretes.reduce((s, r) => s + (POIDS_DEFILE[r] ?? 1), 0);
  let tirage = Math.random() * total;
  let choisie = raretes[raretes.length - 1];
  for (const r of raretes) {
    tirage -= POIDS_DEFILE[r] ?? 1;
    if (tirage <= 0) { choisie = r; break; }
  }
  const groupe = parRarete.get(choisie)!;
  // Évite deux tuiles identiques d'affilée : ça se voit tout de suite et ça fait cheap.
  const dispo = groupe.length > 1 ? groupe.filter((c) => c.nom !== exclure) : groupe;
  const c = dispo[Math.floor(Math.random() * dispo.length)];
  return { nom: c.nom, rarete: c.rarete, image: c.image_menu_url };
}

/** Construit le ruban complet, avec le gagnant à IDX_GAGNANT et un éventuel frôlement. */
function construireRuban(gagnant: Tuile, catalogue: CarteCollection[]): Tuile[] {
  const parRarete = new Map<string, CarteCollection[]>();
  for (const c of catalogue) {
    if (!parRarete.has(c.rarete)) parRarete.set(c.rarete, []);
    parRarete.get(c.rarete)!.push(c);
  }
  // Le fond du ruban ne pioche QUE dans les raretés courantes : les précieuses sont injectées
  // ensuite, en nombre contrôlé.
  const parRareteCourante = new Map(
    [...parRarete].filter(([r]) => !RARETES_RATIONNEES.includes(r) && POIDS_DEFILE[r] !== undefined),
  );

  const ruban: Tuile[] = [];
  for (let i = 0; i < NB_TUILES; i++) {
    if (i === IDX_GAGNANT) { ruban.push(gagnant); continue; }
    ruban.push(tuileAleatoire(parRareteCourante, ruban[i - 1]?.nom) ?? gagnant);
  }

  /** Remplace la tuile `i` par un perso au hasard de la rareté `r`. */
  const poser = (i: number, r: string) => {
    const groupe = parRarete.get(r);
    if (!groupe?.length) return false;
    const c = groupe[Math.floor(Math.random() * groupe.length)];
    ruban[i] = { nom: c.nom, rarete: c.rarete, image: c.image_menu_url };
    return true;
  };

  // Injection rationnée des raretés précieuses, à des positions écartées les unes des autres
  // (deux Épiques collés se liraient comme un décor truqué).
  const dispoRationnees = RARETES_RATIONNEES.filter((r) => (parRarete.get(r)?.length ?? 0) > 0);
  if (dispoRationnees.length > 0) {
    const posesRationnees: number[] = [];
    let restant = tirerQuotaRationne();
    let essais = 0;
    while (restant > 0 && essais < 60) {
      essais += 1;
      const i = 2 + Math.floor(Math.random() * (NB_TUILES - 4));
      if (i === IDX_GAGNANT || posesRationnees.some((p) => Math.abs(p - i) < 5)) continue;
      const r = dispoRationnees[Math.floor(Math.random() * dispoRationnees.length)];
      if (poser(i, r)) { posesRationnees.push(i); restant -= 1; }
    }
  }

  // Le frôlement : une rareté strictement supérieure juste à côté du gagnant. Inutile si on
  // a déjà tiré le sommet — on ne peut pas frôler mieux qu'un Épique.
  const rangGagnant = ORDRE_RARETE.indexOf(gagnant.rarete);
  const superieures = [...parRarete.keys()]
    .filter((r) => ORDRE_RARETE.indexOf(r) > rangGagnant && (parRarete.get(r)?.length ?? 0) > 0);
  if (superieures.length > 0 && Math.random() < PROBA_FROLEMENT) {
    const r = superieures[Math.floor(Math.random() * superieures.length)];
    // Après le gagnant : la tuile reste visible à l'arrêt, donc le joueur la lit vraiment.
    poser(IDX_GAGNANT + 1, r);
  }
  return ruban;
}


// §8 point 6 : coût, bouton TIRER, animation de révélation, doublon → recyclage, taux affichés.
// ⚠️ Simplification : le tirage premium (points de chaîne) reste affiché verrouillé, en
// attente de la Brique 6. Le coffre équipement (§4ter), lui, est branché depuis le 21/07/2026.
/**
 * Fait tourner la MÊME roulette pour les deux tirages offerts de l'arrivée (§4), au lieu
 * d'un écran de tirage parallèle : c'est le moment fort du jeu, un nouveau joueur doit le
 * découvrir exactement tel qu'il le revivra ensuite.
 */
export interface OnboardingTirage {
  /** 'premier' = le roll de départ, Commun garanti. 'coffre-offert' = le cadeau de bienvenue. */
  variante: 'premier' | 'coffre-offert';
  titre: string;
  sousTitre: string;
  /** Appelé quand le joueur a fini de regarder sa carte et veut avancer. */
  onTermine: () => void;
}

export function Tirage({
  berrys, coffresPremium, catalogue, equipement, persoActifId, persoActifNom, prochainChangementCout = 0,
  onIncarnerDepuisTirage, onEtatChange,
  onboarding = null,
}: {
  berrys: number;
  /** Brique 6 : coffres premium en stock (gagnés via points de chaîne). */
  coffresPremium: number;
  /** Tout le catalogue (possédé ou non) — sert à peupler la roulette. Vient de /collection. */
  catalogue: CarteCollection[];
  /** §4ter : inventaire, pièces et prix du coffre. null tant que /equipement n'a pas répondu. */
  equipement: EtatEquipement | null;
  /** Le perso sur lequel un objet fraîchement ouvert sera proposé à l'équipement. */
  persoActifId: number | null;
  persoActifNom: string | null;
  /** §3 : ce que coûterait le prochain changement de perso. 0 = encore gratuit. Non fourni en onboarding, où le bouton INCARNER n'existe pas. */
  prochainChangementCout?: number;
  onIncarnerDepuisTirage: (collectionId: number) => void;
  onEtatChange: () => void;
  /** null = l'onglet Coffres normal. Sinon, l'un des deux tirages offerts de l'arrivée (§4). */
  onboarding?: OnboardingTirage | null;
}) {
  const [etat, setEtat] = useState<Etat>('idle');
  const [resultat, setResultat] = useState<ResultatTirage | null>(null);
  const [ruban, setRuban] = useState<Tuile[]>([]);
  const [decalage, setDecalage] = useState(0);
  const [dureeDefile, setDureeDefile] = useState(0);
  const [courbeDefile, setCourbeDefile] = useState(COURBE_EMBALLEMENT);
  const [erreur, setErreur] = useState('');
  const [montrerTaux, setMontrerTaux] = useState(false);
  // ReactNode et non string : le message contient le logo Berry, qui est un composant.
  const [messageRecyclage, setMessageRecyclage] = useState<ReactNode>(null);

  const fenetreRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const annulerTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const planifier = (fn: () => void, delai: number) => { timers.current.push(window.setTimeout(fn, delai)); };
  useEffect(() => annulerTimers, []);

  // Précharge les portraits : sans ça, les tuiles apparaissent en gris au premier défilé,
  // exactement au moment où l'effet doit être le plus net.
  useEffect(() => {
    for (const c of catalogue) { if (c.image_menu_url) { const i = new Image(); i.src = c.image_menu_url; } }
  }, [catalogue]);

  const profil = resultat ? (PROFILS[resultat.perso.rarete] ?? PROFIL_DEFAUT) : PROFIL_DEFAUT;
  const rareteCouleur = resultat ? (COULEUR_RARETE[resultat.perso.rarete] ?? '#888') : 'var(--or)';

  /** Le décalage qui centre la tuile gagnante sous le repère.
   *  Recalculé à chaque appel et pas mémoïsé : au montage la fenêtre n'existe pas encore
   *  (le ruban n'est rendu qu'en phase roulette), et sa largeur change à la rotation. */
  const calculerDecalageFinal = useCallback(() => {
    const largeurFenetre = fenetreRef.current?.offsetWidth ?? 340;
    return IDX_GAGNANT * PAS + LARGEUR_TUILE / 2 - largeurFenetre / 2;
  }, []);

  const sauter = useCallback(() => {
    if (etat === 'idle' || etat === 'revele' || etat === 'erreur') return;
    annulerTimers();
    setDureeDefile(0);
    setDecalage(calculerDecalageFinal());
    setEtat('revele');
  }, [etat, calculerDecalageFinal]);

  const lancer = async (premium = false) => {
    setMessageRecyclage(null);
    setDecalage(0);
    setDureeDefile(0);
    setEtat('secousse');

    let r: ResultatTirage;
    try {
      // Quatre routes, une seule animation : le serveur décide du perso dans tous les cas,
      // le front ne fait que rejouer le résultat.
      if (premium) r = await ouvrirCoffrePremium();
      else if (onboarding?.variante === 'premier') r = await tirerPremierPerso();
      else if (onboarding?.variante === 'coffre-offert') r = await tirerCoffreOffert();
      else r = await tirerPerso();
    } catch (e) {
      setErreur((e as Error).message);
      setEtat('erreur');
      return;
    }
    setResultat(r);

    // ⚠️ Surtout PAS de rafraîchissement ici pendant l'arrivée d'un joueur : le serveur a
    // déjà fait avancer son étape d'onboarding, et relire l'état ferait démonter cet écran
    // par App AU MILIEU de l'animation — le joueur passait de son clic à l'Accueil sans
    // jamais voir ni la roulette ni sa carte. Le rafraîchissement a lieu dans onTermine.
    if (!onboarding) onEtatChange();

    const p = PROFILS[r.perso.rarete] ?? PROFIL_DEFAUT;

    // Le ruban est construit MAINTENANT : le gagnant est déjà connu, la roulette n'a qu'à
    // s'arrêter dessus. Rien n'est tiré au sort pendant l'animation.
    const nouveauRuban = construireRuban(
      { nom: r.perso.nom, rarete: r.perso.rarete, image: r.perso.image_menu_url },
      catalogue,
    );
    setRuban(nouveauRuban);

    // Garde-fou : sans catalogue (ou avec trop peu de persos), le ruban serait rempli du
    // même visage répété. Mieux vaut sauter la roulette que la montrer ridicule.
    const assezDeVariete = new Set(nouveauRuban.map((t) => t.nom)).size >= 4;

    planifier(() => {
      setEtat('ouverture');
      planifier(() => {
        if (!assezDeVariete) { setEtat('revele'); return; }
        setEtat('roulette');

        const dureeFinale = p.roulette * PART_PHASE_FINALE;
        const dureeEmballement = p.roulette - dureeFinale;

        // Phase 1 — l'emballement. Le décalage est posé au tick suivant : appliqué dans le
        // même rendu que la transition, le navigateur sauterait à l'arrivée sans animer.
        planifier(() => {
          setCourbeDefile(COURBE_EMBALLEMENT);
          setDureeDefile(dureeEmballement);
          setDecalage(calculerDecalageFinal() - TUILES_PHASE_FINALE * PAS);
        }, 40);

        // Phase 2 — l'hésitation : les dernières tuiles, au ralenti, une par une.
        planifier(() => {
          setCourbeDefile(COURBE_HESITATION);
          setDureeDefile(dureeFinale);
          setDecalage(calculerDecalageFinal());
        }, 40 + dureeEmballement);

        // +300 ms après l'arrêt : le temps de lire la tuile gagnante avant qu'elle ne grandisse.
        planifier(() => setEtat('revele'), p.roulette + 300);
      }, COFFRE_OUVERTURE_MS);
    }, COFFRE_SECOUSSE_MS);
  };

  const recommencer = () => {
    annulerTimers();
    setEtat('idle'); setResultat(null); setErreur(''); setMessageRecyclage(null);
    setRuban([]); setDecalage(0); setDureeDefile(0);
    setCourbeDefile(COURBE_EMBALLEMENT);
  };

  const recycler = async () => {
    if (!resultat?.collection_id) return;
    const r = await recyclerPerso(resultat.collection_id);
    if (r.ok) {
      setMessageRecyclage(<>♻️ {r.nom} recyclé — +{r.berrys_gagnes} <Berry size={13} /></>);
      onEtatChange();
      setResultat({ ...resultat, collection_id: null });
    } else {
      setMessageRecyclage(r.erreur);
    }
  };

  const enCeremonie = etat === 'secousse' || etat === 'ouverture' || etat === 'roulette';

  /** La cascade de la carte : chaque ligne monte l'une après l'autre à la révélation. */
  const casc = (i: number): CSSProperties => (
    etat === 'revele' ? { animation: `statMonte .34s ease-out ${0.35 + i * 0.14}s both` } : { opacity: 0 }
  );

  return (
    <div
      onClick={enCeremonie ? sauter : undefined}
      style={{
        minHeight: '100%', background: 'linear-gradient(180deg,#4fb8d9 0%,#2e93c2 38%,#1c6f9c 65%,#0f2733 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', textAlign: 'center',
        position: 'relative', overflow: 'hidden', cursor: enCeremonie ? 'pointer' : undefined,
        // Plus aucun tremblement pendant la cérémonie : il ne se déclenchait que sur les
        // grosses raretés, et c'était donc un tell aussi parlant que la couleur du halo.
      }}
    >
      <div style={{ position: 'absolute', top: -30, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'var(--or)', boxShadow: '0 0 46px 12px rgba(255,197,61,.4)' }} />

      {/* ── Arrivée d'un nouveau joueur (§4) : un seul coffre, rien d'autre à l'écran.
             Ni prix, ni roll premium, ni taux de drop — à ce stade il ne sait pas encore
             ce qu'est un Berry, tout ça n'aurait aucun sens pour lui. ──────────────── */}
      {etat === 'idle' && onboarding && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', width: '100%' }}>
          <div className="titre-shonen" style={{ font: '400 26px/1.1 Bangers,Rubik', color: '#fff', textShadow: '2px 2px 0 #12324a' }}>
            {onboarding.titre}
          </div>
          <div style={{ font: '600 12px/1.5 Rubik,Arial', color: 'rgba(255,255,255,.9)', maxWidth: 270 }}>
            {onboarding.sousTitre}
          </div>

          <button
            onClick={() => lancer()}
            style={{ width: '100%', background: '#5c3a1a', border: '4px solid #1a1208', borderRadius: 18, padding: 0, overflow: 'hidden', boxShadow: '0 8px 0 rgba(0,0,0,.35)', marginTop: 6 }}
          >
            <div style={{ padding: '26px 18px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <CoffreSvg agite={false} />
              <div style={{ font: '400 20px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-6deg)', color: 'var(--or)' }}>
                OUVRIR LE COFFRE
              </div>
            </div>
          </button>
        </div>
      )}

      {etat === 'idle' && !onboarding && (
        <>
          <div className="titre-shonen" style={{ font: '400 24px/1 Bangers,Rubik', color: '#fff', textShadow: '2px 2px 0 #12324a', position: 'relative', marginBottom: 10 }}>
            DES TRÉSORS T'ATTENDENT
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative', marginBottom: 14 }}>
            <span style={{ background: 'rgba(0,0,0,.35)', border: '1.5px solid var(--or)', borderRadius: 14, padding: '4px 10px', font: '800 10px Rubik,Arial', color: 'var(--or)' }}><Berry size={11} /> {berrys}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%', position: 'relative', flex: 1, justifyContent: 'center' }}>
            <button
              onClick={() => lancer()}
              disabled={berrys < 100}
              style={{ width: '100%', background: '#5c3a1a', border: '4px solid #1a1208', borderRadius: 18, padding: 0, overflow: 'hidden', boxShadow: '0 8px 0 rgba(0,0,0,.35)', position: 'relative' }}
            >
              <div style={{ background: 'var(--or)', color: '#1a1208', font: '800 11px Rubik,Arial', letterSpacing: 1, padding: '7px 0' }}>ROLL PERSONNAGE</div>
              <div style={{ padding: '24px 18px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <CoffreSvg agite={false} />
                <div style={{ font: '400 20px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-6deg)', color: '#fff' }}>Nouveau personnage</div>
                <div style={{ font: '800 14px Rubik,Arial', color: 'var(--or)' }}><Berry size={14} /> 100</div>
              </div>
            </button>

            {/* Même mise en page que ROLL PERSONNAGE (bandeau titre + coffre + libellé), en
                violet Twitch. Toujours cliquable dans l'absolu — désactivé seulement à x0,
                pas caché : le joueur doit voir que ce roll existe même sans stock. */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => lancer(true)}
                disabled={coffresPremium <= 0}
                style={{
                  width: '100%', background: '#2a1245', border: '4px solid #1a1208', borderRadius: 18,
                  padding: 0, overflow: 'hidden', boxShadow: '0 8px 0 rgba(0,0,0,.35)', position: 'relative',
                  opacity: coffresPremium > 0 ? 1 : 0.55,
                }}
              >
                <div style={{ background: '#772ce8', color: '#fff', font: '800 11px Rubik,Arial', letterSpacing: 1, padding: '7px 0' }}>ROLL PERSONNAGE PREMIUM</div>
                <div style={{ padding: '24px 18px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <CoffreSvg agite={false} />
                  <div style={{ font: '400 20px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-6deg)', color: '#fff' }}>Nouveau personnage</div>
                  <div style={{ font: '700 11px Rubik,Arial', color: '#c9a8ff' }}>s'obtient avec les points de chaîne, en live</div>
                </div>
              </button>

              <div style={{
                position: 'absolute', top: -10, right: -8, minWidth: 30, height: 30, padding: '0 6px',
                borderRadius: 15, background: 'var(--or)', border: '2px solid #1a1208', display: 'flex',
                alignItems: 'center', justifyContent: 'center', font: '800 12px Rubik,Arial', color: '#1a1208',
                boxShadow: '0 2px 0 #000', zIndex: 1,
              }}
              >
                x{coffresPremium}
              </div>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <CoffreEquipement
                etat={equipement}
                persoActifId={persoActifId}
                persoActifNom={persoActifNom}
                onChange={onEtatChange}
              />
            </div>
          </div>

          <button onClick={() => setMontrerTaux((v) => !v)} style={{ marginTop: 12, font: '700 10px Rubik,Arial', background: 'rgba(0,0,0,.3)', color: 'rgba(255,255,255,.85)', border: '1px solid rgba(255,255,255,.35)', borderRadius: 14, padding: '5px 14px', position: 'relative' }}>
            ⓘ Taux de drop
          </button>
          {montrerTaux && (
            <div style={{ font: '600 9px Rubik,Arial', color: 'rgba(255,255,255,.85)', position: 'relative', marginTop: 8, lineHeight: 1.55, background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: '9px 11px', textAlign: 'left' }}>
              <b>Roll personnage</b> — Commun 70 % · Peu commun 22 % · Rare 7,5 % · Épique 0,5 %
              <br />
              <b>Coffre équipement</b> — Gris 65 % · Vert 28 % · Bleu 7 % · Chapeau ou Tenue 50/50
            </div>
          )}
          {messageRecyclage && (
            <div style={{ position: 'relative', marginTop: 10, font: '800 11px Rubik,Arial', background: '#14303c', color: 'var(--or)', border: '2px solid var(--or)', borderRadius: 12, padding: '8px 12px' }}>
              {messageRecyclage}
            </div>
          )}
        </>
      )}

      {/* ── Le coffre : secousse puis ouverture. STRICTEMENT IDENTIQUE quelle que soit la
             rareté tirée — voir le bloc COFFRE_* en haut du fichier. ─────────────── */}
      {(etat === 'secousse' || etat === 'ouverture') && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 230, height: 210 }}>
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%', background: COFFRE_COULEUR,
            filter: 'blur(12px)', opacity: 0.65,
            animation: 'glowPulseHard 1s ease-in-out infinite',
          }}
          />

          <CoffreSvg agite={etat === 'secousse'} ouvre={etat === 'ouverture'} vitesse={1} />

          {etat === 'ouverture' && (
            <div style={{
              position: 'absolute', bottom: '38%', width: 118, height: 150,
              background: `linear-gradient(0deg, ${COFFRE_COULEUR} 0%, #fff 40%, transparent 100%)`,
              clipPath: 'polygon(32% 100%, 68% 100%, 100% 0%, 0% 0%)',
              transformOrigin: 'bottom center', animation: 'raiLumiere .42s ease-out forwards',
              filter: 'blur(1px)', pointerEvents: 'none',
            }}
            />
          )}
        </div>
      )}

      {/* ── LA ROULETTE ────────────────────────────────────────────────────── */}
      {etat === 'roulette' && (
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
          <div style={{ font: '400 18px Bangers,Rubik', letterSpacing: 1, color: '#fff', textShadow: '2px 2px 0 #12324a' }}>
            QUI VA SORTIR ?
          </div>

          <div
            ref={fenetreRef}
            style={{
              position: 'relative', width: '100%', height: HAUTEUR_TUILE + 34, overflow: 'hidden',
              borderTop: '3px solid rgba(255,255,255,.3)', borderBottom: '3px solid rgba(255,255,255,.3)',
              // Les bords s'estompent : le ruban a l'air de venir de nulle part et d'y repartir,
              // au lieu de commencer et finir sèchement sur les bords de l'écran.
              WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)',
              maskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)',
            }}
          >
            <div style={{
              display: 'flex', gap: ECART_TUILE, padding: '17px 0', alignItems: 'center',
              transform: `translateX(${-decalage}px)`,
              transition: dureeDefile ? `transform ${dureeDefile}ms ${courbeDefile}` : undefined,
            }}
            >
              {ruban.map((t, i) => {
                const couleur = COULEUR_RARETE[t.rarete] ?? '#888';
                return (
                  <div
                    key={i}
                    style={{
                      flex: 'none', width: LARGEUR_TUILE, height: HAUTEUR_TUILE, borderRadius: 8,
                      background: '#123540', border: `4px solid ${couleur}`,
                      overflow: 'hidden', boxSizing: 'border-box', position: 'relative',
                      display: 'flex', flexDirection: 'column',
                      // Le halo trahit la rareté même du coin de l'œil, quand ça défile vite.
                      boxShadow: `0 0 10px 1px ${couleur}`,
                    }}
                  >
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.image
                        ? (
                          <img
                            src={t.image}
                            alt={t.nom}
                            // `contain` et non `cover` : le portrait entier doit être visible.
                            // En `cover`, les images au cadrage décentré se faisaient rogner la
                            // tête (retour utilisateur).
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        )
                        : <div style={{ color: 'rgba(239,231,214,.4)', font: "700 8px 'Courier New',monospace" }}>?</div>}
                    </div>
                    {/* Bandeau de rareté : la couleur seule ne suffisait pas à la lire. */}
                    <div style={{
                      flex: 'none', background: couleur, color: '#1a1208',
                      font: '800 7.5px Rubik,Arial', letterSpacing: 0.2, padding: '2.5px 0',
                      textAlign: 'center', textTransform: 'uppercase',
                    }}
                    >
                      {t.rarete}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Le repère central : c'est lui qui dit où la roulette va s'arrêter. */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, background: 'var(--or)', boxShadow: '0 0 10px 2px rgba(255,197,61,.8)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '10px solid var(--or)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '10px solid var(--or)', pointerEvents: 'none' }} />
          </div>
        </div>
      )}

      {/* ── La carte, une fois la roulette arrêtée ─────────────────────────── */}
      {etat === 'revele' && resultat && (
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, justifyContent: 'center', position: 'relative' }}>
          {profil.confettis && CONFETTIS.map((c, i) => (
            <div key={i} style={{ position: 'absolute', top: 0, left: c.left, width: 6, height: 10, background: c.couleur, animation: `confettiFall ${c.duree} ease-in forwards`, animationDelay: c.delai }} />
          ))}

          <div style={{ position: 'relative', width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profil.rayons && (
                <div style={{
                  position: 'absolute', inset: -52, borderRadius: '50%',
                  background: 'repeating-conic-gradient(rgba(255,255,255,.3) 0 9deg, transparent 9deg 24deg)',
                  WebkitMaskImage: 'radial-gradient(circle,#000 20%,transparent 72%)', maskImage: 'radial-gradient(circle,#000 20%,transparent 72%)',
                  animation: 'raysSpin 10s linear infinite',
                }}
                />
              )}
              <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: rareteCouleur, filter: 'blur(8px)', animation: `glowPulseHard ${1.4 * profil.intensiteHalo}s ease-in-out infinite` }} />

              {/* La tuile qui grandit en carte : on part de la taille d'une tuile de roulette
                  pour que la continuité se lise, au lieu d'un pop surgi de nulle part. */}
              <div style={{
                position: 'relative', background: '#e9d9b0', border: '4px solid #1a1208', borderRadius: 8,
                padding: 14, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box',
                overflow: 'hidden', animation: 'tuileGrandit .42s cubic-bezier(.2,.8,.3,1.25) both',
              }}
              >
                <div style={{ height: 100, borderRadius: 6, background: '#123540', overflow: 'hidden' }}>
                  {resultat.perso.image_menu_url
                    ? (
                      <img
                        src={resultat.perso.image_menu_url}
                        alt={resultat.perso.nom}
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
                          filter: profil.silhouette ? 'brightness(1)' : undefined,
                          transition: profil.silhouette ? 'filter 1s ease-out' : undefined,
                          animation: 'kenBurns 7s ease-out .4s both',
                        }}
                      />
                    )
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(42,26,13,.5)', font: "700 9px 'Courier New',monospace" }}>SPRITE</div>}
                </div>

                <div style={casc(0)}>
                  <div style={{ font: '900 16px Rubik,Arial', color: '#1a1208' }}>{resultat.perso.nom}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', ...casc(1) }}>
                  <span style={{ background: rareteCouleur, color: '#1a1208', font: '800 10px Rubik,Arial', padding: '4px 9px', borderRadius: 14 }}>{resultat.perso.rarete}</span>
                  <span style={{ background: COULEUR_CLASSE[resultat.perso.classe], color: '#fff', font: '800 10px Rubik,Arial', padding: '4px 9px', borderRadius: 14 }}>{resultat.perso.classe}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, font: '800 11px Rubik,Arial', color: '#5c3a1a', ...casc(2) }}>
                  <span>❤️ {resultat.perso.pv} PV</span>
                  <span>⚔️ {resultat.perso.attack} ATK</span>
                </div>
                {resultat.perso.competence_nom && (
                  <div style={{ textAlign: 'left', borderTop: '1.5px solid rgba(26,18,8,.25)', paddingTop: 6, ...casc(3) }}>
                    <div style={{ font: '800 10px Rubik,Arial', color: '#1a1208' }}>✨ {resultat.perso.competence_nom}</div>
                    {resultat.perso.competence_desc && (
                      <div style={{ font: '600 9px Rubik,Arial', color: 'rgba(26,18,8,.7)', marginTop: 2 }}>{resultat.perso.competence_desc}</div>
                    )}
                  </div>
                )}

                {profil.holo > 0 && (
                  <div style={{
                    position: 'absolute', top: '-60%', left: 0, width: '55%', height: '220%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)',
                    animation: `holoSweep ${profil.holo}s ease-in-out .6s infinite`, pointerEvents: 'none',
                  }}
                  />
                )}
              </div>
            </div>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeMonte .3s ease-out .6s both' }}>
            {/* Pendant l'arrivée, aucune sortie latérale : ni ENCORE (il n'a pas de Berrys),
                ni recyclage (recycler son unique pirate le laisserait sans rien). */}
            {onboarding
              ? (
                <button
                  // recommencer() AVANT de prévenir le parent : sinon l'écran reste bloqué sur
                  // la carte révélée, mais avec les boutons du mode normal (ENCORE, INCARNER…)
                  // puisque `onboarding` vient de repasser à null.
                  onClick={() => { recommencer(); onboarding.onTermine(); }}
                  style={{ width: '100%', font: '800 14px Rubik,Arial', fontStyle: 'italic', transform: 'skew(-6deg)', background: 'var(--rose)', color: '#fff', border: '3px solid #000', borderRadius: 12, padding: 13, boxShadow: '0 5px 0 #000' }}
                >
                  {onboarding.variante === 'premier' ? 'EMBARQUER !' : 'CONTINUER'}
                </button>
              )
              : (
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button onClick={recommencer} style={{ flex: 1, font: '800 13px Rubik,Arial', fontStyle: 'italic', transform: 'skew(-6deg)', background: 'var(--or)', color: '#14303c', border: '3px solid #000', borderRadius: 12, padding: 12, boxShadow: '0 5px 0 #000' }}>
                    RETOUR
                  </button>
                  {!resultat.doublon && resultat.collection_id !== null && (
                    <button
                      onClick={() => { onIncarnerDepuisTirage(resultat.collection_id!); recommencer(); }}
                      style={{ flex: 1, font: '800 13px Rubik,Arial', fontStyle: 'italic', transform: 'skew(-6deg)', background: 'var(--rose)', color: '#fff', border: '3px solid #000', borderRadius: 12, padding: 12, boxShadow: '0 5px 0 #000' }}
                    >
                      INCARNER
                    </button>
                  )}
                </div>
              )}

            {!onboarding && !resultat.doublon && resultat.collection_id !== null && (
              <div style={{ width: '100%', font: '700 10px Rubik,Arial', color: 'rgba(233,217,176,.7)', textAlign: 'center' }}>
                {prochainChangementCout > 0
                  ? <>D'habitude changer de perso coûte des Berrys une fois le quota gratuit épuisé — là ça t'en coûterait <Berry size={10} />{prochainChangementCout}.</>
                  : 'Tu peux changer de perso gratuitement maintenant — d\'habitude c\'est limité.'}
              </div>
            )}

            {!onboarding && !resultat.doublon && resultat.collection_id !== null && (
              <button
                onClick={recycler}
                style={{ width: '100%', font: '800 11px Rubik,Arial', background: 'rgba(0,0,0,.35)', color: '#e9d9b0', border: '2px solid #e9d9b0', borderRadius: 12, padding: 9 }}
              >
                ♻️ RECYCLER CONTRE DES BERRYS
              </button>
            )}

            {messageRecyclage && (
              <div style={{ width: '100%', font: '800 12px Rubik,Arial', fontStyle: 'italic', background: '#14303c', color: 'var(--or)', border: '2px solid var(--or)', borderRadius: 12, padding: 11 }}>
                {messageRecyclage}
              </div>
            )}

            {resultat.doublon && (
              <div style={{ width: '100%', font: '800 12px Rubik,Arial', fontStyle: 'italic', background: '#14303c', color: 'var(--or)', border: '2px solid var(--or)', borderRadius: 12, padding: 11 }}>
                ♻️ Déjà possédé — recyclé pour +{resultat.recyclage_gagne} <Berry size={13} />
              </div>
            )}
          </div>
        </div>
      )}

      {etat === 'erreur' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
          <div style={{ font: '700 13px Rubik,Arial', color: '#fff' }}>{erreur}</div>
          <button onClick={recommencer} style={{ font: '800 13px Rubik,Arial', background: 'var(--rose)', color: '#fff', border: '3px solid #000', borderRadius: 12, padding: '10px 18px', boxShadow: '0 4px 0 #000' }}>
            Retour
          </button>
        </div>
      )}

      {enCeremonie && (
        <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, font: '700 9px Rubik,Arial', color: 'rgba(255,255,255,.55)', letterSpacing: 0.5 }}>
          touche l'écran pour passer
        </div>
      )}
    </div>
  );
}
