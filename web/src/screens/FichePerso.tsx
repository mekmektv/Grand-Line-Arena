import type { CarteCollection } from '../api';
import { Berry } from '../components/Berry';

const COULEUR_CLASSE: Record<string, string> = {
  Haki: 'var(--classe-haki)', Logia: 'var(--classe-logia)', Paramecia: 'var(--classe-paramecia)',
  Zoan: 'var(--classe-zoan)', Sniper: 'var(--classe-sniper)', Sabreur: 'var(--classe-sabreur)',
};
const COULEUR_RARETE: Record<string, string> = {
  Commun: 'var(--rarete-commun)', 'Peu commun': 'var(--rarete-peu-commun)', Rare: 'var(--rarete-rare)',
  Epique: 'var(--rarete-epique)', Legendaire: 'var(--rarete-legendaire)',
};
// §2 GAME_DESIGN.md : passifs de classe, résumés en 1 ligne (§8).
const PASSIF_CLASSE: Record<string, string> = {
  Haki: 'Ses coups ne peuvent pas être esquivés',
  Logia: "+10 % d'esquive (20 % au total)",
  Paramecia: "+10 % d'esquive (20 % au total)",
  Zoan: 'Régénère 1,2 % des PV max à chaque tour',
  Sabreur: '30 % de chance de coup critique (×1.5)',
  Sniper: 'Tire une fois avant le tour 1 (ouverture gratuite)',
};

