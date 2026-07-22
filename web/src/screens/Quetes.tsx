import { useState } from 'react';
import type { EtatQuetes, QueteAffichee } from '../api';
import { Berry } from '../components/Berry';

// §8 : l'écran des quêtes. Plein écran, ouvert depuis l'encart de l'Accueil (la barre du bas est
// plafonnée à 4 onglets, donc pas de 5e onglet). Le front n'affiche que ce que le serveur a
// calculé (progression, accomplie, réclamable) — il ne décide d'aucune récompense.

function BarreProgression({ q }: { q: QueteAffichee }) {
  const pct = q.objectif > 0 ? Math.min(100, Math.round((q.progression / q.objectif) * 100)) : 0;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 8, borderRadius: 6, background: 'rgba(0,0,0,.35)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: q.accomplie ? 'var(--rarete-peu-commun)' : 'var(--or)',
          transition: 'width .3s',
        }}
        />
      </div>
      <div style={{ marginTop: 4, font: '700 10px Rubik,Arial', color: 'rgba(239,231,214,.6)' }}>
        {q.progression} / {q.objectif}
      </div>
    </div>
  );
}

function QueteCarte({ q, onReclamer, enCours }: {
  q: QueteAffichee; onReclamer: (cle: string) => void; enCours: boolean;
}) {
  return (
    <div style={{
      background: '#14303c', border: '2px solid #000', borderRadius: 10, padding: 12, marginBottom: 10,
      opacity: q.reclamee ? 0.62 : 1,
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ font: '800 13px Rubik,Arial', color: 'var(--texte)' }}>{q.titre}</div>
        <div style={{ flex: 'none', font: '800 12px Rubik,Arial', color: 'var(--or)', whiteSpace: 'nowrap' }}>
          <Berry size={12} /> {q.recompense}
        </div>
      </div>

      <BarreProgression q={q} />

      {/* Zone d'action : réclamer / déjà réclamée / en cours */}
      {q.reclamee ? (
        <div style={{ marginTop: 8, font: '800 11px Rubik,Arial', color: 'var(--rarete-peu-commun)' }}>
          ✓ Récompense réclamée
        </div>
      ) : q.reclamable ? (
        <button
          onClick={() => onReclamer(q.cle)}
          disabled={enCours}
          style={{
            marginTop: 10, width: '100%', font: '400 15px Bangers,Rubik', letterSpacing: 1,
            transform: 'skew(-5deg)', background: 'var(--rose)', color: '#fff', border: '3px solid #000',
            borderRadius: 10, padding: '9px 0', boxShadow: '0 4px 0 #000', opacity: enCours ? 0.6 : 1,
          }}
        >
          {enCours ? '…' : `RÉCLAMER +${q.recompense}`}
        </button>
      ) : null}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ font: '800 11px Rubik,Arial', letterSpacing: 0.5, color: 'rgba(239,231,214,.55)', marginBottom: 8 }}>
        {titre}
      </div>
      {children}
    </div>
  );
}

export function Quetes({ quetes, onRetour, onReclamer }: {
  quetes: EtatQuetes;
  onRetour: () => void;
  onReclamer: (cle: string) => Promise<void>;
}) {
  const [enCours, setEnCours] = useState<string | null>(null);

  const reclamer = async (cle: string) => {
    setEnCours(cle);
    try { await onReclamer(cle); } finally { setEnCours(null); }
  };

  // Les succès de collection déjà réclamés descendent en bas : le joueur voit d'abord ce qu'il
  // lui reste à débloquer.
  const collectionTriee = [...quetes.collection].sort((a, b) => Number(a.reclamee) - Number(b.reclamee));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--fond)' }}>
      {/* En-tête */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        background: '#14303c', borderBottom: '3px solid #000', flex: 'none',
      }}
      >
        <button
          onClick={onRetour}
          style={{ background: 'none', font: '900 20px Rubik,Arial', color: 'var(--texte)', flex: 'none', lineHeight: 1 }}
          aria-label="Retour"
        >
          ‹
        </button>
        <div style={{ font: '400 22px Bangers,Rubik', letterSpacing: 1, color: 'var(--texte)', transform: 'skew(-6deg)' }}>
          QUÊTES
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px 16px 24px', overflowY: 'auto' }}>
        <Section titre="QUÊTE DU JOUR">
          {quetes.jour
            ? <QueteCarte q={quetes.jour} onReclamer={reclamer} enCours={enCours === quetes.jour.cle} />
            : <div style={{ font: '700 12px Rubik,Arial', color: 'rgba(239,231,214,.5)' }}>Aucune quête aujourd'hui.</div>}
        </Section>

        <Section titre="QUÊTE DE LA SEMAINE">
          {quetes.semaine
            ? <QueteCarte q={quetes.semaine} onReclamer={reclamer} enCours={enCours === quetes.semaine.cle} />
            : <div style={{ font: '700 12px Rubik,Arial', color: 'rgba(239,231,214,.5)' }}>Aucune quête cette semaine.</div>}
        </Section>

        <Section titre="COLLECTION">
          {collectionTriee.length > 0
            ? collectionTriee.map((q) => (
              <QueteCarte key={q.cle} q={q} onReclamer={reclamer} enCours={enCours === q.cle} />
            ))
            : <div style={{ font: '700 12px Rubik,Arial', color: 'rgba(239,231,214,.5)' }}>Aucun succès de collection.</div>}
        </Section>
      </div>
    </div>
  );
}
