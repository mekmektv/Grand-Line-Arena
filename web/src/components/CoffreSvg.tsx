// GRAND LINE ARENA — le coffre en SVG, partage par le roll perso et le coffre d'equipement.
//
// Sorti de Tirage.tsx le 21/07/2026 : les deux ecrans en ont besoin, et faire importer
// components/Equipement.tsx depuis screens/Tirage.tsx aurait cree un import circulaire
// (Tirage importe deja CoffreEquipement).

export function CoffreSvg({ agite, ouvre, vitesse = 1 }: { agite: boolean; ouvre?: boolean; vitesse?: number }) {
  return (
    <svg width="188" viewBox="0 0 150 130" style={{ animation: agite ? `chestShakeHard ${0.5 * vitesse}s ease-in-out infinite` : undefined, overflow: 'visible' }}>
      <rect x="18" y="54" width="114" height="64" rx="7" fill="#6e4520" stroke="#1a1208" strokeWidth="5" />
      <path d="M52 57 V115 M75 57 V115 M98 57 V115" stroke="rgba(0,0,0,.25)" strokeWidth="3" />
      <rect x="18" y="106" width="114" height="12" rx="5" fill="#b07f24" stroke="#1a1208" strokeWidth="3.5" />
      <rect x="27" y="52" width="13" height="66" rx="3" fill="#d9a032" stroke="#1a1208" strokeWidth="3.5" />
      <rect x="110" y="52" width="13" height="66" rx="3" fill="#d9a032" stroke="#1a1208" strokeWidth="3.5" />
      <circle cx="33.5" cy="62" r="2" fill="#1a1208" /><circle cx="116.5" cy="62" r="2" fill="#1a1208" />
      <g className={ouvre ? 'chest-lid lid-ouvre' : (agite ? 'chest-lid lid-wiggle' : 'chest-lid')}>
        <path d="M18 54 V42 Q18 12 75 12 Q132 12 132 42 V54 Z" fill="#8a5a28" stroke="#1a1208" strokeWidth="5" />
        <path d="M44 15.5 Q40.5 32 40.5 52 M75 12 V52 M106 15.5 Q109.5 32 109.5 52" stroke="rgba(0,0,0,.22)" strokeWidth="3" fill="none" />
        <rect x="18" y="44" width="114" height="11" rx="4" fill="#d9a032" stroke="#1a1208" strokeWidth="3.5" />
        <path d="M60 20 Q68 16.5 78 17.5" stroke="rgba(255,255,255,.35)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </g>
      {!ouvre && (
        <>
          <rect x="61" y="45" width="28" height="33" rx="5" fill="#ffc53d" stroke="#1a1208" strokeWidth="4" />
          <circle cx="75" cy="57" r="4.2" fill="#1a1208" />
          <rect x="72.8" y="58" width="4.4" height="11" rx="2.2" fill="#1a1208" />
        </>
      )}
    </svg>
  );
}

