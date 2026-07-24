import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResultatCombatComplet, Evenement, PacketSprite, Camp } from '../api';
import { Berry } from '../components/Berry';
import { basculerSons, arreterMusique, ecouterSons, jouerEffet, jouerOuverture, sonsMuets } from '../sons';
import type { NomEffet } from '../sons';

// ═══════════════════════════════════════════════════════════════════════════
// GRAND LINE ARENA — écran de combat. Port du rendu de testeur-combat.html (canvas 2D),
// adapté au format mobile portrait et branché sur les VRAIS événements de combat.ts —
// contrairement au testeur, qui inventait son propre combat pour tester des sprites,
// ici le canvas ne fait QUE rejouer une liste déjà calculée par le serveur (§6).
//
// Constantes de rendu reprises À L'IDENTIQUE du testeur / §7 GAME_DESIGN.md :
//   échelle (H*0.30)/ref*taille · sol GY=H*0.86 · CAST_MS=1100
//   projectile: largeur H*0.22*taille, y=GY-H*(0.05+hauteur*0.40), durée=1300-vitesse*105
//   effet: x=perso+face*(efX*bodyH*0.5), y=GY-bodyH*0.5-(efY*bodyH*0.5)
// ═══════════════════════════════════════════════════════════════════════════

const COULEUR_RARETE: Record<string, string> = {
  Commun: 'var(--rarete-commun)', 'Peu commun': 'var(--rarete-peu-commun)', Rare: 'var(--rarete-rare)',
  Epique: 'var(--rarete-epique)', Legendaire: 'var(--rarete-legendaire)',
};

const CAST_MS = 1100;
// §7 : le testeur (référence des assets, artiste) calibre "Hauteur projectile" contre une
// échelle perso de H*0.30. Notre arène portrait force une échelle plus petite (H*0.16, pour
// l'écart entre persos) — sans corriger la hauteur du projectile en proportion, il jaillirait
// bien plus haut sur le corps (désormais plus petit) que prévu. Un seul ratio à changer si
// l'échelle rebouge encore.
const ECHELLE_PERSO = 0.16;
const ECHELLE_PERSO_ORIGINE = 0.30;
const RATIO_HAUTEUR_PROJECTILE = ECHELLE_PERSO / ECHELLE_PERSO_ORIGINE;
type Mode = 'loop' | 'once' | 'ping';

interface FrameImg { img: HTMLImageElement; w: number; h: number; }
type Anims = Record<string, FrameImg[]>;

interface FormeChargee { anims: Anims; ref: number; }

async function chargerImage(url: string): Promise<FrameImg> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

async function chargerForme(packet: PacketSprite): Promise<FormeChargee> {
  const cles = Object.keys(packet.urls) as (keyof PacketSprite['urls'])[];
  const anims = {} as Anims;
  await Promise.all(cles.map(async (cle) => { anims[cle] = await Promise.all(packet.urls[cle].map(chargerImage)); }));
  const refArr = anims.idle.length ? anims.idle : (anims.attack.length ? anims.attack : anims.hit);
  const ref = refArr.length ? Math.max(...refArr.map((f) => f.h)) : 100;
  return { anims, ref };
}

interface Fighter {
  camp: Camp;
  face: 1 | -1;
  nom: string; classe: string;
  packet: PacketSprite;
  formeBase: FormeChargee;
  formeTransfo: FormeChargee | null;
  transforme: boolean;
  pvMax: number; pv: number;
  resistance: number;
  base: number; x: number;
  anim: string; fps: number; mode: Mode; t0: number;
  knock: number;
  effetOn: boolean; effetT0: number;
  isCasting: boolean;
  transformedProj: boolean;
}

function formeActuelle(f: Fighter): FormeChargee { return f.transforme && f.formeTransfo ? f.formeTransfo : f.formeBase; }
function packetActuel(f: Fighter, s: Combattants): PacketSprite {
  const sprites = f.camp === 'a' ? s.spritesA : s.spritesB;
  return f.transforme && sprites.transforme ? sprites.transforme : sprites.base;
}

interface Combattants { spritesA: ResultatCombatComplet['spritesA']; spritesB: ResultatCombatComplet['spritesB']; }

// ── Regroupe le flux plat d'événements en "beats" jouables (§6 : le contrat) ──
type Beat =
  | { kind: 'action'; declencheur: Evenement & { type: 'attaque' | 'special' }; consequences: Evenement[] }
  | { kind: 'tick'; evenement: Evenement & { type: 'regen' | 'poison' } }
  | { kind: 'ko'; evenement: Evenement & { type: 'ko' } }
  | { kind: 'fin'; evenement: Evenement & { type: 'fin' } };

function grouperEvenements(evenements: Evenement[]): Beat[] {
  const beats: Beat[] = [];
  let i = 0;
  const bornes = new Set(['attaque', 'special', 'regen', 'poison', 'ko', 'fin']);
  while (i < evenements.length) {
    const ev = evenements[i];
    if (ev.type === 'attaque' || ev.type === 'special') {
      const consequences: Evenement[] = [];
      let j = i + 1;
      while (j < evenements.length && !bornes.has(evenements[j].type)) { consequences.push(evenements[j]); j++; }
      beats.push({ kind: 'action', declencheur: ev, consequences });
      i = j;
    } else if (ev.type === 'regen' || ev.type === 'poison') { beats.push({ kind: 'tick', evenement: ev }); i++; }
    else if (ev.type === 'ko') { beats.push({ kind: 'ko', evenement: ev }); i++; }
    else if (ev.type === 'fin') { beats.push({ kind: 'fin', evenement: ev }); i++; }
    else i++;
  }
  return beats;
}

interface Issue {
  esquive: boolean;
  crit: boolean; critMult: number;
  counter: boolean; counterMult: number;
  resistanceValeur: number | null;
  degats: { valeur: number; pv_restants: number; pv_max: number } | null;
  soin: { valeur: number; pv_restants: number; pv_max: number } | null;
  debuffs: (Evenement & { type: 'debuff' })[];
}
function lireIssue(consequences: Evenement[]): Issue {
  const issue: Issue = {
    esquive: false, crit: false, critMult: 1, counter: false, counterMult: 1,
    resistanceValeur: null, degats: null, soin: null, debuffs: [],
  };
  for (const c of consequences) {
    if (c.type === 'esquive') issue.esquive = true;
    else if (c.type === 'crit') { issue.crit = true; issue.critMult = c.multiplicateur; }
    else if (c.type === 'counter') { issue.counter = true; issue.counterMult = c.multiplicateur; }
    else if (c.type === 'resistance') issue.resistanceValeur = c.valeur;
    else if (c.type === 'degats') issue.degats = { valeur: c.valeur, pv_restants: c.pv_restants, pv_max: c.pv_max };
    else if (c.type === 'soin') issue.soin = { valeur: c.valeur, pv_restants: c.pv_restants, pv_max: c.pv_max };
    else if (c.type === 'debuff') issue.debuffs.push(c);
  }
  return issue;
}

const LABEL_DEBUFF: Record<string, string> = { attack: 'ATK ↓', esquive: 'ESQ ↓', regen: 'RÉGÉN bloquée' };

// React StrictMode (dev uniquement, sans effet en prod) rejoue exprès les effets pour détecter
// les bugs de nettoyage — un simple ref ne suffit pas à s'en protéger ici (le 2e passage peut
// dépasser la garde avant que le 1er ait fini son nettoyage). Un Set au niveau du module, gardé
// par le seed du combat (unique par combat), garantit un seul vrai lancement quoi qu'il arrive.
const combatsDejaLances = new Set<number>();
// Même piège, même parade, pour le clash d'ouverture (voir plus bas).
const clashDejaJoue = new Set<number>();

