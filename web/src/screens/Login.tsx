import { urlLoginTwitch } from '../api';

const IconeTwitch = ({ taille = 22 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" style={{ flex: 'none' }}>
    <path
      fill="#fff"
      d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"
    />
  </svg>
);

// §8 GAME_DESIGN.md point 1 : "un seul bouton Se connecter avec Twitch". Reprend fidèlement
// le visuel du prototype validé (dégradé océan, soleil, titre Bangers).
export function Login() {
  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
      background: 'linear-gradient(180deg,#4fb8d9 0%,#2e93c2 38%,#1c6f9c 62%,#0f2733 100%)',
    }}
    >
      <div style={{
        position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: '50%',
        background: 'var(--or)', boxShadow: '0 0 50px 14px rgba(255,197,61,.45)',
      }}
      />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 22, padding: 32, textAlign: 'center', position: 'relative',
      }}
      >
        <div className="titre-shonen" style={{ font: "400 40px/1 Bangers,Rubik", transform: 'skew(-8deg)', color: '#fff', textShadow: '3px 3px 0 #12324a' }}>
          GRAND LINE ARENA
        </div>
        <div style={{ font: "600 13px/1.5 Rubik,Arial", color: 'var(--texte)', opacity: 0.9 }}>
          Incarne un pirate, prends la mer,<br />crée ton équipage et fais gonfler ta prime.
        </div>
        <div style={{
          width: 104, height: 104, borderRadius: '50%', border: '4px dashed rgba(255,255,255,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.75)',
          font: "700 10px 'Courier New',monospace",
        }}
        >
          LOGO
        </div>
        <a
          href={urlLoginTwitch()}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, font: "400 17px Bangers,Rubik",
            letterSpacing: 1, transform: 'skew(-6deg)', background: '#9146ff', color: '#fff',
            border: '3px solid #000', borderRadius: 12, padding: '14px 22px', boxShadow: '0 6px 0 #000',
            textDecoration: 'none',
          }}
        >
          <IconeTwitch />
          <span style={{ transform: 'skew(6deg)', display: 'inline-block' }}>SE CONNECTER AVEC TWITCH</span>
        </a>
      </div>
    </div>
  );
}
