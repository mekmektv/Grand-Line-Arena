import { useState } from 'react';

// Le vrai symbole des Berrys, à la place de l'emoji 💰 utilisé jusqu'ici.
//
// Un composant plutôt qu'une balise <img> recopiée : la monnaie apparaît dans 5 écrans, et
// le jour où le fichier ou son alignement changent, il n'y a qu'un endroit à toucher.
//
// L'alignement vertical est le seul point délicat : le logo est posé à côté de texte, et un
// <img> se cale par défaut sur la ligne de base, ce qui le fait "flotter" trop haut. D'où le
// verticalAlign négatif, calé en em pour suivre la taille du texte voisin.

/** Où vit le fichier, dans web/public/. */
const SRC = '/berry.png';

export function Berry({ size = 13, style }: { size?: number; style?: React.CSSProperties }) {
  // Repli sur l'ancien emoji si le fichier est absent : ça évite l'icône d'image cassée, et
  // ça garde l'app lisible tant que l'asset n'a pas été déposé.
  const [manquant, setManquant] = useState(false);

  if (manquant) return <span style={{ fontSize: size, lineHeight: 1, ...style }}>💰</span>;

  return (
    <img
      src={SRC}
      alt="Berrys"
      onError={() => setManquant(true)}
      style={{
        height: size, width: 'auto', verticalAlign: '-0.14em',
        display: 'inline-block', flex: 'none', ...style,
      }}
    />
  );
}
