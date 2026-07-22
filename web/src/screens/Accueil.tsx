import { useEffect, useRef, useState } from 'react';
import type { EtatJoueur, QueteAffichee } from '../api';
import { Berry } from '../components/Berry';

const COULEUR_CLASSE: Record<string, string> = {
  Haki: 'var(--classe-haki)',
  Logia: 'var(--classe-logia)',
  Paramecia: 'var(--classe-paramecia)',
  Zoan: 'var(--classe-zoan)',
  Sniper: 'var(--classe-sniper)',
  Sabreur: 'var(--classe-sabreur)',
};

const COULEUR_RARETE: Record<string, string> = {
  Commun: 'var(--rarete-commun)',
  'Peu commun': 'var(--rarete-peu-commun)',
  Rare: 'var(--rarete-rare)',
  Epique: 'var(--rarete-epique)',
  Legendaire: 'var(--rarete-legendaire)',
};

interface TutoRect { x: number; y: number; w: number; h: number; }

// Valeurs TEST — systèmes pas encore construits (niveau de compte, titre, XP de compte).
// Affichées quand même (visuel fidèle au prototype) en attendant que le §3 chiffre le niveau
// et l'XP de compte. Le statut live, lui, est réel depuis la Brique 6 (etat.live_en_direct).
const TEST_ACCOUNT_LEVEL = 1;
const TEST_ACCOUNT_TITRE = 'Moussaillon';
const TEST_ACCOUNT_XP_PCT = 35;
const NOM_CHAINE_TWITCH = 'Mekmek_tv';
const URL_CHAINE_TWITCH = `https://twitch.tv/${NOM_CHAINE_TWITCH.toLowerCase()}`;

// §8 point 2 : l'écran le plus vu (80 % du temps). Reprend fidèlement le prototype validé
// (bandeau océan animé, badges, panneau Berrys/énergie, tutoriel guidé 2 étapes).
//
// ⚠️ Simplifications ASSUMÉES pour ce jalon (systèmes pas encore construits) :
//  - pas de série de victoires (winStreak) — la carte "série" ne s'affiche jamais pour l'instant
//  - le sprite est le portrait fixe (`image_menu`), pas encore l'idle animé en boucle
// Une ligne de quête dans l'encart de l'Accueil (utilisée pour le jour ET la semaine, d'où la
// sortie en composant pour éviter de dupliquer la barre de progression et le bouton). Le clic sur
// "Réclamer" stoppe la propagation : sans ça, il ouvrirait aussi le panneau complet (l'encart est
// cliquable en entier).
function LigneQueteAccueil({ label, q, onReclamer }: {
  label: string; q: QueteAffichee | null; onReclamer: (cle: string) => void;
}) {
  return (
    <div>
      <div style={{ font: '800 9px Rubik,Arial', letterSpacing: 0.3, color: 'rgba(239,231,214,.45)', marginBottom: 3 }}>{label}</div>
      {q ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ font: '700 12px Rubik,Arial', color: 'var(--texte)' }}>{q.titre}</div>
            <div style={{ flex: 'none', font: '800 11px Rubik,Arial', color: 'var(--or)', whiteSpace: 'nowrap' }}>
              <Berry size={11} /> {q.recompense}
            </div>
          </div>

          <div style={{ marginTop: 6, height: 7, borderRadius: 6, background: 'rgba(0,0,0,.35)', overflow: 'hidden' }}>
            <div style={{
              width: `${q.objectif > 0 ? Math.min(100, Math.round((q.progression / q.objectif) * 100)) : 0}%`,
              height: '100%', background: q.accomplie ? 'var(--rarete-peu-commun)' : 'var(--or)', transition: 'width .3s',
            }}
            />
          </div>
          <div style={{ marginTop: 4, font: '700 10px Rubik,Arial', color: 'rgba(239,231,214,.6)' }}>
            {q.progression} / {q.objectif}
          </div>

          {q.reclamee ? (
            <div style={{ marginTop: 6, font: '800 10px Rubik,Arial', color: 'var(--rarete-peu-commun)' }}>✓ Récompense réclamée</div>
          ) : q.reclamable ? (
            <button
              onClick={(e) => { e.stopPropagation(); onReclamer(q.cle); }}
              style={{
                marginTop: 8, width: '100%', font: '400 13px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-5deg)',
                background: 'var(--rose)', color: '#fff', border: '2px solid #000', borderRadius: 8, padding: '7px 0', boxShadow: '0 3px 0 #000',
              }}
            >
              RÉCLAMER +{q.recompense}
            </button>
          ) : null}
        </>
      ) : (
        <div style={{ font: '700 12px Rubik,Arial', color: 'rgba(239,231,214,.55)' }}>Aucune quête pour le moment.</div>
      )}
    </div>
  );
}

