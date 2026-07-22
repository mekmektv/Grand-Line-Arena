export type Onglet = 'accueil' | 'collection' | 'tirage' | 'classement';

// Repris à l'identique du prototype validé (navDefs, icônes trait + libellés).
const ONGLETS: { id: Onglet; iconPath: string; label: string }[] = [
  { id: 'accueil', iconPath: 'M3 11.5 L12 3.8 L21 11.5 M5.5 9.8 V20.2 H9.8 V14.5 H14.2 V20.2 H18.5 V9.8', label: 'PONT' },
  { id: 'collection', iconPath: 'M4 4 H10.4 V10.4 H4 Z M13.6 4 H20 V10.4 H13.6 Z M4 13.6 H10.4 V20 H4 Z M13.6 13.6 H20 V20 H13.6 Z', label: 'COLLECTION' },
  { id: 'tirage', iconPath: 'M4.5 10 Q4.5 5 12 5 Q19.5 5 19.5 10 V19.5 H4.5 Z M4.5 11.5 H19.5 M10.4 11.5 H13.6 V15.5 H10.4 Z', label: 'COFFRES' },
  { id: 'classement', iconPath: 'M8 4 H16 V10 Q16 13.8 12 13.8 Q8 13.8 8 10 Z M8 5.8 H4.8 V7.8 Q4.8 10.4 8 10.9 M16 5.8 H19.2 V7.8 Q19.2 10.4 16 10.9 M12 13.8 V16.8 M9.4 19.8 H14.6 M10 16.8 H14 V19.8 H10 Z', label: 'CLASSEMENT' },
];

// §8 : barre en bas, 4 onglets max. Le combat n'en fait PAS partie (plein écran depuis l'Accueil).
export function BottomNav({ actif, onChange }: { actif: Onglet; onChange: (o: Onglet) => void }) {
  return (
    <div id="main-nav" style={{ display: 'flex', background: '#14303c', borderTop: '3px solid #000', flex: 'none' }}>
      {ONGLETS.map((o) => {
        const estActif = actif === o.id;
        const couleur = estActif ? 'var(--or)' : 'rgba(239,231,214,.55)';
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              flex: 1, minWidth: 0, background: 'none', padding: '7px 2px 7px', display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: 3,
            }}
          >
            <span style={{ width: 18, height: 3, borderRadius: 2, background: couleur, opacity: estActif ? 1 : 0 }} />
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={o.iconPath} />
            </svg>
            <span style={{ font: '800 10px/1 Rubik,Arial', letterSpacing: 0.2, color: couleur, textAlign: 'center' }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
