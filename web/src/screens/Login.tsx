import { useState, type CSSProperties } from 'react';
import { urlLoginTwitch, inscriptionLocale, connexionLocale } from '../api';

const IconeTwitch = ({ taille = 22 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" style={{ flex: 'none' }}>
    <path
      fill="#fff"
      d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"
    />
  </svg>
);

const inputStyle: CSSProperties = {
  padding: 10, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.25)', color: '#fff',
  font: '600 13px Rubik,Arial',
};

// §8 GAME_DESIGN.md point 1 : le bouton Twitch reste LE choix mis en avant (bonus de présence
// live + tirages premium réservés à ce chemin). Le pseudo + mot de passe (23/07/2026) est une
// porte de secours pour un viewer sans Twitch — jamais mélangé au bouton principal, et Twitch
// reste associable après coup (voir le bandeau "Associer mon Twitch" sur l'accueil).
export function Login() {
  const [modeLocal, setModeLocal] = useState<'inscription' | 'connexion' | null>(null);
  const [pseudo, setPseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    if (!pseudo.trim() || !motDePasse) { setErreur('Pseudo et mot de passe requis.'); return; }
    setEnCours(true);
    setErreur('');
    const resultat = modeLocal === 'inscription'
      ? await inscriptionLocale(pseudo, motDePasse)
      : await connexionLocale(pseudo, motDePasse);
    if (resultat.ok) {
      // Rechargement complet : App.tsx relit /etat au montage, pas besoin de dupliquer cette
      // logique ici — exactement ce qui se passe déjà au retour du login Twitch.
      window.location.reload();
    } else {
      setErreur(resultat.erreur);
      setEnCours(false);
    }
  };

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
        justifyContent: 'center', gap: 18, padding: 32, textAlign: 'center', position: 'relative',
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
        <div style={{ font: '600 10px Rubik,Arial', color: 'rgba(255,255,255,.75)', maxWidth: 260 }}>
          Avec Twitch : Berrys de présence en live + tirages premium aux points de chaîne.
        </div>

        {modeLocal === null ? (
          <button
            onClick={() => setModeLocal('connexion')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.8)', font: '700 11px Rubik,Arial', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Pas envie de connecter Twitch tout de suite ? Jouer avec un pseudo
          </button>
        ) : (
          <div style={{
            marginTop: 4, padding: 14, border: '1px dashed rgba(255,255,255,.4)', borderRadius: 10,
            display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 260,
          }}
          >
            <span style={{ fontSize: 11, color: '#fff', opacity: 0.85 }}>
              {modeLocal === 'inscription' ? 'Nouveau compte (sans Twitch)' : 'Déjà un compte sans Twitch'}
            </span>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo" style={inputStyle} />
            <input
              value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} type="password"
              placeholder="Mot de passe" style={inputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') valider(); }}
            />
            {erreur && <span style={{ fontSize: 11, color: '#ffb4b4' }}>{erreur}</span>}
            <button
              onClick={valider}
              disabled={enCours}
              style={{
                textAlign: 'center', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--cyan)', color: '#0a2126', fontWeight: 700,
              }}
            >
              {modeLocal === 'inscription' ? 'Créer le compte' : 'Se connecter'}
            </button>
            <button
              onClick={() => { setModeLocal(modeLocal === 'inscription' ? 'connexion' : 'inscription'); setErreur(''); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', font: '700 10px Rubik,Arial', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {modeLocal === 'inscription' ? 'J\'ai déjà un compte' : 'Créer un nouveau compte'}
            </button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>
              Tu pourras associer ton Twitch plus tard, depuis l'accueil.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
