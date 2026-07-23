// ═══════════════════════════════════════════════════════════════════════════
// GRAND LINE ARENA — sons du combat.
//
// Les EFFETS (coups, crit, spécial…) passent par la Web Audio API et pas par un
// simple <audio> : sur mobile, chaque `<audio>.play()` a un temps de démarrage
// perceptible (le pipeline audio du navigateur doit s'initialiser à chaque
// appel), invisible sur PC mais assez pour désynchroniser le son du coup à
// l'écran sur téléphone (retour utilisateur du 23/07). Des buffers décodés à
// l'avance, joués via AudioBufferSourceNode, démarrent quasi instantanément —
// c'est la technique standard pour du son de jeu synchronisé sur le web.
//
// La MUSIQUE de fond reste un <audio> classique : long fichier en streaming/
// boucle, pas un effet synchronisé à une frame précise, la latence de
// démarrage n'y change rien.
// ═══════════════════════════════════════════════════════════════════════════

export type NomEffet =
  | 'coup_normal' | 'coup_epee' | 'coup_projectile' | 'esquive' | 'critique'
  | 'victoire' | 'defaite' | 'special' | 'transformation' | 'clash';

const URL_EFFET: Record<NomEffet, string> = {
  coup_normal: '/sons/coup_normal.mp3',
  coup_epee: '/sons/coup_epee.mp3',
  coup_projectile: '/sons/coup_projectile.mp3',
  esquive: '/sons/esquive.mp3',
  critique: '/sons/critique.wav',
  victoire: '/sons/victoire.mp3',
  defaite: '/sons/defaite.mp3',
  special: '/sons/special.wav',
  transformation: '/sons/transformation.wav',
  clash: '/sons/clash.mp3',
};

// Volume maître + volumes relatifs par son, pour uniformiser des fichiers qui
// n'ont pas été enregistrés au même niveau. À réajuster à l'oreille si besoin.
// Retour utilisateur du 23/07 : musique -30%, reste des sons -15%.
// Retour utilisateur du 23/07 (2) : tous les effets (pas la musique) +10%.
const VOLUME_MAITRE = 0.55;
const VOLUME_RELATIF: Record<NomEffet, number> = {
  coup_normal: 0.8 * 0.85 * 1.1, coup_epee: 0.8 * 0.85 * 1.1, coup_projectile: 0.8 * 0.85 * 1.1, esquive: 0.7 * 0.85 * 1.1,
  critique: 1 * 0.85 * 1.1, victoire: 0.9 * 0.85 * 1.1, defaite: 0.9 * 0.85 * 1.1, special: 0.85 * 0.85 * 1.1, transformation: 0.9 * 0.85 * 1.1,
  clash: 1 * 0.85 * 1.1,
};
const VOLUME_MUSIQUE = VOLUME_MAITRE * 0.5 * 0.7;

const DEBUT_MUSIQUE = 20; // secondes — intro à sauter, y compris à chaque relance de la boucle.

function seekEtJouer(a: HTMLAudioElement, temps: number) {
  const aller = () => { a.currentTime = temps; a.play().catch(() => {}); };
  // currentTime est ignoré tant que les métadonnées ne sont pas chargées.
  if (a.readyState >= 1) aller(); else a.addEventListener('loadedmetadata', aller, { once: true });
}

const CLE_MUTE = 'gla_sons_muets';
let muet = localStorage.getItem(CLE_MUTE) === '1';
const abonnes = new Set<(muet: boolean) => void>();

export function sonsMuets() { return muet; }

/** Bascule le mute. Les sons continuent de se déclencher, juste à volume 0 —
 *  pas de pause/reprise à gérer, donc pas de désynchro possible avec l'animation. */
export function basculerSons(): boolean {
  muet = !muet;
  localStorage.setItem(CLE_MUTE, muet ? '1' : '0');
  if (musiqueEl) musiqueEl.muted = muet;
  abonnes.forEach((f) => f(muet));
  return muet;
}

export function ecouterSons(f: (muet: boolean) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

// ── Effets : Web Audio, buffers pré-décodés ─────────────────────────────────

const CtorContexteAudio = window.AudioContext
  ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
const contexte = CtorContexteAudio ? new CtorContexteAudio() : null;

const buffers: Partial<Record<NomEffet, AudioBuffer>> = {};

// Décodage lancé au chargement du module, sans attendre de geste utilisateur —
// decodeAudioData() ne le demande pas, seule la LECTURE en aura besoin (voir
// debloquerSons). Un fichier manquant/invalide laisse ce son silencieux sans
// bloquer les autres, comme le faisait `<audio>.play().catch()` avant.
if (contexte) {
  (Object.keys(URL_EFFET) as NomEffet[]).forEach((nom) => {
    fetch(URL_EFFET[nom])
      .then((r) => r.arrayBuffer())
      .then((brut) => contexte.decodeAudioData(brut))
      .then((decode) => { buffers[nom] = decode; })
      .catch(() => {});
  });
}

/**
 * Un AudioContext démarre SUSPENDU tant qu'aucun geste utilisateur ne l'a
 * débloqué (tous navigateurs, mobile comme desktop). À appeler de façon
 * SYNCHRONE (avant le premier `await`) dans le gestionnaire de clic sur
 * COMBATTRE, pour rester dans la fenêtre de tolérance du navigateur.
 */
export function debloquerSons() {
  if (contexte && contexte.state === 'suspended') contexte.resume().catch(() => {});
}

export function jouerEffet(nom: NomEffet) {
  if (!contexte) return;
  const buffer = buffers[nom];
  // Pas encore décodé (ou fichier manquant) : le clash ne doit jamais bloquer
  // la musique qui l'attend (voir jouerOuverture) ; les autres effets restent
  // silencieux, sans conséquence sur la suite du combat.
  if (!buffer) { if (nom === 'clash') demarrerMusique(); return; }
  const source = contexte.createBufferSource();
  source.buffer = buffer;
  const gain = contexte.createGain();
  gain.gain.value = muet ? 0 : VOLUME_MAITRE * VOLUME_RELATIF[nom];
  source.connect(gain).connect(contexte.destination);
  source.start(0);
  if (nom === 'clash') source.onended = () => demarrerMusique();
}

/** Joue le clash d'ouverture (écran VS), puis enchaîne sur la musique de combat
 *  dès que le clash se termine (voir jouerEffet). Si le buffer n'est pas encore
 *  décodé ou que la Web Audio API est indisponible, la musique démarre quand
 *  même (sinon un clash absent bloquerait toute la musique du combat). */
export function jouerOuverture() {
  if (!contexte) { demarrerMusique(); return; }
  jouerEffet('clash');
}

let musiqueEl: HTMLAudioElement | null = null;

export function demarrerMusique() {
  if (musiqueEl) return;
  const a = new Audio('/sons/musique_combat.mp3');
  a.volume = VOLUME_MUSIQUE;
  a.muted = muet;
  // Pas de `loop` natif : on veut sauter l'intro (0-20s) à CHAQUE reprise de la
  // boucle, pas seulement au premier lancement.
  a.addEventListener('ended', () => seekEtJouer(a, DEBUT_MUSIQUE));
  seekEtJouer(a, DEBUT_MUSIQUE);
  musiqueEl = a;
}

export function arreterMusique() {
  if (!musiqueEl) return;
  musiqueEl.pause();
  musiqueEl = null;
}