export function Combat({
  combat, onRetour, onRejouer,
}: {
  combat: ResultatCombatComplet;
  onRetour: () => void;
  onRejouer: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'vs' | 'combat'>('vs');
  const [pret, setPret] = useState(false);
  const [erreurChargement, setErreurChargement] = useState('');
  const [pvGaucheAff, setPvGaucheAff] = useState(100);
  const [pvDroiteAff, setPvDroiteAff] = useState(100);
  const [resistanceGauche, setResistanceGauche] = useState(0);
  const [resistanceDroite, setResistanceDroite] = useState(0);
  // Buffs : permanents une fois déclenchés (§3 : "pour le reste du combat"), affichés à côté du
  // nom comme le bouclier de résistance. Debuffs : temporaires, affichés sous la barre de vie.
  const [buffGauche, setBuffGauche] = useState(false);
  const [buffDroite, setBuffDroite] = useState(false);
  const [debuffsGauche, setDebuffsGauche] = useState<{ id: number; emoji: string }[]>([]);
  const [debuffsDroite, setDebuffsDroite] = useState<{ id: number; emoji: string }[]>([]);
  const [vitesse, setVitesse] = useState<1 | 2 | 3>(1);
  const vitesseRef = useRef(1);
  const [fini, setFini] = useState(false);
  const [muet, setMuet] = useState(sonsMuets());

  useEffect(() => { vitesseRef.current = vitesse; }, [vitesse]);
  useEffect(() => ecouterSons(setMuet), []);
  // Filet de sécurité indépendant de la boucle de rendu du canvas (voir la fonction
  // demarrer() plus bas) : garantit que la musique s'arrête si l'écran est quitté.
  useEffect(() => () => arreterMusique(), []);

  const { resultat, spritesA, spritesB } = combat;
  const gauche = resultat.combattants[0]; // camp 'a', toujours affiché à gauche
  const droite = resultat.combattants[1]; // camp 'b'

  // Le clash sonne dès que les 2 comptes apparaissent (écran VS), et enchaîne lui-même
  // sur la musique (voir jouerOuverture) — pas besoin d'attendre demarrerCombat().
  useEffect(() => {
    if (clashDejaJoue.has(resultat.seed)) return;
    clashDejaJoue.add(resultat.seed);
    jouerOuverture();
  }, [resultat.seed]);

  const formesChargeesRef = useRef<{
    baseA: FormeChargee; transfoA: FormeChargee | null; baseB: FormeChargee; transfoB: FormeChargee | null;
  } | null>(null);

  // Charge les sprites PENDANT que l'écran "VS" s'affiche. Deux conditions pour démarrer :
  // les sprites sont prêts, ET la mise en scène du VS a eu le temps de se jouer. Mais dès que
  // les sprites sont là, un tap permet de couper court — les 2 s imposées d'avant étaient une
  // attente subie pour qui enchaîne les combats.
  const [spritesPrets, setSpritesPrets] = useState(false);
  const [ceremonieFinie, setCeremonieFinie] = useState(false);

  const demarrerCombat = useCallback(() => {
    if (!formesChargeesRef.current) return;
    if (combatsDejaLances.has(resultat.seed)) return;
    combatsDejaLances.add(resultat.seed);
    setPhase('combat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultat.seed]);

  useEffect(() => {
    let annule = false;
    // Ce n'est pas la durée de l'animation qui commande, c'est le temps de LECTURE : le bandeau
    // "⚔️ Haki contre Paramecia" enseigne le triangle des classes, et à 1,4 s il n'était affiché
    // que ~450 ms — personne n'avait le temps de le lire.
    //
    // Le dernier élément (la ligne "touche pour en découdre") finit d'apparaître à 1,5 s
    // (délai 1,1 s + 0,4 s d'animation). On laisse ensuite une seconde pleine de lecture sur
    // l'écran complet, d'où le total. Si tu retouches un animation-delay ci-dessous, remonte
    // cette constante d'autant. Le tap reste là pour qui veut couper court.
    const APPARITION_COMPLETE_MS = 1500;
    const LECTURE_MS = 2300;
    const minuteur = setTimeout(() => { if (!annule) setCeremonieFinie(true); }, APPARITION_COMPLETE_MS + LECTURE_MS);
    async function preparer() {
      try {
        const [baseA, transfoA, baseB, transfoB] = await Promise.all([
          chargerForme(spritesA.base),
          spritesA.transforme ? chargerForme(spritesA.transforme) : Promise.resolve(null),
          chargerForme(spritesB.base),
          spritesB.transforme ? chargerForme(spritesB.transforme) : Promise.resolve(null),
        ]);
        if (annule) return;
        formesChargeesRef.current = { baseA, transfoA, baseB, transfoB };
        setSpritesPrets(true);
      } catch (e) {
        if (!annule) setErreurChargement(`Chargement des sprites impossible : ${(e as Error).message}`);
      }
    }
    preparer();
    return () => { annule = true; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Départ automatique quand les deux conditions sont réunies.
  useEffect(() => {
    if (phase === 'vs' && spritesPrets && ceremonieFinie) demarrerCombat();
  }, [phase, spritesPrets, ceremonieFinie, demarrerCombat]);

  // Le canvas n'existe dans le DOM qu'une fois phase==='combat' : on ne peut appeler demarrer()
  // qu'APRÈS ce commit, dans un effet séparé qui observe le changement de phase.
  useEffect(() => {
    if (phase === 'combat' && formesChargeesRef.current) {
      const { baseA, transfoA, baseB, transfoB } = formesChargeesRef.current;
      demarrer(baseA, transfoA, baseB, transfoB);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function demarrer(baseA: FormeChargee, transfoA: FormeChargee | null, baseB: FormeChargee, transfoB: FormeChargee | null) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let W = 0; let H = 0; let DPR = 1;
    let GY = 0;

    function fit() {
      const r = canvas.getBoundingClientRect();
      DPR = window.devicePixelRatio || 1;
      canvas.width = r.width * DPR; canvas.height = r.height * DPR;
      W = r.width; H = r.height;
      GY = H * 0.86;
      // §7 : l'arène du testeur est en 16/10 (large), la nôtre en 3/4 (portrait, §8 combat
      // plein écran). Encore trop proches à 0.26/0.74 + échelle 0.22 : on réduit encore la
      // taille des persos (0.16) ET on les écarte beaucoup plus (0.16/0.84) — l'écart visuel
      // (bord à bord, pas juste centre à centre) fait plus du double d'avant.
      L.base = W * 0.16; R.base = W * 0.84;
      if (!combatLance) { L.x = L.base; R.x = R.base; }
    }

    const mk = (camp: Camp, face: 1 | -1, nom: string, classe: string, packet: PacketSprite, fb: FormeChargee, ft: FormeChargee | null, pvMax: number): Fighter => ({
      camp, face, nom, classe, packet, formeBase: fb, formeTransfo: ft, transforme: false,
      pvMax, pv: pvMax, resistance: packet.resistanceBase,
      base: 0, x: 0, anim: 'idle', fps: 5, mode: 'ping', t0: performance.now(),
      knock: 0, effetOn: false, effetT0: 0, isCasting: false, transformedProj: false,
    });

    const L = mk('a', 1, gauche.nom, gauche.classe, spritesA.base, baseA, transfoA, gauche.pv_max);
    const R = mk('b', -1, droite.nom, droite.classe, spritesB.base, baseB, transfoB, droite.pv_max);
    let combatLance = false;

    function setA(f: Fighter, anim: string, fps: number, mode: Mode) { f.anim = anim; f.fps = fps; f.mode = mode; f.t0 = performance.now(); }
    function scaleF(f: Fighter) { return (H * ECHELLE_PERSO) / formeActuelle(f).ref * (packetActuel(f, { spritesA, spritesB }).taille || 1); }
    function pick(arr: FrameImg[], f: Fighter): FrameImg | null {
      const e = (performance.now() - f.t0) / 1000 * f.fps; const n = arr.length;
      if (!n) return null;
      if (f.mode === 'loop') return arr[Math.floor(e) % n];
      if (f.mode === 'once') return arr[Math.min(n - 1, Math.floor(e))];
      const per = 2 * n - 2 || 1; const p = Math.floor(e) % per;
      return arr[p < n ? p : per - p];
    }
    function frameOf(f: Fighter): FrameImg | null {
      let a = formeActuelle(f).anims[f.anim];
      if (!a || !a.length) a = formeActuelle(f).anims.idle;
      return pick(a, f);
    }
    function drawEffet(f: Fighter) {
      if (!f.effetOn) return;
      const p = packetActuel(f, { spritesA, spritesB });
      const arr = formeActuelle(f).anims.special_effet;
      if (!arr.length) return;
      const e = (performance.now() - f.effetT0) / 1000 * p.efFps;
      const idx = p.efLoop ? Math.floor(e) % arr.length : Math.min(arr.length - 1, Math.floor(e));
      const fr = arr[idx]; if (!fr) return;
      const S = scaleF(f) * p.efSize; const tw = fr.w * S; const th = fr.h * S;
      const bodyH = scaleF(f) * formeActuelle(f).ref;
      const ex = f.x + f.face * (p.efX * bodyH * 0.5);
      const ey = GY - bodyH * 0.5 - (p.efY * bodyH * 0.5);
      ctx.save(); ctx.globalAlpha = p.efOp; ctx.translate(ex, ey); ctx.scale(f.face, 1);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.img, -tw / 2, -th / 2, tw, th); ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawF(f: Fighter) {
      const p = packetActuel(f, { spritesA, spritesB });
      if (f.effetOn && p.efPlan === 'derriere') drawEffet(f);
      let fr: FrameImg | null;
      if (f.transformedProj && formeActuelle(f).anims.special_projectile.length) fr = pick(formeActuelle(f).anims.special_projectile, f);
      else fr = frameOf(f);
      if (fr) {
        const S = scaleF(f) * (f.transformedProj ? (p.spProjSize || 1) : 1);
        const tw = fr.w * S; const th = fr.h * S;
        ctx.save(); ctx.translate(f.x, GY); ctx.scale(1, 0.22); ctx.beginPath();
        ctx.ellipse(0, 0, tw * 0.4, tw * 0.13, 0, 0, 7); ctx.fillStyle = 'rgba(20,12,4,.35)'; ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(f.x + f.knock, GY); ctx.scale(f.face, 1); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(fr.img, -tw / 2, -th, tw, th); ctx.restore();
      }
      if (f.effetOn && p.efPlan === 'devant') drawEffet(f);
    }

    let proj: { arr: FrameImg[]; face: number; x: number; y: number; t0: number; sizeMult: number } | null = null;
    let projTrail: { x: number; y: number }[] = [];
    function drawProj() {
      if (!proj || !proj.arr.length) return;
      projTrail.forEach((pt, i) => {
        ctx.globalAlpha = (i / projTrail.length) * 0.4; ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const e = (performance.now() - proj.t0) / 1000 * 12;
      const fr = proj.arr[Math.floor(e) % proj.arr.length];
      // §7 : largeur = H*0.22*taille — réduite de 15% (retour utilisateur : "un peu gros").
      const pw = H * 0.22 * 0.85 * (proj.sizeMult || 1); const ph = pw * (fr.h / fr.w);
      ctx.save(); ctx.translate(proj.x, proj.y); ctx.scale(proj.face, 1); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fr.img, -pw / 2, -ph / 2, pw, ph); ctx.restore();
    }

    let flash = 0; let shake = 0;
    let fx: { x: number; y: number; g: number; a: number; couleur: string } | null = null;
    interface Popup { v: string; x: number; y: number; crit: boolean; life: number; couleur: string; t0: number; }
    // Une LISTE, pas un objet unique : sur un beat qui cumule dégâts + vol de vie + debuff
    // (Arlong, Smoker…), les popups s'enchaînent à 220 ms d'intervalle. Avec un seul slot,
    // chacun écrasait le précédent et le joueur ne lisait jamais rien.
    let popups: Popup[] = [];
    let anneauTransfo: { x: number; y: number; t0: number; couleur: string } | null = null;
    // Pose de victoire : le reste de l'arène s'assombrit, le vainqueur reste dans la lumière.
    let projecteur: { f: Fighter; t0: number } | null = null;

    /** Un seul point d'entrée pour les popups (dégâts, soin, esquive, poison, debuff, spécial…) :
     * ajoute une couleur cohérente par nature d'effet, et un `t0` pour l'animation de pop. */
    function popup(v: string, x: number, y: number, opts: { crit?: boolean; couleur?: string; life?: number } = {}) {
      // Les popups encore vivants au même endroit sont poussés vers le haut : deux chiffres
      // superposés sont illisibles, alors qu'empilés ils se lisent comme une addition.
      const voisins = popups.filter((p) => Math.abs(p.x - x) < W * 0.2);
      const y0 = y - voisins.length * 20;
      popups.push({
        v, x, y: y0, crit: opts.crit ?? false, life: opts.life ?? 1.4,
        couleur: opts.couleur ?? (opts.crit ? '#ffc53d' : '#fff'), t0: performance.now(),
      });
      // Garde-fou : un combat très long ne doit pas accumuler indéfiniment.
      if (popups.length > 12) popups.shift();
    }

    function drawBG() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2a6cb0'); g.addColorStop(0.5, '#3a86c0'); g.addColorStop(0.5, '#c9a24a'); g.addColorStop(1, '#a07c34');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      for (let i = 0; i < 6; i++) ctx.fillRect(0, H * (0.55 + i * 0.07), W, 2);
    }
    function drawFX() {
      if (fx) {
        ctx.save(); ctx.translate(fx.x, fx.y); ctx.strokeStyle = fx.couleur; ctx.lineWidth = 3; ctx.globalAlpha = fx.a;
        for (let i = 0; i < 8; i++) {
          const a = Math.PI * i / 4;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(Math.cos(a) * (14 + fx.g * 16), Math.sin(a) * (14 + fx.g * 16)); ctx.stroke();
        }
        ctx.fillStyle = fx.couleur; ctx.beginPath(); ctx.arc(0, 0, 5 + fx.g * 4, 0, 7); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
      }
      if (anneauTransfo) {
        const age = performance.now() - anneauTransfo.t0;
        const duree = d(700);
        const t = Math.min(1, age / duree);
        ctx.save(); ctx.translate(anneauTransfo.x, anneauTransfo.y);
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = anneauTransfo.couleur; ctx.lineWidth = 6 * (1 - t * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, t * H * 0.24, 0, 7); ctx.stroke();
        ctx.globalAlpha = (1 - t) * 0.5; ctx.beginPath(); ctx.arc(0, 0, t * H * 0.16, 0, 7); ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
        if (t >= 1) anneauTransfo = null;
      }
      for (const p of popups) {
        // Petit "pop" d'échelle à l'apparition (0.4 → 1.15 → 1) : un chiffre qui jaillit au lieu
        // d'un texte statique qui se contente de monter en fondu.
        const age = performance.now() - p.t0;
        const echelle = age < 110 ? lerp(0.4, 1.18, age / 110) : age < 190 ? lerp(1.18, 1, (age - 110) / 80) : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(echelle, echelle);
        // Fondu sur la fin de vie : les popups les plus anciens s'effacent d'abord, ce qui
        // garde la pile lisible quand plusieurs se superposent.
        ctx.globalAlpha = Math.min(1, p.life / 0.5);
        ctx.fillStyle = p.couleur; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        ctx.font = `italic 900 ${p.crit ? 22 : 17}px Arial`; ctx.textAlign = 'center';
        ctx.strokeText(p.v, 0, 0); ctx.fillText(p.v, 0, 0); ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
    }

    /** Le coup de projecteur sur le vainqueur. Dessiné APRÈS les persos : le dégradé est
     *  transparent au centre, donc le vainqueur reste net pendant que tout le reste plonge. */
    function drawProjecteur() {
      if (!projecteur) return;
      const t = Math.min(1, (performance.now() - projecteur.t0) / d(420));
      const cx = projecteur.f.x; const cy = GY - H * 0.10;
      const g = ctx.createRadialGradient(cx, cy, H * 0.02, cx, cy, H * 0.40);
      g.addColorStop(0, 'rgba(10,6,2,0)');
      g.addColorStop(0.55, `rgba(10,6,2,${0.35 * t})`);
      g.addColorStop(1, `rgba(10,6,2,${0.82 * t})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // Halo d'or qui respire aux pieds du vainqueur.
      ctx.save(); ctx.globalAlpha = 0.35 * t; ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, GY, H * 0.09, H * 0.022, 0, 0, 7); ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 1;
    }

    let arret = false;
    function render() {
      if (arret) return;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const sx = (Math.random() - 0.5) * shake; const sy = (Math.random() - 0.5) * shake;
      ctx.save(); ctx.translate(sx, sy); drawBG();
      let arr: Fighter[] = L.x <= R.x ? [R, L] : [L, R];
      if (L.isCasting) arr = [R, L]; else if (R.isCasting) arr = [L, R];
      [L, R].forEach((f) => { const p = packetActuel(f, { spritesA, spritesB }); if (f.effetOn && p.efPlan === 'arriere') drawEffet(f); });
      drawF(arr[0]);
      if (L.isCasting || R.isCasting) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H); }
      drawF(arr[1]);
      drawProj(); drawProjecteur(); drawFX(); ctx.restore();
      flash = Math.max(0, flash - 0.04); shake = Math.max(0, shake - 0.8);
      if (proj) { projTrail.push({ x: proj.x, y: proj.y }); if (projTrail.length > 7) projTrail.shift(); }
      if (fx) { fx.g = Math.min(1, fx.g + 0.15); fx.a = Math.max(0, fx.a - 0.05); if (fx.a <= 0) fx = null; }
      for (const p of popups) { p.y -= 0.6; p.life -= 0.02; }
      popups = popups.filter((p) => p.life > 0);
      // setTimeout plutôt que requestAnimationFrame : rAF est mis en PAUSE COMPLÈTE dans un
      // onglet en arrière-plan, alors qu'un timer continue de tourner — au ralenti.
      //
      // ⚠️ Mesuré le 20/07/2026 : dans un onglet caché, Chrome throttle ce setTimeout(16) à
      // ~611 ms, soit 38× plus lent. Un viewer qui change d'appli en plein combat ne voit donc
      // pas l'écran figé, mais le combat rampe. Ce n'est pas grave : les Berrys, l'énergie et
      // l'XP sont écrits en base par lancerCombat() AVANT que le front ne rejoue quoi que ce
      // soit — rien n'est perdu si le joueur ne regarde pas la fin.
      setTimeout(render, 16);
    }

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
    // Toutes les durées passent par d() : diviser par la vitesse, c'est tout le toggle ×2.
    const d = (ms: number) => ms / vitesseRef.current;
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, d(ms)));
    const tween = (dur: number, fn: (t: number) => void) => new Promise<void>((res) => {
      const t0 = performance.now(); const duree = d(dur);
      (function step(now: number) {
        const t = Math.min(1, (now - t0) / duree); fn(t);
        if (t < 1) setTimeout(() => step(performance.now()), 16); else res();
      })(performance.now());
    });

    function setPv(f: Fighter, pvRestants: number, pvMax: number) {
      f.pv = pvRestants;
      const pct = Math.max(0, (pvRestants / pvMax) * 100);
      if (f.camp === 'a') setPvGaucheAff(pct); else setPvDroiteAff(pct);
    }
    function setResistanceAff(f: Fighter) {
      if (f.camp === 'a') setResistanceGauche(f.resistance); else setResistanceDroite(f.resistance);
    }
    function setBuffAff(f: Fighter) {
      if (f.camp === 'a') setBuffGauche(true); else setBuffDroite(true);
    }
    const EMOJI_DEBUFF: Record<string, string> = { attack: '⚔️⬇️', esquive: '💨⬇️', regen: '♻️🚫' };
    let idDebuff = 0;
    function ajouterDebuffAff(f: Fighter, stat: string, tours: number) {
      const emoji = EMOJI_DEBUFF[stat]; if (!emoji) return;
      const id = idDebuff++;
      const setter = f.camp === 'a' ? setDebuffsGauche : setDebuffsDroite;
      setter((prev) => [...prev, { id, emoji }]);
      // Pas d'événement "debuff expiré" dans le contrat (§6) — durée visuelle approximative
      // (~2s/tour), suffisant pour un affichage informatif, pas pour du calcul.
      setTimeout(() => setter((prev) => prev.filter((x) => x.id !== id)), d(tours * 2000));
    }

    async function afficherImpact(attaquant: Fighter, defenseur: Fighter, issue: Issue, ix: number, iy: number, special: boolean, sonImpact: NomEffet | null) {
      if (issue.esquive) {
        jouerEffet('esquive');
        const dx = defenseur.x; setA(defenseur, 'idle', 8, 'ping');
        await tween(220, (t) => { defenseur.x = dx - attaquant.face * Math.sin(t * Math.PI) * 20; });
        popup('ESQUIVE', defenseur.x, GY - H * 0.3, { couleur: '#25d3df' });
        return;
      }
      // Le critique remplace le son d'impact normal, il ne s'y ajoute pas.
      if (sonImpact) jouerEffet(issue.crit ? 'critique' : sonImpact);
      setA(defenseur, 'hit', 8, 'once'); flash = 1; shake = 12; fx = { x: ix, y: iy, g: 0, a: 1, couleur: '#fff' };
      const valeur = Math.round(issue.degats?.valeur ?? 0);
      // Le popup dit ce qui SORT DE L'ORDINAIRE, pas le détail du calcul : le "×1.1" du counter
      // parasitait le chiffre de dégâts sur une attaque banale (retour utilisateur). L'avantage
      // de classe est désormais enseigné une bonne fois sur l'écran VS, pas répété à chaque coup.
      let libelle = special ? 'SPÉCIAL ' : '';
      if (issue.crit) libelle += 'CRIT ';
      // Le counter ne grossit plus le chiffre non plus : un nombre en or sans libellé pour
      // l'expliquer se lisait comme un critique.
      popup(`${libelle}-${valeur}`, defenseur.x, GY - H * 0.32, { crit: special || issue.crit, life: 1.4 });
      if (issue.degats) setPv(defenseur, issue.degats.pv_restants, issue.degats.pv_max);
      await tween(240, (t) => { defenseur.knock = attaquant.face * Math.sin(t * Math.PI) * 13; });
      defenseur.knock = 0;
      if (issue.resistanceValeur) {
        defenseur.resistance = issue.resistanceValeur; setResistanceAff(defenseur);
        popup('RÉSISTE 🛡️', defenseur.x, GY - H * 0.38, { couleur: '#9ad1ff', life: 1 });
      }
      await sleep(120);
      if (issue.soin) {
        setPv(attaquant, issue.soin.pv_restants, issue.soin.pv_max);
        fx = { x: attaquant.x, y: GY - H * 0.2, g: 0, a: 1, couleur: '#5fbf4d' };
        popup(`+${Math.round(issue.soin.valeur)}`, attaquant.x, GY - H * 0.32, { couleur: '#5fbf4d', life: 1.2 });
        await sleep(220);
      }
      for (const deb of issue.debuffs) {
        popup(LABEL_DEBUFF[deb.stat] ?? 'MALUS', defenseur.x, GY - H * 0.32, { couleur: '#ff9a3d', life: 1.2 });
        ajouterDebuffAff(defenseur, deb.stat, deb.tours);
        await sleep(220);
      }
    }

    // Les persos étant plus écartés (retour utilisateur), une durée FIXE ferait paraître la
    // course trop lente ou trop rapide selon l'écart réel — on calcule la durée depuis la
    // distance à parcourir (ms/px), bornée pour ne jamais être ridiculement courte ou longue.
    const dureeSelonDistance = (distance: number, msParPx: number, min: number, max: number) => (
      Math.min(max, Math.max(min, Math.abs(distance) * msParPx))
    );

    async function beatMelee(attaquant: Fighter, defenseur: Fighter, issue: Issue, special: boolean, sonImpact: NomEffet | null) {
      attaquant.face = defenseur.x > attaquant.x ? 1 : -1;
      const sx = attaquant.x; const cx = defenseur.x - attaquant.face * (H * 0.15);
      // Course perçue comme lente (retour utilisateur) : -30% sur la durée = +30% de vitesse.
      const dureeAller = dureeSelonDistance(cx - sx, 5.1 * 0.7, 350 * 0.7, 950 * 0.7);
      setA(attaquant, 'run', 12, 'loop'); await tween(dureeAller, (t) => { attaquant.x = lerp(sx, cx, easeOut(t)); });
      setA(attaquant, 'attack', 16, 'once');
      // Le son d'épée arrivait perceptiblement après le coup à l'écran (retour utilisateur) :
      // on le joue 200 ms plus tôt, sans toucher au timing du reste de l'impact (flash,
      // dégâts…). Pas d'avance en cas d'esquive : il n'y a alors aucun coup à sonoriser.
      const avanceEpee = sonImpact === 'coup_epee' && !issue.esquive;
      if (avanceEpee) setTimeout(() => jouerEffet('coup_epee'), d(Math.max(0, 192 - 200)));
      await sleep(192);
      await afficherImpact(attaquant, defenseur, issue, cx + attaquant.face * (H * 0.05), GY - H * 0.16, special, avanceEpee ? null : sonImpact);
      await sleep(160); setA(attaquant, 'run', 12, 'loop');
      await tween(dureeAller * 0.85, (t) => { attaquant.x = lerp(cx, sx, easeOut(t)); });
      setA(attaquant, 'idle', 5, 'ping'); setA(defenseur, 'idle', 5, 'ping'); await sleep(120);
    }
    async function beatRanged(attaquant: Fighter, defenseur: Fighter, issue: Issue, special: boolean, sonImpact: NomEffet | null) {
      const p = packetActuel(attaquant, { spritesA, spritesB });
      attaquant.face = defenseur.x > attaquant.x ? 1 : -1;
      setA(attaquant, 'attack', 12, 'once'); await sleep(288);
      // §7 : hauteur calibrée par l'artiste contre l'échelle d'origine — voir RATIO_HAUTEUR_PROJECTILE.
      const py = GY - H * (0.05 + p.projH * 0.40) * RATIO_HAUTEUR_PROJECTILE;
      const sxp = attaquant.x + attaquant.face * (H * 0.07); const exp = defenseur.x - attaquant.face * (H * 0.04);
      proj = { arr: formeActuelle(attaquant).anims.projectile, face: attaquant.face, x: sxp, y: py, t0: performance.now(), sizeMult: p.projSize };
      projTrail = [];
      await tween(dureeSelonDistance(exp - sxp, 3.4, 280, 800), (t) => { proj!.x = lerp(sxp, exp, t); proj!.y = py; });
      proj = null; projTrail = [];
      // Le son se déclenche à l'impact (dans afficherImpact), pas au tir.
      await afficherImpact(attaquant, defenseur, issue, exp, py, special, sonImpact);
      await sleep(150); setA(attaquant, 'idle', 5, 'ping'); setA(defenseur, 'idle', 5, 'ping'); await sleep(120);
    }
    async function jouerAttaque(declencheur: Evenement & { type: 'attaque' }, issue: Issue) {
      const attaquant = declencheur.acteur === 'a' ? L : R; const defenseur = declencheur.acteur === 'a' ? R : L;
      const p = packetActuel(attaquant, { spritesA, spritesB });
      if (formeActuelle(attaquant).anims.projectile.length > 0) await beatRanged(attaquant, defenseur, issue, false, 'coup_projectile');
      else await beatMelee(attaquant, defenseur, issue, false, attaquant.classe === 'Sabreur' ? 'coup_epee' : 'coup_normal');
      void p;
    }

    // Commun aux 3 catégories de spécial (dmg/buff/transfo) : pose de cast, aura, écran assombri
    // et temps figé CAST_MS — repris du testeur, qui ne les appliquait qu'aux spéciaux à dégâts.
    // Kuroobi (buff) et les transfos (Dalton/Chopper/Pell) méritent le même traitement.
    function lancerCast(attaquant: Fighter, son: 'special' | 'transformation'): { hasAnim: boolean; fireAt: number; castT0: number } {
      const p = packetActuel(attaquant, { spritesA, spritesB });
      const hasAnim = formeActuelle(attaquant).anims.special.length > 0;
      const hasEffet = formeActuelle(attaquant).anims.special_effet.length > 0;
      popup('SPÉCIAL !', attaquant.x, GY - H * 0.42, { crit: true, life: 1.1 });
      jouerEffet(son);
      if (hasEffet) { attaquant.effetOn = true; attaquant.effetT0 = performance.now(); }
      attaquant.isCasting = true;
      const castT0 = performance.now();
      if (hasAnim) setA(attaquant, 'special', p.specialFps, 'once'); else setA(attaquant, 'idle', 5, 'ping');
      const animDur = hasAnim ? (formeActuelle(attaquant).anims.special.length / p.specialFps) * 1000 : 900;
      const fireAt = Math.min(4000, Math.max(120, animDur * p.spDelay));
      setTimeout(() => { attaquant.isCasting = false; }, d(CAST_MS));
      return { hasAnim, fireAt, castT0 };
    }
    async function finCast(attaquant: Fighter, castT0: number) {
      const reste = d(CAST_MS) - (performance.now() - castT0);
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      attaquant.isCasting = false; attaquant.effetOn = false;
      await sleep(200); setA(attaquant, 'idle', 5, 'ping'); await sleep(120);
    }

    async function jouerSpecialDmg(attaquant: Fighter, defenseur: Fighter, issue: Issue) {
      const p = packetActuel(attaquant, { spritesA, spritesB });
      attaquant.face = defenseur.x > attaquant.x ? 1 : -1;
      const hasProj = formeActuelle(attaquant).anims.special_projectile.length > 0;
      const sx = attaquant.x;
      const { hasAnim, fireAt, castT0 } = lancerCast(attaquant, 'special');
      await sleep(fireAt);

      if (hasAnim) {
        if (hasProj) {
          const py = GY - H * (0.05 + p.spProjH * 0.40) * RATIO_HAUTEUR_PROJECTILE;
          const sxp = attaquant.x + attaquant.face * (H * 0.07); const exp = defenseur.x - attaquant.face * (H * 0.04);
          proj = { arr: formeActuelle(attaquant).anims.special_projectile, face: attaquant.face, x: sxp, y: py, t0: performance.now(), sizeMult: p.spProjSize };
          projTrail = [];
          await tween(p.spProjDur, (t) => { proj!.x = lerp(sxp, exp, t); proj!.y = py; });
          proj = null; projTrail = [];
          await afficherImpact(attaquant, defenseur, issue, exp, py, true, 'coup_projectile');
        } else {
          await afficherImpact(attaquant, defenseur, issue, defenseur.x - attaquant.face * (H * 0.05), GY - H * 0.16, true, null);
        }
      } else if (hasProj) {
        attaquant.transformedProj = true; attaquant.t0 = performance.now(); attaquant.mode = 'once';
        attaquant.fps = formeActuelle(attaquant).anims.special_projectile.length;
        const cx = defenseur.x - attaquant.face * (H * 0.08);
        await tween(p.spProjDur, (t) => { attaquant.x = lerp(sx, cx, easeOut(t)); });
        await afficherImpact(attaquant, defenseur, issue, cx, GY - H * 0.16, true, 'coup_projectile');
        attaquant.transformedProj = false; setA(attaquant, 'run', 12, 'loop');
        await tween(360, (t) => { attaquant.x = lerp(cx, sx, easeOut(t)); });
      }
      attaquant.x = sx;
      await finCast(attaquant, castT0);
      setA(defenseur, 'idle', 5, 'ping'); await sleep(120);
    }
    async function jouerSpecialBuff(attaquant: Fighter, ev: Evenement & { type: 'buff' }) {
      const { fireAt, castT0 } = lancerCast(attaquant, 'transformation');
      await sleep(fireAt);
      popup(`+${Math.round(ev.pct * 100)}% ATK`, attaquant.x, GY - H * 0.42, { couleur: '#5fbf4d', crit: true, life: 1.4 });
      fx = { x: attaquant.x, y: GY - H * 0.2, g: 0, a: 1, couleur: '#5fbf4d' };
      setBuffAff(attaquant);
      await finCast(attaquant, castT0);
    }
    async function jouerSpecialTransfo(attaquant: Fighter, ev: Evenement & { type: 'transformation' }) {
      const { fireAt, castT0 } = lancerCast(attaquant, 'transformation');
      await sleep(fireAt);
      const couleurClasse = { Haki: '#8e44ad', Logia: '#e67e22', Paramecia: '#16a085', Zoan: '#c0392b', Sniper: '#2980b9', Sabreur: '#27ae60' }[attaquant.classe] ?? '#ffc53d';
      popup('TRANSFORMATION !', attaquant.x, GY - H * 0.42, { couleur: '#ffc53d', crit: true, life: 1.6 });
      flash = 1; shake = 16;
      anneauTransfo = { x: attaquant.x, y: GY - formeActuelle(attaquant).ref * scaleF(attaquant) * 0.5, t0: performance.now(), couleur: couleurClasse };
      attaquant.transforme = true;
      if (ev.resistance !== undefined) { attaquant.resistance = Math.max(attaquant.resistance, ev.resistance); setResistanceAff(attaquant); }
      await finCast(attaquant, castT0);
    }

    async function jouerBeat(beat: Beat) {
      if (beat.kind === 'action') {
        const { declencheur, consequences } = beat;
        if (declencheur.type === 'attaque') { await jouerAttaque(declencheur, lireIssue(consequences)); return; }
        // special
        const attaquant = declencheur.acteur === 'a' ? L : R;
        const defenseur = declencheur.acteur === 'a' ? R : L;
        if (declencheur.categorie === 'buff') { await jouerSpecialBuff(attaquant, consequences[0] as Evenement & { type: 'buff' }); return; }
        if (declencheur.categorie === 'transfo') { await jouerSpecialTransfo(attaquant, consequences[0] as Evenement & { type: 'transformation' }); return; }
        await jouerSpecialDmg(attaquant, defenseur, lireIssue(consequences));
        return;
      }
      if (beat.kind === 'tick') {
        const ev = beat.evenement;
        const f = ev.type === 'regen' ? (ev.acteur === 'a' ? L : R) : (ev.cible === 'a' ? L : R);
        const positif = ev.type === 'regen';
        popup(`${positif ? '+' : '−'}${Math.round(ev.valeur)}`, f.x, GY - H * 0.3, { couleur: positif ? '#5fbf4d' : '#b34dff' });
        if (positif) fx = { x: f.x, y: GY - H * 0.2, g: 0, a: 0.7, couleur: '#5fbf4d' };
        setPv(f, ev.pv_restants, ev.pv_max);
        await sleep(500);
        return;
      }
      if (beat.kind === 'ko') {
        const f = beat.evenement.perso === 'a' ? L : R;
        const autre = f === L ? R : L;
        f.face = autre.x > f.x ? 1 : -1;
        setA(f, 'death', 8, 'once');
        await sleep(700);
        return;
      }
      // fin — ouverture et fermeture du combat sont ses deux moments à émotion : le VS claque
      // déjà, la fin ne doit pas se contenter d'un overlay qui se pose par-dessus un écran mort.
      // camp 'a' = toujours le joueur (§ combat-api.ts : gagne = resultat.vainqueur === 'a').
      arreterMusique();
      jouerEffet(beat.evenement.vainqueur === 'a' ? 'victoire' : 'defaite');
      await poseDeVictoire(beat.evenement.vainqueur === 'a' ? L : R);
      setFini(true);
    }

    /** ~1,2 s où le vainqueur seul occupe l'attention : il revient au centre, rejoue son anim
     *  la plus spectaculaire, sous un projecteur. Ensuite seulement le panneau de fin claque. */
    async function poseDeVictoire(vainqueur: Fighter) {
      const autre = vainqueur === L ? R : L;
      projecteur = { f: vainqueur, t0: performance.now() };
      vainqueur.face = autre.x > vainqueur.x ? 1 : -1;

      const sx = vainqueur.x;
      setA(vainqueur, 'run', 12, 'loop');
      await tween(420, (t) => { vainqueur.x = lerp(sx, W * 0.5, easeOut(t)); });

      // Idle, pas l'anim de spécial (retour utilisateur) : rejouer une attaque après la victoire
      // fait croire que le combat continue. L'idle se lit comme une pose, c'est ce qu'on veut.
      setA(vainqueur, 'idle', 6, 'ping');
      await sleep(1200);
    }

    async function jouer() {
      combatLance = true;
      const beats = grouperEvenements(resultat.evenements);
      for (const beat of beats) {
        // eslint-disable-next-line no-await-in-loop
        await jouerBeat(beat);
      }
    }

    fit();
    window.addEventListener('resize', fit);
    setPret(true);
    render();
    jouer().catch((e) => { setErreurChargement(`Erreur pendant le combat : ${(e as Error).message}`); });

    return () => { arret = true; window.removeEventListener('resize', fit); };
  }

  const classeCouleurs: Record<string, string> = {
    Haki: 'var(--classe-haki)', Logia: 'var(--classe-logia)', Paramecia: 'var(--classe-paramecia)',
    Zoan: 'var(--classe-zoan)', Sniper: 'var(--classe-sniper)', Sabreur: 'var(--classe-sabreur)',
  };

  if (erreurChargement) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--texte)', background: '#0f2733' }}>
        {erreurChargement}
      </div>
    );
  }

  if (phase === 'vs') {
    const couleurG = classeCouleurs[gauche.classe] ?? '#888';
    const couleurD = classeCouleurs[droite.classe] ?? '#888';

    // Un camp par côté du portrait : nom, niveau, rareté. L'écran VS ne montrait que nom +
    // classe, alors que l'enjeu dramatique du combat est « Arlong Niv 3 vs Crocodile Niv 1 » —
    // le niveau est le levier n°1 de l'équilibrage (+40 %).
    const Camp = ({ combattant, portrait, couleur, meta, sousTitre, cote, avantage }: {
      combattant: { nom: string; classe: string };
      portrait: string | null; couleur: string;
      meta: { niveau: number; rarete: string };
      sousTitre: string; cote: 'gauche' | 'droite'; avantage: boolean;
    }) => (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flex: 1, minWidth: 0,
        // Entrées opposées avec overshoot. La droite part 150 ms après la gauche : les deux
        // portraits qui arrivent pile ensemble donnent une image plate, le décalage crée le duel.
        animation: `${cote === 'gauche' ? 'vsEntreeGauche' : 'vsEntreeDroite'} .55s cubic-bezier(.2,.9,.3,1.5) both`,
        animationDelay: cote === 'gauche' ? '0s' : '.15s',
      }}
      >
        <div style={{
          width: 100, height: 100, borderRadius: 14, overflow: 'hidden', background: '#123540',
          // Le contour du portrait suit la RARETÉ, pas la classe (retour utilisateur du 24/07) —
          // `couleur` (classe) reste utilisé pour le badge de classe et le dégradé de fond.
          border: `4px solid ${COULEUR_RARETE[meta.rarete] ?? '#888'}`, position: 'relative',
          boxShadow: avantage ? `0 0 16px 3px ${COULEUR_RARETE[meta.rarete] ?? '#888'}` : undefined,
        }}
        >
          {portrait
            ? <img src={portrait} alt={combattant.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(239,231,214,.4)', font: "700 9px 'Courier New',monospace" }}>SPRITE</div>}
          <div style={{
            position: 'absolute', bottom: -6, right: -6, minWidth: 26, height: 26, borderRadius: '50%',
            background: '#14303c', border: `2.5px solid ${COULEUR_RARETE[meta.rarete] ?? '#888'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '800 11px Rubik,Arial', color: '#efe7d6',
          }}
          >
            {meta.niveau}
          </div>
        </div>
        <div style={{ font: '800 13px Rubik,Arial', color: 'var(--texte)', textAlign: 'center' }}>{combattant.nom}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ background: couleur, color: '#fff', font: '800 9px Rubik,Arial', padding: '2px 8px', borderRadius: 10 }}>{combattant.classe}</span>
          <span style={{ background: COULEUR_RARETE[meta.rarete] ?? '#888', color: '#1a1208', font: '800 9px Rubik,Arial', padding: '2px 8px', borderRadius: 10 }}>{meta.rarete}</span>
        </div>
        <div style={{ font: '700 9px Rubik,Arial', color: 'rgba(239,231,214,.65)', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sousTitre}
        </div>
      </div>
    );

    return (
      <div
        onClick={spritesPrets ? demarrerCombat : undefined}
        style={{
          minHeight: '100%', background: '#0f2733', display: 'flex', position: 'relative', overflow: 'hidden',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24,
          cursor: spritesPrets ? 'pointer' : undefined,
        }}
      >
        {/* Split diagonal : chaque moitié prend la couleur de classe de son combattant.
            Identité visuelle immédiate, et ça remplit le fond qui était vide. */}
        <div style={{
          position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${couleurG} 0%, #0f2733 78%)`,
          clipPath: 'polygon(0 0, 100% 0, 0 100%)', opacity: 0.35, pointerEvents: 'none',
        }}
        />
        <div style={{
          position: 'absolute', inset: 0, background: `linear-gradient(340deg, ${couleurD} 0%, #0f2733 78%)`,
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', opacity: 0.35, pointerEvents: 'none',
        }}
        />
        {/* Le trait de coupe, qui rend la diagonale lisible. */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top right, transparent calc(50% - 1.5px), rgba(255,197,61,.55) 50%, transparent calc(50% + 1.5px))',
        }}
        />
        {/* Flash blanc au moment où le VS claque. */}
        <div style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'vsFlashBlanc .6s ease-out .3s both', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', gap: 4 }}>
          <Camp
            combattant={gauche} portrait={spritesA.portrait} couleur={couleurG}
            meta={combat.moi} sousTitre="ton pirate" cote="gauche"
            avantage={combat.avantage?.camp === 'a'}
          />

          <div style={{
            flex: 'none', font: '400 34px Bangers,Rubik', letterSpacing: 1, color: 'var(--or)',
            textShadow: '2px 2px 0 #000', padding: '0 8px',
            // Le VS claque au centre : 3 → 1 avec micro-rebond, puis micro-shake.
            animation: 'vsClaque .45s cubic-bezier(.2,.8,.3,1.4) .25s both, vsShake .25s ease-out .7s',
          }}
          >
            VS
          </div>

          <Camp
            combattant={droite} portrait={spritesB.portrait} couleur={couleurD}
            meta={combat.adversaire} sousTitre={combat.adversaire.pseudo} cote="droite"
            avantage={combat.avantage?.camp === 'b'}
          />
        </div>

        {/* Pédagogie du triangle : sans ça, personne ne comprend jamais le système de classes,
            et l'écran VS est le seul endroit naturel pour l'enseigner. Toujours affiché (même
            neutre) : sans matchup visible en l'absence d'avantage, le joueur ne pouvait jamais
            vérifier qu'il N'Y A PAS d'avantage — ×1.1 en dur était illisible, remplacé par le
            nom de la classe qui en profite. */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,.45)', border: '2px solid var(--or)', borderRadius: 20,
          padding: '6px 14px', animation: 'fadeMonte .4s ease-out .8s both',
        }}
        >
          <span style={{ font: '800 11px Rubik,Arial', color: 'var(--or)' }}>
            ⚔️ {gauche.classe} vs {droite.classe} —{' '}
            {combat.avantage
              ? `avantage ${combat.avantage.camp === 'a' ? gauche.classe : droite.classe}`
              : 'neutre'}
          </span>
        </div>

        <div style={{ position: 'relative', font: '700 11px Rubik,Arial', color: 'rgba(239,231,214,.6)', textAlign: 'center', animation: 'fadeMonte .4s ease-out 1.1s both' }}>
          {spritesPrets ? 'L\'équipage est prêt — touche pour en découdre' : 'L\'équipage se prépare…'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: '#123540', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px 0' }}>
        <button
          onClick={() => setVitesse((v) => (v === 1 ? 2 : v === 2 ? 3 : 1))}
          style={{ font: '800 11px Rubik,Arial', background: vitesse > 1 ? 'var(--or)' : 'rgba(255,255,255,.15)', color: vitesse > 1 ? '#1a1208' : '#fff', border: '2px solid var(--or)', borderRadius: 20, padding: '5px 14px' }}
        >
          VITESSE ×{vitesse}
        </button>
        <button
          onClick={() => basculerSons()}
          title={muet ? 'Activer les sons' : 'Couper les sons'}
          style={{ font: '800 13px Rubik,Arial', background: 'rgba(255,255,255,.15)', color: '#fff', border: '2px solid var(--or)', borderRadius: 20, padding: '5px 10px', lineHeight: 1 }}
        >
          {muet ? '🔇' : '🔊'}
        </button>
      </div>

      <div style={{
        position: 'relative', margin: '10px 16px', aspectRatio: '3 / 4', borderRadius: 14,
        overflow: 'hidden', border: '4px solid #1a1208', boxShadow: '0 6px 0 #000', background: '#000',
      }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }} />

        <div style={{ position: 'absolute', top: 12, left: 12, width: '42%', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ font: '900 12px Rubik,Arial', color: '#fff', textShadow: '1px 1px 2px #000', display: 'flex', gap: 6, alignItems: 'center' }}>
            {gauche.nom}
            <span style={{ font: '900 9px Rubik,Arial', padding: '2px 6px', borderRadius: 10, background: classeCouleurs[gauche.classe] ?? '#888', color: '#fff' }}>{gauche.classe}</span>
            {resistanceGauche > 0 && <span title="Résistance">🛡️</span>}
            {buffGauche && <span title="Buff Attack">💪</span>}
          </div>
          <div style={{
            position: 'relative', width: '100%', height: 12, border: '2.5px solid #14100c', borderRadius: 20,
            background: '#fff', overflow: 'hidden', animation: pvGaucheAff < 25 ? 'hpCritique 0.6s ease-in-out infinite' : undefined,
          }}
          >
            {/* Traînée : reste en arrière puis rattrape, pour "voir" le morceau de vie qu'on vient de perdre. */}
            <div style={{ position: 'absolute', inset: 0, width: `${pvGaucheAff}%`, background: '#ffb03d', transition: 'width 0.8s ease-out 0.15s' }} />
            <div style={{ position: 'relative', height: '100%', width: `${pvGaucheAff}%`, background: '#e8412b', transition: 'width .15s ease-out' }} />
          </div>
          {debuffsGauche.length > 0 && (
            <div style={{ display: 'flex', gap: 3, fontSize: 12 }}>
              {debuffsGauche.map((d) => <span key={d.id}>{d.emoji}</span>)}
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, width: '42%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
          <div style={{ font: '900 12px Rubik,Arial', color: '#fff', textShadow: '1px 1px 2px #000', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
            {buffDroite && <span title="Buff Attack">💪</span>}
            {resistanceDroite > 0 && <span title="Résistance">🛡️</span>}
            <span style={{ font: '900 9px Rubik,Arial', padding: '2px 6px', borderRadius: 10, background: classeCouleurs[droite.classe] ?? '#888', color: '#fff' }}>{droite.classe}</span>
            {droite.nom}
          </div>
          <div style={{
            position: 'relative', width: '100%', height: 12, border: '2.5px solid #14100c', borderRadius: 20,
            background: '#fff', overflow: 'hidden', animation: pvDroiteAff < 25 ? 'hpCritique 0.6s ease-in-out infinite' : undefined,
          }}
          >
            <div style={{ position: 'absolute', inset: 0, width: `${pvDroiteAff}%`, marginLeft: 'auto', background: '#ffb03d', transition: 'width 0.8s ease-out 0.15s' }} />
            <div style={{ position: 'relative', height: '100%', width: `${pvDroiteAff}%`, marginLeft: 'auto', background: '#e8412b', transition: 'width .15s ease-out' }} />
          </div>
          {debuffsDroite.length > 0 && (
            <div style={{ display: 'flex', gap: 3, fontSize: 12 }}>
              {debuffsDroite.map((d) => <span key={d.id}>{d.emoji}</span>)}
            </div>
          )}
        </div>

        {!pret && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'rgba(0,0,0,.5)' }}>
            Chargement du combat…
          </div>
        )}

        {fini && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,12,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
            {/* Le panneau claque avec le même punch que le VS : les deux bouts du combat se
                répondent, au lieu d'un overlay qui se pose mollement. */}
            <div style={{
              font: '400 34px/1 Bangers,Rubik', color: 'var(--or)', textShadow: '3px 3px 0 #000',
              textAlign: 'center', animation: 'finClaque .45s cubic-bezier(.2,.8,.3,1.4) both',
            }}
            >
              {resultat.vainqueur === 'a' ? gauche.nom : droite.nom} GAGNE
            </div>
            <div style={{ font: '800 15px Rubik,Arial', color: combat.gains.berrys >= 20 ? '#5fbf4d' : '#e9d9b0', animation: 'fadeMonte .35s ease-out .35s both' }}>
              +{combat.gains.berrys} <Berry size={14} /> ({combat.gains.berrys_total} total) · {combat.gains.energie_restante} combats restants
            </div>

            {/* §8 point 7 : la prime ne monte qu'en battant un VRAI joueur — d'où le bandeau
                affiché seulement si elle a bougé. Le taire quand elle vaut 0 évite la question
                « pourquoi je n'ai rien gagné ? » après une victoire contre un bot, à laquelle
                on ne peut pas répondre sans avouer que l'adversaire en était un. */}
            {combat.gains.prime > 0 && (
              <div style={{
                font: '800 12px Rubik,Arial', color: '#8a2f1f', background: '#e9d9b0',
                border: '2px solid #8a2f1f', borderRadius: 4, padding: '5px 12px',
                animation: 'fadeMonte .35s ease-out .45s both',
              }}
              >
                PRIME +{combat.gains.prime.toLocaleString('fr-FR')} ({combat.gains.prime_totale.toLocaleString('fr-FR')} total)
              </div>
            )}

            {/* §3 : la progression du perso. C'est ce qui manquait — les combats ne faisaient
                monter aucun niveau, alors que le niveau est le levier n°1 de l'équilibrage. */}
            <div style={{ width: '100%', maxWidth: 260, animation: 'fadeMonte .35s ease-out .5s both' }}>
              {/* Le nom du perso est explicite : c'est SON niveau qui monte, pas celui du compte
                  (players.niveau_compte existe en base mais n'a pas d'usage défini, §3). */}
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 10px Rubik,Arial', color: '#e9d9b0', marginBottom: 4 }}>
                <span>{gauche.nom.toUpperCase()} — NIVEAU {combat.gains.xp.niveau_apres}</span>
                <span>+{combat.gains.xp.xp_gagnee} XP</span>
              </div>
              <div style={{ height: 10, borderRadius: 20, border: '2px solid #14100c', background: '#2b2620', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.round(combat.gains.xp.progression_pct * 100)}%`,
                  background: 'linear-gradient(90deg,#ffb03d,#ffc53d)', transition: 'width .9s ease-out .6s',
                }}
                />
              </div>
              <div style={{ font: '700 9px Rubik,Arial', color: 'rgba(233,217,176,.7)', marginTop: 4, textAlign: 'center' }}>
                {combat.gains.xp.xp_avant_prochain_niveau === null
                  ? 'Niveau maximum atteint'
                  : `encore ${combat.gains.xp.xp_avant_prochain_niveau} XP avant le niveau ${combat.gains.xp.niveau_apres + 1}`}
              </div>
            </div>

            {combat.gains.xp.niveau_gagne && (
              <div style={{
                font: '400 20px Bangers,Rubik', letterSpacing: 1, color: '#5fbf4d',
                textShadow: '2px 2px 0 #000', animation: 'finClaque .5s cubic-bezier(.2,.8,.3,1.4) .75s both',
              }}
              >
                ⬆ NIVEAU {combat.gains.xp.niveau_apres} ATTEINT !
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onRetour}
                style={{ font: '400 16px Bangers,Rubik', letterSpacing: 1, background: 'transparent', color: '#fff', border: '3px solid #fff', borderRadius: 12, padding: '12px 20px' }}
              >
                RETOUR
              </button>
              <button
                onClick={onRejouer}
                disabled={combat.gains.energie_restante <= 0}
                style={{ font: '400 16px Bangers,Rubik', letterSpacing: 1, background: 'var(--rose)', color: '#fff', border: '3px solid #000', borderRadius: 12, padding: '12px 20px', boxShadow: '0 4px 0 #000' }}
              >
                REJOUER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