// §8 point 5 : sprite, classe/rareté/niveau, passif, compétence, bouton Incarner.
// ⚠️ Simplification : pas de slots équipement (§4ter reporté), pas de vraie XP (aucun
// combat jouable encore) — la barre reste à 0 avec un message honnête.
export function FichePerso({
  carte, changementsRestants, prochainChangementCout, erreur, onRetour, onIncarner,
}: {
  carte: CarteCollection;
  changementsRestants: number;
  /** 0 = le prochain changement est encore gratuit. Sinon son prix en Berrys (§3). */
  prochainChangementCout: number;
  /** Message si le dernier "Incarner" a été refusé (Berrys insuffisants). */
  erreur: string;
  onRetour: () => void;
  onIncarner: () => void;
}) {
  const rareteCouleur = COULEUR_RARETE[carte.rarete] ?? '#888';
  const classeCouleur = COULEUR_CLASSE[carte.classe] ?? '#888';

  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(180deg,#2e93c2 0%,#1c6f9c 45%,#0f2733 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px' }}>
        <button onClick={onRetour} style={{ font: '800 13px Rubik,Arial', background: 'rgba(0,0,0,.35)', color: '#fff', border: '2px solid #fff', borderRadius: 20, padding: '6px 14px' }}>
          ← Retour
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px 18px' }}>
        <div style={{ background: '#e9d9b0', border: '4px solid #1a1208', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {carte.image_menu_url ? (
            // Le cadre s'adapte à la taille réelle de l'image (largeur pleine, hauteur automatique) :
            // jamais étirée, jamais rognée, contrairement aux vignettes (Collection/Accueil) qui, elles,
            // remplissent un cadre fixe.
            <div style={{ borderRadius: 6, background: '#123540', border: '1px solid #1a1208', overflow: 'hidden', animation: 'idleBob 2.4s ease-in-out infinite' }}>
              <img src={carte.image_menu_url} alt={carte.nom} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
          ) : (
            <div style={{ height: 140, borderRadius: 6, background: '#123540', border: '1px solid #1a1208', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'idleBob 2.4s ease-in-out infinite' }}>
              <span style={{ color: 'rgba(42,26,13,.5)', font: "700 10px 'Courier New',monospace" }}>SPRITE (idle)</span>
            </div>
          )}
          <div style={{ font: '900 20px Rubik,Arial', color: '#1a1208' }}>{carte.nom}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: classeCouleur, color: '#fff', font: '800 10px Rubik,Arial', padding: '4px 9px', borderRadius: 14 }}>{carte.classe}</span>
            <span style={{ background: rareteCouleur, color: '#1a1208', font: '800 10px Rubik,Arial', padding: '4px 9px', borderRadius: 14 }}>{carte.rarete}</span>
            <span style={{ background: '#1a1208', color: 'var(--or)', font: '800 10px Rubik,Arial', padding: '4px 10px', borderRadius: 14, border: '2px solid #ffc53d', boxShadow: '1px 1px 0 rgba(0,0,0,.4)' }}>
              Niveau {carte.niveau}
            </span>
          </div>
          <div style={{ font: '700 10px Rubik,Arial', color: '#5c4326' }}>{PASSIF_CLASSE[carte.classe] ?? ''}</div>

          <div>
            <div style={{ height: 9, borderRadius: 6, background: '#1a1208', overflow: 'hidden' }}>
              <div style={{ width: '0%', height: '100%', background: '#8a2f1f' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <div style={{ font: '800 10px Rubik,Arial', color: '#5c4326' }}>0 XP</div>
              <div style={{ font: '600 10px Rubik,Arial', color: '#5c4326', fontStyle: 'italic' }}>Gagne de l'XP en combattant</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: '#1a1208', borderRadius: 10, padding: '12px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ font: '900 22px Rubik,Arial', color: 'var(--rose)' }}>{carte.attack}</div>
              <div style={{ font: '800 10px Rubik,Arial', color: '#e9d9b0', letterSpacing: 0.5 }}>ATTAQUE</div>
            </div>
            <div style={{ flex: 1, background: '#1a1208', borderRadius: 10, padding: '12px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ font: '900 22px Rubik,Arial', color: '#5fbf4d' }}>{carte.pv}</div>
              <div style={{ font: '800 10px Rubik,Arial', color: '#e9d9b0', letterSpacing: 0.5 }}>POINTS DE VIE</div>
            </div>
          </div>

          <div style={{ background: '#1a1208', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 'none', width: 34, height: 34, borderRadius: 8, background: '#8a2f1f', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '900 16px Rubik,Arial', color: 'var(--or)' }}>✦</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '800 9px Rubik,Arial', color: 'var(--or)', letterSpacing: 0.5, marginBottom: 2 }}>COMPÉTENCE UNIQUE</div>
              <div style={{ font: '400 18px Bangers,Rubik', letterSpacing: 1, color: '#e9d9b0' }}>{carte.competence_nom ?? '—'}</div>
              <div style={{ font: '600 11px Rubik,Arial', color: 'rgba(233,217,176,.75)', marginTop: 3 }}>{carte.competence_desc ?? ''}</div>
            </div>
          </div>

          <button
            onClick={onIncarner}
            disabled={carte.actif}
            style={{
              font: '400 17px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-6deg)',
              background: carte.actif ? '#8a8a8a' : 'var(--rose)', color: '#fff', border: '3px solid #1a1208',
              borderRadius: 10, padding: 13, boxShadow: '0 5px 0 #1a1208',
            }}
          >
            {carte.actif ? 'DÉJÀ INCARNÉ' : 'INCARNER'}
            {/* Le prix est annoncé SUR le bouton : le joueur doit le voir avant de cliquer,
                pas le découvrir une fois les Berrys débités. */}
            {!carte.actif && prochainChangementCout > 0 && (
              <span style={{ font: '800 12px Rubik,Arial', marginLeft: 8 }}>
                — {prochainChangementCout} <Berry size={12} />
              </span>
            )}
          </button>
          {erreur && (
            <div style={{ textAlign: 'center', font: '800 10px Rubik,Arial', color: '#fff', background: '#8a2f1f', border: '2px solid #1a1208', borderRadius: 8, padding: '8px 10px' }}>
              {erreur}
            </div>
          )}
          <div style={{ textAlign: 'center', font: '700 10px Rubik,Arial', color: '#5c4326' }}>
            {changementsRestants > 0
              ? `Changements gratuits restants : ${changementsRestants} cette semaine`
              : 'Plus de changement gratuit — le prix remonte à chaque fois, et tout se remet à zéro lundi.'}
          </div>
        </div>
      </div>
    </div>
  );
}
