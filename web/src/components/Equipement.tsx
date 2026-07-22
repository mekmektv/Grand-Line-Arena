// GRAND LINE ARENA — l'équipement côté écran (§4ter).
//
// Deux blocs, montés à deux endroits (décidé le 21/07/2026) :
//   • <CoffreEquipement>      → écran Coffres, sous le roll perso. Ne fait QUE vendre des
//                               coffres contre des Berrys : aucune mécanique de sacrifice ici.
//   • <InventaireEquipement>  → onglet ÉQUIPEMENT de la Collection. On y regarde UN perso à la
//                               fois (jamais la liste de tous), on gère ses 2 slots, et c'est
//                               là — et seulement là — qu'on sacrifie des objets de l'inventaire
//                               pour un coffre garanti.
//
// Le front ne calcule AUCUN chiffre de jeu : stats, prix, seuils et raretés viennent tous de
// /equipement et /coffre. Ici il n'y a que de la mise en forme.

import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ouvrirCoffre, equiperObjet, recyclerEquipement,
  type CarteCollection, type EtatEquipement, type ObjetPossede,
  type RareteEquipement, type ResultatCoffre,
} from '../api';
import { Berry } from './Berry';
import { CoffreSvg } from './CoffreSvg';

// Purement décoratif : ces couleurs ne changent rien à ce que le joueur obtient. Les vraies
// raretés et leurs taux vivent en base (même nuance que POIDS_DEFILE dans Tirage.tsx).
const COULEUR_EQUIP: Record<RareteEquipement, string> = {
  Gris: '#9aa4ab',
  Vert: '#5ac25a',
  Bleu: '#4a9fe0',
};

const ICONE_TYPE: Record<ObjetPossede['type'], string> = { Chapeau: '🎩', Tenue: '🧥' };
const TYPES: ObjetPossede['type'][] = ['Chapeau', 'Tenue'];

/** « +27 PV / +1 ATK », ou juste la stat non nulle — un « +0 ATK » n'apprend rien. */
function Stats({ hp, attack }: { hp: number; attack: number }) {
  const morceaux: string[] = [];
  if (hp > 0) morceaux.push(`+${hp} PV`);
  if (attack > 0) morceaux.push(`+${attack} ATK`);
  return <>{morceaux.join(' · ')}</>;
}

export function CarteObjet({ objet, onClick, selectionne, coin, style }: {
  objet: Pick<ObjetPossede, 'nom' | 'type' | 'rarete' | 'hp' | 'attack'>;
  onClick?: () => void;
  selectionne?: boolean;
  coin?: ReactNode;
  style?: CSSProperties;
}) {
  const couleur = COULEUR_EQUIP[objet.rarete];
  return (
    <div
      onClick={onClick}
      style={{
        background: '#e9d9b0', borderRadius: 3, padding: '7px 8px', textAlign: 'left',
        border: '2px solid #1a1208', outline: `2px solid ${couleur}`, outlineOffset: -5,
        boxShadow: selectionne ? '0 0 0 3px var(--or)' : '2px 3px 0 rgba(0,0,0,.3)',
        cursor: onClick ? 'pointer' : 'default', position: 'relative', ...style,
      }}
    >
      {coin}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 17 }}>{ICONE_TYPE[objet.type]}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: '800 10px Rubik,Arial', color: '#1a1208', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {objet.nom}
          </div>
          <div style={{ font: '700 9px Rubik,Arial', color: couleur === '#9aa4ab' ? '#5d6a72' : couleur, marginTop: 2 }}>
            {objet.rarete} · <Stats hp={objet.hp} attack={objet.attack} />
          </div>
        </div>
      </div>
    </div>
  );
}