export function Accueil({
  etat, queteJour, queteSemaine, montrerTuto, onCombattre, onOuvrirQuetes, onReclamer, onEncaisserPresence,
}: {
  etat: EtatJoueur;
  queteJour: QueteAffichee | null;
  queteSemaine: QueteAffichee | null;
  montrerTuto: boolean;
  onCombattre: () => void;
  onOuvrirQuetes: () => void;
  onReclamer: (cle: string) => void;
  onEncaisserPresence: () => void;
}) {
  const perso = etat.perso_actif;

  const [tutoStep, setTutoStep] = useState(montrerTuto ? 1 : 0);
  const [tutoRect, setTutoRect] = useState<TutoRect | null>(null);
  const [tutoTipTop, setTutoTipTop] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const fightRef = useRef<HTMLButtonElement>(null);

  const mesurerTuto = (cible: HTMLElement | null) => {
    setTimeout(() => {
      if (!cible || !overlayRef.current) return;
      const padX = 8;
      const padY = 8;
      const r = cible.getBoundingClientRect();
      const base = overlayRef.current.getBoundingClientRect();
      const rect: TutoRect = { x: r.left - base.left - padX, y: r.top - base.top - padY, w: r.width + padX * 2, h: r.height + padY * 2 };
      const tipAbove = rect.y + rect.h > base.height - 170;
      setTutoRect(rect);
      setTutoTipTop(tipAbove ? Math.max(10, rect.y - 128) : rect.y + rect.h + 12);
    }, 60);
  };

  useEffect(() => {
    if (tutoStep === 1) mesurerTuto(heroRef.current);
    if (tutoStep === 2) mesurerTuto(fightRef.current);
  }, [tutoStep]);

  const tutoNext = () => setTutoStep((s) => s + 1);

  // Le tutoriel se termine en FAISANT, pas en cliquant "compris" : l'étape 2 se referme
  // quand le joueur lance vraiment son premier combat.
  const combattreDepuisTuto = () => { setTutoStep(0); onCombattre(); };

  const classeCouleur = perso ? COULEUR_CLASSE[perso.classe] ?? '#888' : '#888';
  const rareteCouleur = perso ? COULEUR_RARETE[perso.rarete] ?? '#888' : '#888';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', position: 'relative' }}>
      {/* --- Bandeau océan --- */}
      <div style={{
        background: 'linear-gradient(180deg,#7cc9e3 0%,#4fb8d9 34%,#2e93c2 100%)',
        padding: '18px 18px 52px', position: 'relative', overflow: 'hidden', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none',
      }}
      >
        <div style={{ position: 'absolute', top: -24, right: -10, width: 70, height: 70, borderRadius: '50%', background: 'var(--or)', boxShadow: '0 0 30px 8px rgba(255,197,61,.4)' }} />
        <svg style={{ position: 'absolute', bottom: 40, left: 0, width: '200%', height: 40, animation: 'waveMove 11s linear infinite', opacity: 0.8 }} viewBox="0 0 1200 60" preserveAspectRatio="none">
          <path d="M0 26 Q75 8 150 26 T300 26 T450 26 T600 26 T750 26 T900 26 T1050 26 T1200 26 V60 H0 Z" fill="#1c6f9c" />
        </svg>
        <svg style={{ position: 'absolute', bottom: 22, left: 0, width: '200%', height: 46, animation: 'waveMove 7s linear infinite' }} viewBox="0 0 1200 60" preserveAspectRatio="none">
          <path d="M0 24 Q75 42 150 24 T300 24 T450 24 T600 24 T750 24 T900 24 T1050 24 T1200 24 V60 H0 Z" fill="#16608c" />
          <path d="M0 24 Q75 42 150 24 T300 24 T450 24 T600 24 T750 24 T900 24 T1050 24 T1200 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" />
        </svg>

        {perso && (
          <>
            <div style={{ font: "400 22px/1 Bangers,Rubik", letterSpacing: 1, transform: 'skew(-8deg)', color: '#fff', textShadow: '2px 2px 0 #12324a', position: 'relative' }}>
              {perso.nom}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap', position: 'relative' }}>
              <span style={{ background: classeCouleur, color: '#fff', font: '800 9px Rubik,Arial', padding: '3px 8px', borderRadius: 20 }}>{perso.classe}</span>
              <span style={{ background: rareteCouleur, color: '#1a1208', font: '800 9px Rubik,Arial', padding: '3px 8px', borderRadius: 20 }}>{perso.rarete}</span>
            </div>
            <div
              ref={heroRef}
              style={{
                position: 'relative', width: 140, height: 140, borderRadius: 14,
                border: `4px solid ${rareteCouleur}`, boxShadow: `0 0 20px ${rareteCouleur}77`,
                animation: 'idleBob 2.4s ease-in-out infinite', marginTop: 10,
              }}
            >
              {/* Le contenu est dans un cadre interne avec son propre overflow:hidden, pour que
                  le badge de niveau (positionné à cheval sur le bord) ne soit jamais rogné. */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 10, overflow: 'hidden', background: '#123540',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              >
                {perso.image_menu_url
                  ? <img src={perso.image_menu_url} alt={perso.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                  : <span style={{ color: 'rgba(239,231,214,.4)', font: "700 9px 'Courier New',monospace" }}>SPRITE (idle)</span>}
              </div>
              <div style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', background: '#14303c', border: `3px solid ${rareteCouleur}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 11px Rubik,Arial', color: 'var(--texte)', zIndex: 1 }}>
                {perso.niveau}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, position: 'relative', font: '700 12px Rubik,Arial', color: '#fff' }}>
              <span>❤️ {perso.pv} PV</span>
              <span>⚔️ {perso.attack} Attack</span>
            </div>
          </>
        )}

        <div style={{ position: 'relative', width: '100%', marginTop: 16, paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 'none' }}>
            {/* La photo de profil Twitch. Repli sur l'initiale du pseudo plutôt qu'un
                emplacement vide : les comptes de dev n'ont pas d'avatar, et un joueur Twitch
                peut ne jamais en avoir mis. */}
            <div style={{
              width: 54, height: 54, borderRadius: '50%', background: '#14303c', border: '3px solid var(--or)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              font: '800 20px Rubik,Arial', color: 'rgba(255,255,255,.6)',
            }}
            >
              {etat.avatar_url
                ? <img src={etat.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : etat.pseudo.charAt(0).toUpperCase()}
            </div>
            <div style={{
              position: 'absolute', bottom: -5, right: -5, minWidth: 22, height: 22, padding: '0 4px',
              borderRadius: 11, background: 'var(--or)', border: '2px solid #1a1208', display: 'flex',
              alignItems: 'center', justifyContent: 'center', font: '800 11px Rubik,Arial', color: '#1a1208',
            }}
            >
              {TEST_ACCOUNT_LEVEL}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ font: '800 15px Rubik,Arial', color: '#fff', whiteSpace: 'nowrap' }}>{etat.pseudo}</div>
            <div style={{ font: '700 10px Rubik,Arial', color: 'rgba(255,255,255,.85)', marginTop: 1 }}>{TEST_ACCOUNT_TITRE}</div>
            <div style={{ marginTop: 6, width: 132, height: 8, borderRadius: 6, background: 'rgba(0,0,0,.35)', overflow: 'hidden' }}>
              <div style={{ width: `${TEST_ACCOUNT_XP_PCT}%`, height: '100%', background: 'var(--or)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* --- Berrys / énergie --- */}
      <div style={{ margin: '-30px 16px 0', background: '#14303c', border: '2px solid #000', borderRadius: 10, padding: '12px 14px', display: 'flex', position: 'relative', gap: 10, zIndex: 1 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ font: '800 15px Rubik,Arial', color: 'var(--or)' }}><Berry size={15} /> {etat.berrys}</div>
          <div style={{ font: '700 9px Rubik,Arial', color: 'rgba(239,231,214,.55)' }}>BERRYS</div>
        </div>
        <div style={{ width: 1, background: 'rgba(239,231,214,.15)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ font: '800 15px Rubik,Arial', color: 'var(--rose)' }}>{etat.energie}</div>
          <div style={{ font: '700 9px Rubik,Arial', color: 'rgba(239,231,214,.55)' }}>COMBATS DU JOUR</div>
        </div>
      </div>

      {/* --- Zone "planches de bois" : action principale --- */}
      <div style={{
        flex: 1, backgroundColor: '#c9a267',
        backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,.1) 0 3px, transparent 3px 56px),'
          + 'repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 40px)',
        padding: '22px 16px 20px', marginTop: -14,
      }}
      >
        <button
          ref={fightRef}
          onClick={combattreDepuisTuto}
          disabled={!perso || etat.energie <= 0}
          title={etat.energie <= 0 ? "Plus de combats gratuits aujourd'hui" : undefined}
          style={{
            width: '100%', font: '400 20px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-6deg)',
            background: 'var(--rose)', color: '#fff', border: '3px solid #000', borderRadius: 14,
            padding: 16, boxShadow: '0 6px 0 #000', marginBottom: 10,
          }}
        >
          ⚔️ COMBATTRE
        </button>

        {/* Bandeau live (Brique 6). Ouvre la vraie chaîne dans un nouvel onglet ; le texte change
            selon etat.live_en_direct (mis à jour par stream.online/.offline EventSub) — pas de
            second bandeau séparé, juste un contenu différent pour ne pas dupliquer le style. */}
        <div style={{ position: 'relative' }}>
          <a
            href={URL_CHAINE_TWITCH}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10,
              borderRadius: 10, padding: 12, boxShadow: etat.live_en_direct ? '0 4px 0 #7a1f2b' : '0 4px 0 #4b1fa0',
              background: etat.live_en_direct
                ? 'linear-gradient(135deg,#6e1d2a,#e91e3c)'
                : 'linear-gradient(135deg,#3a1d6e,#9146ff)',
              border: `2px solid ${etat.live_en_direct ? '#ff4d5e' : '#772ce8'}`,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flex: 'none' }}>
              <path fill="#fff" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
            <div style={{ flex: 1, font: "700 11px/1.35 Rubik,Arial", color: '#fff', textAlign: 'left' }}>
              {etat.live_en_direct ? (
                <>
                  🔴 <b>{NOM_CHAINE_TWITCH}</b> est EN DIRECT !<br />
                  <span style={{ opacity: 0.85, fontWeight: 600 }}>Rejoins le chat : +40 Berrys / 30 min + des tirages premium.</span>
                </>
              ) : (
                <>
                  Ne manque pas les lives de <b>{NOM_CHAINE_TWITCH}</b> !<br />
                  <span style={{ opacity: 0.85, fontWeight: 600 }}>En direct : +40 Berrys / 30 min + des tirages premium.</span>
                </>
              )}
            </div>
            <span style={{ flex: 'none', font: '900 18px Rubik,Arial', color: 'var(--or)' }}>›</span>
          </a>

          {etat.presence_berrys_en_attente > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEncaisserPresence(); }}
              title="Récupérer les Berrys gagnés grâce à ta présence en live"
              style={{
                position: 'absolute', top: -10, right: -8, minWidth: 30, height: 30, padding: '0 6px',
                borderRadius: 15, background: 'var(--or)', border: '2px solid #1a1208', display: 'flex',
                alignItems: 'center', justifyContent: 'center', font: '800 11px Rubik,Arial', color: '#1a1208',
                boxShadow: '0 2px 0 #000', cursor: 'pointer', zIndex: 1,
              }}
            >
              +{etat.presence_berrys_en_attente}
            </button>
          )}
        </div>

        {/* Encart quêtes : la quête du jour ET la quête de la semaine. Les succès de collection
            ne sont QUE dans le panneau complet (ouvert via "Voir tout"). */}
        <div
          onClick={onOuvrirQuetes}
          style={{ marginTop: 10, background: '#14303c', border: '2px solid #000', borderRadius: 10, padding: 12, cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ font: '800 10px Rubik,Arial', color: 'rgba(239,231,214,.6)' }}>QUÊTES</div>
            <div style={{ font: '800 10px Rubik,Arial', color: 'var(--or)' }}>VOIR TOUT ›</div>
          </div>

          <LigneQueteAccueil label="QUÊTE DU JOUR" q={queteJour} onReclamer={onReclamer} />
          <div style={{ height: 1, background: 'rgba(239,231,214,.12)', margin: '10px 0' }} />
          <LigneQueteAccueil label="QUÊTE DE LA SEMAINE" q={queteSemaine} onReclamer={onReclamer} />
        </div>
      </div>

      {/* --- Tutoriel guidé (2 étapes pour l'instant : perso actif, bouton COMBATTRE) --- */}
      {tutoStep === 1 && (
        <div ref={overlayRef} style={{ position: 'absolute', inset: 0, zIndex: 8 }}>
          {tutoRect && (
            <div style={{
              position: 'absolute', left: tutoRect.x, top: tutoRect.y, width: tutoRect.w, height: tutoRect.h,
              borderRadius: 18, boxShadow: '0 0 0 9999px rgba(0,0,0,.74), 0 0 0 4px var(--or), 0 0 24px 6px rgba(255,197,61,.8)',
              animation: 'glowPulse 1.4s ease-in-out infinite',
            }}
            />
          )}
          <div style={{ position: 'absolute', top: tutoTipTop, left: 24, right: 24, background: '#e9d9b0', border: '3px solid #1a1208', borderRadius: 10, padding: '12px 14px', boxShadow: '0 5px 0 rgba(0,0,0,.4)' }}>
            <div style={{ font: '400 15px Bangers,Rubik', letterSpacing: 1, color: '#1a1208' }}>TON PIRATE</div>
            <div style={{ font: '600 11px/1.45 Rubik,Arial', color: '#1a1208', marginTop: 3 }}>
              Voici le pirate que tu incarnes. Sa classe, sa rareté et son niveau font ta puissance.
            </div>
            <button onClick={tutoNext} style={{ marginTop: 9, width: '100%', font: '400 14px Bangers,Rubik', letterSpacing: 1, background: 'var(--rose)', color: '#fff', border: '3px solid #1a1208', borderRadius: 10, padding: 10, boxShadow: '0 4px 0 #1a1208' }}>
              SUIVANT
            </button>
          </div>
        </div>
      )}
      {/* ⚠️ pointerEvents 'none' sur le voile : le "trou" du projecteur n'est pas un vrai trou,
          c'est un box-shadow géant sur un élément qui couvre TOUT l'écran. Sans ça, le voile
          avalait le clic et le bouton COMBATTRE mis en avant était impossible à presser —
          le tutoriel demandait d'appuyer sur un bouton qu'il bloquait lui-même. */}
      {tutoStep === 2 && (
        <div ref={overlayRef} style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none' }}>
          {tutoRect && (
            <div style={{
              position: 'absolute', left: tutoRect.x, top: tutoRect.y, width: tutoRect.w, height: tutoRect.h,
              borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,.74), 0 0 0 4px var(--or), 0 0 24px 6px rgba(255,197,61,.8)',
              animation: 'glowPulse 1.4s ease-in-out infinite',
            }}
            />
          )}
          <div style={{ position: 'absolute', top: tutoTipTop, left: 24, right: 24, background: '#e9d9b0', border: '3px solid #1a1208', borderRadius: 10, padding: '12px 14px', boxShadow: '0 5px 0 rgba(0,0,0,.4)' }}>
            <div style={{ font: '400 15px Bangers,Rubik', letterSpacing: 1, color: '#1a1208' }}>PREMIER COMBAT</div>
            <div style={{ font: '600 11px/1.45 Rubik,Arial', color: '#1a1208', marginTop: 3 }}>
              Appuie sur COMBATTRE : le combat se joue tout seul, regarde et encaisse les Berrys.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
