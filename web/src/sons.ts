// ═══════════════════════════════════════════════════════════════════════════
// GRAND LINE ARENA — sons du combat. Un seul <audio> par effet, réutilisé sur
// tout le combat (voire d'un combat à l'autre) : créer un nouvel élément à
// chaque coup rechargerait le fichier depuis le réseau à chaque fois.
// ═══════════════════════════════════════════════════════════════════════════

export type NomEffet =
  | 'coup_normal' | 'coup_epee' | 'coup_projectile' | 'esquive' | 'critique'
  | 'victoire' | 'defaite' | 'special' | 'transformation' | 'clash';

const URL_EFFET: Record<NomEffet, string> = {
  coup_normal: '/sons/coup_normal.mp3',
  coup_epee: '/sons/coup_epee.mp3',
  coup_projectile: '/sons/coup_projectile.mp3',
  // Pas encore fourni par l'utilisateur : l'appel ne fait rien de grave en son
  // absence (le navigateur échoue silencieusement au play()).
  esquive: '/sons/esquive.mp3',
  critique: '/sons/critique.wav',
  victoire: '/sons/victoire.mp3',
  defaite: '/sons/defaite.mp3',
  special: '/sons/special.wav',
  transformation: '/sons/transformation.wav',
  clash: '/sons/clash.mp3', // pas encore fourni par l'utilisateur
};

// Volume maître + volumes relatifs par son, pour uniformiser des fichiers qui
// n'ont pas été enregistrés au même niveau. À réajuster à l'oreille si besoin.
// Retour utilisateur du 23/07 : musique -30%, reste des sons -15%.
const VOLUME_MAITRE = 0.55;
const VOLUME_RELATIF: Record<NomEffet, number> = {
  coup_normal: 0.8 * 0.85, coup_epee: 0.8 * 0.85, coup_projectile: 0.8 * 0.85, esquive: 0.7 * 0.85,
  critique: 1 * 0.85, victoire: 0.9 * 0.85, defaite: 0.9 * 0.85, special: 0.85 * 0.85, transformation: 0.9 * 0.85,
  clash: 1 * 0.85,
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

/** Bascule le mute. Les sons continuent de se déclencher, juste muets — pas de
 *  pause/reprise à gérer, donc pas de désynchro possible avec l'animation. */
export function basculerSons(): boolean {
  muet = !muet;
  localStorage.setItem(CLE_MUTE, muet ? '1' : '0');
  if (musiqueEl) musiqueEl.muted = muet;
  Object.values(effets).forEach((a) => { a.muted = muet; });
  abonnes.forEach((f) => f(muet));
  return muet;
}

export function ecouterSons(f: (muet: boolean) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

const effets = {} as Record<NomEffet, HTMLAudioElement>;
function elementEffet(nom: NomEffet): HTMLAudioElement {
  if (!effets[nom]) {
    const a = new Audio(URL_EFFET[nom]);
    a.volume = VOLUME_MAITRE * VOLUME_RELATIF[nom];
    a.muted = muet;
    effets[nom] = a;
  }
  return effets[nom];
}

export function jouerEffet(nom: NomEffet) {
  const a = elementEffet(nom);
  a.muted = muet;
  seekEtJouer(a, 0);
}

/** Joue le clash d'ouverture (écran VS), puis enchaîne sur la musique de combat
 *  dès que le clash se termine — pas de durée à deviner, on écoute juste 'ended'.
 *  Si le fichier manque ou échoue à charger, la musique démarre quand même (sinon
 *  un clash absent bloquerait toute la musique du combat). */
export function jouerOuverture() {
  const a = elementEffet('clash');
  a.muted = muet;
  const surFinOuErreur = () => {
    a.removeEventListener('ended', surFinOuErreur);
    a.removeEventListener('error', surFinOuErreur);
    demarrerMusique();
  };
  a.addEventListener('ended', surFinOuErreur, { once: true });
  a.addEventListener('error', surFinOuErreur, { once: true });
  seekEtJouer(a, 0);
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
