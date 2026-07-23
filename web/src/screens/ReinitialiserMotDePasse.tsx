import { useState } from 'react';
import { reinitialiserMotDePasse } from '../api';

// Affiché quand l'app détecte #access_token=...&type=recovery dans l'URL (lien reçu par
// email depuis Supabase Auth) — voir App.tsx. Reconnecte directement après succès : redemander
// le mot de passe qu'on vient de choisir serait un aller-retour inutile.
export function ReinitialiserMotDePasse({ accessToken }: { accessToken: string }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    if (motDePasse.length < 6) { setErreur('Le mot de passe doit faire au moins 6 caractères.'); return; }
    setEnCours(true);
    setErreur('');
    const resultat = await reinitialiserMotDePasse(accessToken, motDePasse);
    if (resultat.ok) {
      window.location.href = '/';
    } else {
      setErreur(resultat.erreur);
      setEnCours(false);
    }
  };

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center',
      background: 'linear-gradient(180deg,#4fb8d9 0%,#2e93c2 38%,#1c6f9c 62%,#0f2733 100%)',
    }}
    >
      <div className="titre-shonen" style={{ font: "400 26px/1.1 Bangers,Rubik", color: '#fff', textShadow: '2px 2px 0 #12324a' }}>
        NOUVEAU MOT DE PASSE
      </div>
      <div style={{
        padding: 14, border: '1px dashed rgba(255,255,255,.4)', borderRadius: 10,
        display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 260,
      }}
      >
        <input
          value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} type="password"
          placeholder="Nouveau mot de passe" autoFocus
          style={{ padding: 10, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.25)', color: '#fff', font: '600 13px Rubik,Arial' }}
          onKeyDown={(e) => { if (e.key === 'Enter') valider(); }}
        />
        {erreur && <span style={{ fontSize: 11, color: '#ffb4b4' }}>{erreur}</span>}
        <button
          onClick={valider}
          disabled={enCours}
          style={{ textAlign: 'center', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--cyan)', color: '#0a2126', fontWeight: 700 }}
        >
          Valider
        </button>
      </div>
    </div>
  );
}