const Encart = ({ children, erreur }: { children: ReactNode; erreur?: boolean }) => (
  <div style={{
    font: '800 10px Rubik,Arial', borderRadius: 10, padding: '8px 11px', marginBottom: 10,
    background: erreur ? '#4a1414' : '#14303c', color: erreur ? '#ffb4b4' : 'var(--or)',
    border: `2px solid ${erreur ? '#b34a4a' : 'var(--or)'}`,
  }}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Le coffre (écran Coffres) — mise en page calquée sur le ROLL PERSONNAGE juste au-dessus
// ---------------------------------------------------------------------------

export function CoffreEquipement({ etat, persoActifId, persoActifNom, onChange }: {
  etat: EtatEquipement | null;
  persoActifId: number | null;
  persoActifNom: string | null;
  onChange: () => void;
}) {
  const [ouverture, setOuverture] = useState(false);
  const [resultat, setResultat] = useState<ResultatCoffre | null>(null);
  const [message, setMessage] = useState<ReactNode>(null);
  const [erreur, setErreur] = useState('');

  if (!etat) return null;
  const tropPauvre = etat.berrys < etat.cout_coffre;

  const lancer = async () => {
    setErreur(''); setMessage(null); setOuverture(true);
    try {
      const r = await ouvrirCoffre({ cible: persoActifId });
      // Secousse courte : le coffre équipement est un geste répété, il ne doit pas avoir la
      // cérémonie du roll perso (qui, lui, se paie 100 Berrys et se regarde).
      await new Promise((f) => setTimeout(f, 620));
      setResultat(r);
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOuverture(false);
    }
  };

  return (
    <>
      <button
        onClick={lancer}
        disabled={tropPauvre || ouverture}
        style={{
          width: '100%', background: '#4a3a2a', border: '4px solid #1a1208', borderRadius: 18,
          padding: 0, overflow: 'hidden', boxShadow: '0 8px 0 rgba(0,0,0,.35)',
          opacity: tropPauvre ? 0.55 : 1, position: 'relative',
        }}
      >
        <div style={{ background: '#e9d9b0', color: '#1a1208', font: '800 11px Rubik,Arial', letterSpacing: 1, padding: '7px 0' }}>
          COFFRE ÉQUIPEMENT
        </div>
        <div style={{ padding: '24px 18px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <CoffreSvg agite={ouverture} />
          <div style={{ font: '400 20px Bangers,Rubik', letterSpacing: 1, transform: 'skew(-6deg)', color: '#fff', lineHeight: 1.15, maxWidth: 240 }}>
            {ouverture ? 'Ouverture…' : 'Obtiens de l\'équipement pour tes pirates'}
          </div>
          <div style={{ font: '800 14px Rubik,Arial', color: 'var(--or)' }}>
            <Berry size={14} /> {etat.cout_coffre}
          </div>
        </div>
      </button>

      {message && <Encart>{message}</Encart>}
      {erreur && <Encart erreur>{erreur}</Encart>}

      {resultat && (
        <FenetreResultat
          resultat={resultat}
          cibleNom={persoActifNom}
          cibleId={persoActifId}
          onFini={(m) => { setMessage(m); setResultat(null); }}
          onChange={onChange}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// La révélation, partagée par le coffre et le sacrifice
// ---------------------------------------------------------------------------

/**
 * La comparaison nouvel objet / objet porté, avec la différence chiffrée.
 *
 * C'est le cœur du système (décision du 21/07/2026) : le joueur voit l'écart, puis choisit
 * d'équiper (ce qui DÉTRUIT l'ancien, §4ter) ou d'envoyer le nouveau à l'inventaire. Aucune
 * des deux options n'est présélectionnée.
 */
function FenetreResultat({ resultat, cibleNom, cibleId, onFini, onChange }: {
  resultat: ResultatCoffre;
  cibleNom: string | null;
  cibleId: number | null;
  onFini: (message: ReactNode) => void;
  onChange: () => void;
}) {
  const [erreur, setErreur] = useState('');
  const { objet, actuel } = resultat;
  const dHp = objet.hp - (actuel?.hp ?? 0);
  const dAtk = objet.attack - (actuel?.attack ?? 0);
  const teinte = (d: number) => (d > 0 ? '#3fae4b' : d < 0 ? '#c0392b' : '#5d6a72');
  const signe = (d: number) => (d > 0 ? `+${d}` : `${d}`);

  const equiper = async () => {
    if (cibleId === null) return;
    setErreur('');
    try {
      // Le slot occupé doit être libéré AVANT : c'est la règle du §4ter, et le serveur
      // refuserait l'inverse. On recycle donc, puis on équipe.
      if (actuel) await recyclerEquipement(actuel.id);
      await equiperObjet(objet.id, cibleId);
      onFini(<>✅ {objet.nom} équipé sur {cibleNom}.</>);
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
    }}
    >
      <div style={{
        width: '100%', maxWidth: 340, background: '#c9a267', border: '4px solid #1a1208',
        borderRadius: 10, padding: 16, boxShadow: '0 10px 0 rgba(0,0,0,.4)',
        animation: 'statMonte .3s ease-out both',
      }}
      >
        <div style={{ font: '400 20px Bangers,Rubik', color: '#1a1208', letterSpacing: 1, textAlign: 'center', marginBottom: 12 }}>
          {actuel ? 'TU AS TROUVÉ MIEUX ?' : 'NOUVEL ÉQUIPEMENT !'}
        </div>

        <CarteObjet objet={objet} style={{ marginBottom: 10 }} />

        {actuel ? (
          <>
            <div style={{ font: '800 9px Rubik,Arial', color: 'rgba(26,18,8,.7)', textAlign: 'center', margin: '2px 0 6px' }}>
              {cibleNom} porte actuellement
            </div>
            <CarteObjet objet={actuel} style={{ opacity: 0.85 }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, margin: '10px 0 4px', font: '800 12px Rubik,Arial' }}>
              <span style={{ color: teinte(dHp) }}>{signe(dHp)} PV</span>
              <span style={{ color: teinte(dAtk) }}>{signe(dAtk)} ATK</span>
            </div>
            <div style={{ font: '700 9px Rubik,Arial', color: '#7a2d2d', textAlign: 'center', marginBottom: 10 }}>
              ⚠️ Équiper détruira « {actuel.nom} » — un équipement porté ne se retire pas (§4ter).
            </div>
          </>
        ) : (
          <div style={{ font: '700 10px Rubik,Arial', color: 'rgba(26,18,8,.75)', textAlign: 'center', margin: '4px 0 12px' }}>
            {cibleId !== null
              ? <>Le slot {objet.type} de {cibleNom} est libre.</>
              : <>Incarne un pirate pour pouvoir l'équiper.</>}
          </div>
        )}

        {erreur && (
          <div style={{ font: '700 9px Rubik,Arial', color: '#7a2d2d', textAlign: 'center', marginBottom: 8 }}>{erreur}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onFini(<>📦 {objet.nom} rangé dans l'inventaire.</>)}
            style={{ flex: 1, font: '800 10px Rubik,Arial', padding: '11px 0', borderRadius: 10, background: '#e9d9b0', color: '#1a1208', border: '2px solid #1a1208', cursor: 'pointer' }}
          >
            📦 INVENTAIRE
          </button>
          <button
            onClick={equiper}
            disabled={cibleId === null}
            style={{
              flex: 1, font: '800 10px Rubik,Arial', padding: '11px 0', borderRadius: 10,
              background: cibleId !== null ? 'var(--or)' : 'rgba(26,18,8,.2)',
              color: cibleId !== null ? '#1a1208' : 'rgba(26,18,8,.45)',
              border: '2px solid #1a1208', cursor: cibleId !== null ? 'pointer' : 'default',
            }}
          >
            ⚔️ ÉQUIPER
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// L'inventaire (onglet ÉQUIPEMENT de la Collection)
// ---------------------------------------------------------------------------

export function InventaireEquipement({ etat, cartes, onChange }: {
  etat: EtatEquipement | null;
  cartes: CarteCollection[];
  onChange: () => void;
}) {
  // Le perso REGARDÉ. On n'affiche jamais la liste de tous les persos équipés (ça devenait
  // interminable) : on en regarde un à la fois, et on gère ses 2 slots sur place.
  const [persoVu, setPersoVu] = useState<number | null>(null);
  const [aDetruire, setADetruire] = useState<ObjetPossede | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [modeSacrifice, setModeSacrifice] = useState(false);
  const [resultat, setResultat] = useState<ResultatCoffre | null>(null);
  const [message, setMessage] = useState<ReactNode>(null);
  const [erreur, setErreur] = useState('');

  if (!etat) {
    return <div style={{ padding: 34, textAlign: 'center', font: '700 12px Rubik,Arial', color: 'rgba(26,18,8,.7)' }}>Chargement…</div>;
  }

  const possedes = cartes.filter((c) => c.possede && c.collection_id !== undefined);
  // Par défaut on regarde le perso actif : c'est celui dont l'équipement compte tout de suite.
  const courant = possedes.find((c) => c.collection_id === persoVu)
    ?? possedes.find((c) => c.actif)
    ?? possedes[0];
  const idCourant = courant?.collection_id ?? null;
  const portes = idCourant !== null ? (etat.equipes[idCourant] ?? []) : [];
  const bonusHp = portes.reduce((s, o) => s + o.hp, 0);
  const bonusAtk = portes.reduce((s, o) => s + o.attack, 0);

  const objetsSelectionnes = etat.inventaire.filter((o) => selection.includes(o.id));
  const rareteSelection = objetsSelectionnes[0]?.rarete ?? null;
  const sacrificeCourant = rareteSelection
    ? etat.sacrifices.find((s) => s.rarete === rareteSelection) ?? null
    : null;
  const pretASacrifier = !!sacrificeCourant && selection.length === sacrificeCourant.requis;

  const reinitialiser = () => { setSelection([]); setModeSacrifice(false); };

  const basculerSelection = (o: ObjetPossede) => {
    setErreur('');
    setSelection((s) => {
      if (s.includes(o.id)) return s.filter((x) => x !== o.id);
      // Un lot doit être d'une seule rareté (le serveur le refuserait) : plutôt que d'afficher
      // une erreur après coup, on repart d'une sélection propre sur la nouvelle rareté.
      if (rareteSelection && o.rarete !== rareteSelection) return [o.id];
      const max = etat.sacrifices.find((x) => x.rarete === o.rarete)?.requis ?? Infinity;
      if (s.length >= max) return s;
      return [...s, o.id];
    });
  };

  const equiper = async (o: ObjetPossede) => {
    if (idCourant === null) return;
    setErreur(''); setMessage(null);
    try {
      await equiperObjet(o.id, idCourant);
      setMessage(<>✅ {o.nom} équipé sur {courant.nom}.</>);
      onChange();
    } catch (e) {
      // Cas le plus fréquent : le slot est pris. Le message du serveur dit quoi recycler.
      setErreur((e as Error).message);
    }
  };

  const sacrifier = async () => {
    setErreur('');
    try {
      const r = await ouvrirCoffre({ sacrifier: selection, cible: idCourant });
      setResultat(r);
      reinitialiser();
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  const detruire = async () => {
    if (!aDetruire) return;
    setErreur('');
    try {
      const r = await recyclerEquipement(aDetruire.id);
      setMessage(<>♻️ {aDetruire.nom} recyclé — +{r.berrys_gagnes} <Berry size={12} /></>);
      setADetruire(null);
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  return (
    <div style={{ padding: '12px 16px 20px' }}>
      {message && <Encart>{message}</Encart>}
      {erreur && <Encart erreur>{erreur}</Encart>}

      {/* ── Quel pirate on regarde ─────────────────────────────────────── */}
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {possedes.map((c) => {
          const actif = c.collection_id === idCourant;
          const nb = (etat.equipes[c.collection_id!] ?? []).length;
          return (
            <button
              key={c.collection_id}
              onClick={() => { setPersoVu(c.collection_id!); setMessage(null); setErreur(''); }}
              style={{
                flex: 'none', font: '800 11px Rubik,Arial', padding: '7px 12px', borderRadius: 20,
                background: actif ? 'var(--or)' : 'rgba(20,48,60,.95)', color: actif ? '#1a1208' : '#e9d9b0',
                border: `2px solid ${actif ? '#1a1208' : 'var(--or)'}`, cursor: 'pointer',
              }}
            >
              {c.actif && '★ '}{c.nom}{nb > 0 && ` (${nb})`}
            </button>
          );
        })}
      </div>

      {/* ── Les 2 slots du pirate regardé ──────────────────────────────── */}
      {courant && (
        <div style={{ background: 'rgba(26,18,8,.12)', borderRadius: 8, padding: '10px 10px 12px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ font: '400 16px Bangers,Rubik', color: '#1a1208', letterSpacing: 1 }}>
              ÉQUIPEMENT DE {courant.nom.toUpperCase()}
            </span>
            <span style={{ font: '800 10px Rubik,Arial', color: portes.length ? '#3fae4b' : 'rgba(26,18,8,.5)' }}>
              {portes.length ? `+${bonusHp} PV · +${bonusAtk} ATK` : 'aucun bonus'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TYPES.map((type) => {
              const porte = portes.find((o) => o.type === type);
              if (porte) {
                return (
                  <CarteObjet
                    key={type}
                    objet={porte}
                    onClick={() => { setErreur(''); setADetruire(porte); }}
                    coin={<span style={{ position: 'absolute', top: 3, right: 5, font: '800 9px Rubik,Arial', color: 'rgba(26,18,8,.45)' }}>♻️</span>}
                  />
                );
              }
              return (
                <div
                  key={type}
                  style={{
                    borderRadius: 3, padding: '11px 8px', textAlign: 'center',
                    border: '2px dashed rgba(26,18,8,.4)', background: 'rgba(255,255,255,.15)',
                    font: '700 10px Rubik,Arial', color: 'rgba(26,18,8,.6)',
                  }}
                >
                  {ICONE_TYPE[type]} {type} vide
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── L'inventaire ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ font: '400 16px Bangers,Rubik', color: '#1a1208', letterSpacing: 1 }}>
          INVENTAIRE ({etat.inventaire.length})
        </span>
        <button
          onClick={() => { reinitialiser(); setModeSacrifice((v) => !v); setErreur(''); setMessage(null); }}
          style={{
            font: '800 9px Rubik,Arial', padding: '6px 11px', borderRadius: 14, cursor: 'pointer',
            background: modeSacrifice ? '#b34a4a' : 'rgba(20,48,60,.95)',
            color: modeSacrifice ? '#fff' : '#e9d9b0', border: '2px solid #1a1208',
          }}
        >
          {modeSacrifice ? '✕ ANNULER' : '♻️ SACRIFIER'}
        </button>
      </div>

      {/* En mode sacrifice : ce qui est possible, puis le lot en cours de constitution. */}
      {modeSacrifice && (
        <div style={{ background: 'rgba(26,18,8,.15)', borderRadius: 8, padding: '9px 10px', marginBottom: 10 }}>
          <div style={{ font: '700 9px Rubik,Arial', color: 'rgba(26,18,8,.8)', marginBottom: 6 }}>
            Détruis des objets de MÊME rareté pour ouvrir un coffre garanti au-dessus :
          </div>
          {etat.sacrifices.map((s) => (
            <div key={s.rarete} style={{ font: '800 10px Rubik,Arial', color: '#1a1208', marginBottom: 3 }}>
              <span style={{ color: COULEUR_EQUIP[s.rarete] === '#9aa4ab' ? '#5d6a72' : COULEUR_EQUIP[s.rarete] }}>
                {s.requis} {s.rarete}
              </span>
              {' → 1 coffre '}
              <span style={{ color: COULEUR_EQUIP[s.rarete_obtenue] }}>{s.rarete_obtenue}</span>
              <span style={{ color: 'rgba(26,18,8,.55)', fontWeight: 700 }}> (tu en as {s.disponibles})</span>
            </div>
          ))}
          {sacrificeCourant && (
            <button
              onClick={sacrifier}
              disabled={!pretASacrifier}
              style={{
                width: '100%', marginTop: 8, font: '800 10px Rubik,Arial', padding: '10px 0',
                borderRadius: 10, border: '2px solid #1a1208',
                background: pretASacrifier ? 'var(--or)' : 'rgba(26,18,8,.2)',
                color: pretASacrifier ? '#1a1208' : 'rgba(26,18,8,.5)',
                cursor: pretASacrifier ? 'pointer' : 'default',
              }}
            >
              {selection.length} / {sacrificeCourant.requis} {rareteSelection} sélectionné(s)
              {pretASacrifier ? ` — OUVRIR UN COFFRE ${sacrificeCourant.rarete_obtenue.toUpperCase()}` : ''}
            </button>
          )}
        </div>
      )}

      {etat.inventaire.length === 0 ? (
        <div style={{ font: '700 10px Rubik,Arial', color: 'rgba(26,18,8,.65)' }}>
          Vide. Ouvre un coffre équipement dans l'onglet Coffres.
        </div>
      ) : (
        <>
          {!modeSacrifice && (
            <div style={{ font: '700 9px Rubik,Arial', color: 'rgba(26,18,8,.6)', marginBottom: 6 }}>
              Tape un objet pour l'équiper sur {courant?.nom ?? 'ton pirate'}.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {etat.inventaire.map((o) => (
              <CarteObjet
                key={o.id}
                objet={o}
                selectionne={selection.includes(o.id)}
                onClick={() => (modeSacrifice ? basculerSelection(o) : equiper(o))}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Confirmation de destruction d'un objet porté ───────────────── */}
      {aDetruire && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <div style={{ width: '100%', maxWidth: 320, background: '#c9a267', border: '4px solid #1a1208', borderRadius: 10, padding: 16, textAlign: 'center' }}>
            <div style={{ font: '400 18px Bangers,Rubik', color: '#1a1208', letterSpacing: 1, marginBottom: 10 }}>RECYCLER ?</div>
            <CarteObjet objet={aDetruire} style={{ marginBottom: 10 }} />
            <div style={{ font: '700 10px Rubik,Arial', color: 'rgba(26,18,8,.8)', marginBottom: 12 }}>
              Destruction définitive contre des Berrys.
              {aDetruire.collection_id !== null && <><br />C'est la seule façon de libérer le slot (§4ter).</>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setADetruire(null)} style={{ flex: 1, font: '800 10px Rubik,Arial', padding: '11px 0', borderRadius: 10, background: '#e9d9b0', color: '#1a1208', border: '2px solid #1a1208', cursor: 'pointer' }}>
                ANNULER
              </button>
              <button onClick={detruire} style={{ flex: 1, font: '800 10px Rubik,Arial', padding: '11px 0', borderRadius: 10, background: '#b34a4a', color: '#fff', border: '2px solid #1a1208', cursor: 'pointer' }}>
                ♻️ RECYCLER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Le coffre obtenu par sacrifice se compare au perso qu'on est en train de regarder. */}
      {resultat && (
        <FenetreResultat
          resultat={resultat}
          cibleNom={courant?.nom ?? null}
          cibleId={idCourant}
          onFini={(m) => { setMessage(m); setResultat(null); }}
          onChange={onChange}
        />
      )}
    </div>
  );
}
