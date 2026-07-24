import type { Classement as ClassementData } from '../api';
import { Berry } from '../components/Berry';

// §8 point 7 : top viewers + ta position mise en avant même si 47e.
// Classé par PRIME depuis le 22/07/2026 : elle ne monte qu'en battant de VRAIS joueurs, et ne
// redescend jamais (voir server/src/prime.ts). La fiche joueur détaillée (palmarès, derniers
// combats) reste à faire.

/** L'avis de recherche porte une photo. Repli sur l'initiale du pseudo plutôt qu'un carré
 *  vide : les comptes de dev n'ont pas d'avatar, et un joueur Twitch peut ne jamais en avoir
 *  mis. Carré et non rond, pour rester dans le style "affiche WANTED" de l'écran. */
function PortraitJoueur({ url, pseudo }: { url: string | null; pseudo: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 3, background: '#123540', border: '1px solid #1a1208',
      flex: 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '900 15px Rubik,Arial', color: 'rgba(255,255,255,.6)',
    }}
    >
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : pseudo.charAt(0).toUpperCase()}
    </div>
  );
}

export function Classement({ classement, onOuvrirFiche }: { classement: ClassementData; onOuvrirFiche: (id: string) => void }) {
  return (
    <div style={{
      minHeight: '100%', backgroundColor: '#c9a267',
      backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,.1) 0 3px, transparent 3px 56px),'
        + 'repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 40px)',
      display: 'flex', flexDirection: 'column',
    }}
    >
      <div style={{ padding: '22px 18px 6px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', background: '#5c3a1a', border: '3px solid #1a1208', borderRadius: 6,
          padding: '9px 26px 10px', boxShadow: '0 5px 0 rgba(0,0,0,.35)', marginTop: 8,
        }}
        >
          <div style={{ font: '400 20px/1 Bangers,Rubik', letterSpacing: 2, color: 'var(--or)', textShadow: '2px 2px 0 #1a1208' }}>TABLEAU DES PRIMES</div>
        </div>
        <div style={{ font: '700 11px Rubik,Arial', color: '#5c3a1a', maxWidth: 280, margin: '8px auto 0' }}>
          Ta prime monte à chaque victoire et ne redescend jamais.
        </div>
      </div>

      <div style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {classement.top.map((row) => (
          <div
            key={row.rang}
            onClick={() => onOuvrirFiche(row.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: '#e9d9b0', border: `2px solid ${row.moi ? '#8a2f1f' : '#1a1208'}`,
              borderRadius: 4, padding: '10px 12px', position: 'relative', boxShadow: '2px 3px 0 rgba(0,0,0,.25)',
            }}
          >
            {row.rang <= 3 && (
              <div style={{ position: 'absolute', top: -7, left: 8, background: '#8a2f1f', color: 'var(--or)', font: '800 8px Rubik,Arial', letterSpacing: 1, padding: '1px 6px', borderRadius: 2, border: '1px solid #1a1208' }}>
                WANTED
              </div>
            )}
            {/* §8bis : les voisins de classement du joueur, à défier. Coin opposé au WANTED. */}
            {row.rival && (
              <div style={{ position: 'absolute', top: -7, right: 8, background: '#1a1208', color: 'var(--or)', font: '800 8px Rubik,Arial', letterSpacing: 1, padding: '1px 6px', borderRadius: 2, border: '1px solid #8a2f1f' }}>
                ⚔️ RIVAL
              </div>
            )}
            <div style={{ width: 26, font: '900 14px Rubik,Arial', color: row.rang === 1 ? '#8a2f1f' : '#1a1208' }}>#{row.rang}</div>
            <PortraitJoueur url={row.avatar_url} pseudo={row.pseudo} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '900 12px Rubik,Arial', color: '#1a1208', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.moi ? `Toi — ${row.pseudo}` : row.pseudo}
              </div>
              <div style={{ font: '900 12px Rubik,Arial', color: '#8a2f1f', fontStyle: 'italic' }}><Berry size={12} />{row.prime.toLocaleString('fr-FR')}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(180deg,transparent,#c9a267 40%)', padding: '12px 16px 16px' }}>
        <div
          onClick={() => onOuvrirFiche(classement.moi.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#e9d9b0', border: '3px solid #8a2f1f', borderRadius: 4, padding: '10px 12px', position: 'relative', boxShadow: '3px 4px 0 rgba(0,0,0,.3)' }}
        >
          <div style={{ position: 'absolute', top: -8, left: 8, background: '#8a2f1f', color: '#fff', font: '800 8px Rubik,Arial', letterSpacing: 1, padding: '1px 7px', borderRadius: 2, border: '1px solid #1a1208' }}>
            TA PRIME
          </div>
          <div style={{ width: 26, font: '900 14px Rubik,Arial', color: '#8a2f1f' }}>#{classement.moi.rang}</div>
          <PortraitJoueur url={classement.moi.avatar_url} pseudo={classement.moi.pseudo} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '900 12px Rubik,Arial', color: '#1a1208' }}>Toi — {classement.moi.pseudo}</div>
            <div style={{ font: '900 12px Rubik,Arial', color: '#8a2f1f', fontStyle: 'italic' }}><Berry size={12} />{classement.moi.prime.toLocaleString('fr-FR')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
