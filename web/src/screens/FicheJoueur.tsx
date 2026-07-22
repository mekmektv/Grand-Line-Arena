import type { FicheJoueur as FicheJoueurData } from '../api';
import { Berry } from '../components/Berry';

const COULEUR_CLASSE: Record<string, string> = {
  Haki: 'var(--classe-haki)', Logia: 'var(--classe-logia)', Paramecia: 'var(--classe-paramecia)',
  Zoan: 'var(--classe-zoan)', Sniper: 'var(--classe-sniper)', Sabreur: 'var(--classe-sabreur)',
};
const COULEUR_RARETE: Record<string, string> = {
  Commun: 'var(--rarete-commun)', 'Peu commun': 'var(--rarete-peu-commun)', Rare: 'var(--rarete-rare)',
  Epique: 'var(--rarete-epique)', Legendaire: 'var(--rarete-legendaire)',
};

function Badges({ classe, rarete }: { classe: string; rarete: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ background: COULEUR_CLASSE[classe] ?? '#888', color: '#fff', font: '800 9px Rubik,Arial', padding: '3px 8px', borderRadius: 12 }}>{classe}</span>
      <span style={{ background: COULEUR_RARETE[rarete] ?? '#888', color: '#1a1208', font: '800 9px Rubik,Arial', padding: '3px 8px', borderRadius: 12 }}>{rarete}</span>
    </div>
  );
}

// §8 point 7 : fiche joueur détaillée, ouverte depuis une ligne du classement — palmarès
// (5 derniers combats), perso actuellement joué, perso favori (le plus utilisé, §22/07/2026).
export function FicheJoueur({ fiche, onRetour }: { fiche: FicheJoueurData; onRetour: () => void }) {
  return (
    <div style={{
      minHeight: '100%', backgroundColor: '#c9a267',
      backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,.1) 0 3px, transparent 3px 56px),'
        + 'repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 40px)',
      display: 'flex', flexDirection: 'column',
    }}
    >
      <div style={{ padding: '14px 16px' }}>
        <button onClick={onRetour} style={{ font: '800 13px Rubik,Arial', background: 'rgba(0,0,0,.35)', color: '#fff', border: '2px solid #1a1208', borderRadius: 20, padding: '6px 14px' }}>
          ← Retour
        </button>
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* En-tête : portrait, pseudo, rang, prime */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#e9d9b0', border: '3px solid #1a1208', borderRadius: 8, padding: 14, boxShadow: '2px 3px 0 rgba(0,0,0,.25)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 6, background: '#123540', border: '1px solid #1a1208',
            flex: 'none', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '900 20px Rubik,Arial', color: 'rgba(255,255,255,.6)',
          }}
          >
            {fiche.avatar_url
              ? <img src={fiche.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : fiche.pseudo.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '900 16px Rubik,Arial', color: '#1a1208' }}>{fiche.pseudo}</div>
            <div style={{ font: '800 12px Rubik,Arial', color: '#8a2f1f', fontStyle: 'italic' }}>
              #{fiche.rang} — <Berry size={12} />{fiche.prime.toLocaleString('fr-FR')}
            </div>
          </div>
        </div>

        {/* Perso actuellement joué */}
        <div style={{ background: '#e9d9b0', border: '3px solid #1a1208', borderRadius: 8, padding: 14 }}>
          <div style={{ font: '800 9px Rubik,Arial', color: '#5c4326', letterSpacing: 0.5, marginBottom: 8 }}>PERSO ACTUELLEMENT JOUÉ</div>
          {fiche.perso_actif ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ font: '900 15px Rubik,Arial', color: '#1a1208' }}>{fiche.perso_actif.nom}</div>
                <div style={{ marginTop: 4 }}><Badges classe={fiche.perso_actif.classe} rarete={fiche.perso_actif.rarete} /></div>
              </div>
              <div style={{ font: '800 12px Rubik,Arial', color: 'var(--or)', background: '#1a1208', padding: '4px 10px', borderRadius: 12, border: '2px solid #ffc53d' }}>
                Niveau {fiche.perso_actif.niveau}
              </div>
            </div>
          ) : (
            <div style={{ font: '700 11px Rubik,Arial', color: '#5c4326' }}>Aucun perso actif pour l'instant.</div>
          )}
        </div>

        {/* Perso favori */}
        <div style={{ background: '#e9d9b0', border: '3px solid #1a1208', borderRadius: 8, padding: 14 }}>
          <div style={{ font: '800 9px Rubik,Arial', color: '#5c4326', letterSpacing: 0.5, marginBottom: 8 }}>PERSO FAVORI</div>
          {fiche.perso_favori ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ font: '900 15px Rubik,Arial', color: '#1a1208' }}>{fiche.perso_favori.nom}</div>
                <div style={{ marginTop: 4 }}><Badges classe={fiche.perso_favori.classe} rarete={fiche.perso_favori.rarete} /></div>
              </div>
              <div style={{ font: '800 11px Rubik,Arial', color: '#5c4326', textAlign: 'right' }}>
                {fiche.perso_favori.combats} combat{fiche.perso_favori.combats > 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <div style={{ font: '700 11px Rubik,Arial', color: '#5c4326' }}>Pas encore de combat joué.</div>
          )}
        </div>

        {/* Historique des 5 derniers combats */}
        <div style={{ background: '#e9d9b0', border: '3px solid #1a1208', borderRadius: 8, padding: 14 }}>
          <div style={{ font: '800 9px Rubik,Arial', color: '#5c4326', letterSpacing: 0.5, marginBottom: 8 }}>5 DERNIERS COMBATS</div>
          {fiche.historique.length === 0 ? (
            <div style={{ font: '700 11px Rubik,Arial', color: '#5c4326' }}>Aucun combat joué pour l'instant.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fiche.historique.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: i > 0 ? '1px solid rgba(26,18,8,.15)' : undefined, paddingTop: i > 0 ? 8 : 0 }}>
                  <span style={{
                    flex: 'none', font: '800 9px Rubik,Arial', color: '#fff', padding: '3px 8px', borderRadius: 10,
                    background: h.victoire ? '#3d8a4a' : '#8a2f1f',
                  }}
                  >
                    {h.victoire ? 'VICTOIRE' : 'DÉFAITE'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 11px Rubik,Arial', color: '#1a1208', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      contre {h.adversaire_pseudo}{h.perso_utilise ? ` (${h.perso_utilise})` : ''}
                    </div>
                    <div style={{ font: '600 10px Rubik,Arial', color: '#5c4326' }}>
                      {new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
