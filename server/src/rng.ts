// ONE PIECE ARENA — le hasard du combat.
//
// Pourquoi ne pas utiliser Math.random() : le combat doit être DÉTERMINISTE côté serveur (§6).
// Avec un seed, le même combat rejoué donne exactement le même résultat, coup pour coup.
// C'est ce qui permet de stocker un combat dans `fights` et de pouvoir le reconstituer,
// et c'est aussi ce qui rend les tests d'équilibrage reproductibles.
//
// Algo : mulberry32. Petit, rapide, sans dépendance, et suffisamment uniforme pour du gameplay.
// (Ce n'est PAS un générateur cryptographique — on ne s'en sert que pour des dés, jamais pour
// des secrets.)

/** Rend une fonction qui produit des nombres entre 0 (inclus) et 1 (exclu). */
export function creerRng(seed: number): () => number {
  let a = seed >>> 0;
  return function alea(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un seed au hasard, quand l'appelant n'en impose pas un. */
export function seedAleatoire(): number {
  return (Math.random() * 0x100000000) >>> 0;
}
