import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { recyclerPerso, type CarteCollection, type EtatEquipement } from '../api';
import { Berry } from '../components/Berry';
import { InventaireEquipement } from '../components/Equipement';

const COULEUR_CLASSE: Record<string, string> = {
  Haki: 'var(--classe-haki)', Logia: 'var(--classe-logia)', Paramecia: 'var(--classe-paramecia)',
  Zoan: 'var(--classe-zoan)', Sniper: 'var(--classe-sniper)', Sabreur: 'var(--classe-sabreur)',
};
const COULEUR_RARETE: Record<string, string> = {
  Commun: 'var(--rarete-commun)', 'Peu commun': 'var(--rarete-peu-commun)', Rare: 'var(--rarete-rare)',
  Epique: 'var(--rarete-epique)', Legendaire: 'var(--rarete-legendaire)',
};
const CLASSES = ['Haki', 'Logia', 'Paramecia', 'Zoan', 'Sniper', 'Sabreur'];
const RARETES = ['Commun', 'Peu commun', 'Rare', 'Epique', 'Legendaire'];

/** La silhouette d'un perso encore à débloquer, sur fond parchemin façon avis de recherche.
 *
 *  `mix-blend-mode: multiply` : le blanc de l'image se fond dans le parchemin et seul le noir
 *  reste. Ça marche que le PNG ait un fond transparent ou un fond blanc — donc pas de mauvaise
 *  surprise selon la façon dont le fichier a été exporté.
 *
 *  Replie sur l'ancien aplat sombre si le fichier est absent, pour ne jamais afficher l'icône
 *  d'image cassée dans la grille. */
function SilhouetteVerrouillee() {
  const [manquante, setManquante] = useState(false);
  return (
    <div style={{
      height: 66, marginTop: 2, background: manquante ? '#123540' : '#c9a267',
      border: '1.5px solid rgba(26,18,8,.35)', opacity: manquante ? 0.5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}
    >
      {!manquante && (
        <img
          src="/perso-verrouille.png"
          alt=""
          onError={() => setManquante(true)}
          style={{ maxHeight: '92%', maxWidth: '80%', objectFit: 'contain', mixBlendMode: 'multiply', opacity: 0.75 }}
        />
      )}
    </div>
  );
}

const chipStyle = (actif: boolean, couleur: string): CSSProperties => ({
  flex: 'none', font: '800 11px Rubik,Arial', padding: '7px 12px', borderRadius: 20,
  background: actif ? couleur : 'rgba(20,48,60,.95)', color: actif ? '#1a1208' : '#e9d9b0',
  border: `2px solid ${actif ? '#1a1208' : couleur}`,
});

// §8 point 4 : grille 3/ligne, filtres classe/rareté, compteur "X/16", perso actif marqué.
// L'onglet ÉQUIPEMENT tient l'INVENTAIRE (§4ter) : ce que porte chaque pirate, et les objets
// en réserve. Le coffre, lui, reste dans l'onglet Coffres — c'est là qu'on dépense des Berrys.
//
// Le recyclage a deux entrées, comme demandé : ici (bouton ♻️ → mode recyclage) et directement
// sur l'écran de tirage au moment du drop. Les deux tapent le même POST /recycler.
export function Collection({ cartes, equipement, onOuvrirFiche, onRecyclage }: {
  cartes: CarteCollection[];
  /** §4ter. null tant que /equipement n'a pas répondu. */
  equipement: EtatEquipement | null;
  onOuvrirFiche: (c: CarteCollection) => void;
  onRecyclage: () => void;
}) {
  const [filtreClasse, setFiltreClasse] = useState<string | null>(null);
  const [filtreRarete, setFiltreRarete] = useState<string | null>(null);
  const [ongletEquip, setOngletEquip] = useState(false);
  // Mode recyclage : un tap sur une carte ne l'ouvre plus, il propose de la recycler.
  // Un mode explicite plutôt qu'un bouton par carte — sinon on recycle un Épique par erreur.
  const [modeRecyclage, setModeRecyclage] = useState(false);
  const [aConfirmer, setAConfirmer] = useState<CarteCollection | null>(null);
  // ReactNode et non string : le message contient le logo Berry, qui est un composant.
  const [message, setMessage] = useState<ReactNode>(null);

  const confirmerRecyclage = async () => {
    if (!aConfirmer?.collection_id) return;
    const r = await recyclerPerso(aConfirmer.collection_id);
    setMessage(r.ok
      ? <>♻️ {r.nom} recyclé — +{r.berrys_gagnes} <Berry size={12} /></>
      : r.erreur);
    setAConfirmer(null);
    if (r.ok) onRecyclage();
  };

  const auClicCarte = (c: CarteCollection) => {
    if (!c.possede) return;
    if (!modeRecyclage) { onOuvrirFiche(c); return; }
    if (c.actif) { setMessage('Impossible de recycler ton pirate actif — incarne-en un autre d\'abord.'); return; }
    setMessage(null);
    setAConfirmer(c);
  };

  const filtrees = useMemo(() => cartes
    .filter((c) => (
      (!filtreClasse || c.classe === filtreClasse) && (!filtreRarete || c.rarete === filtreRarete)
    ))
    // Les persos débloqués d'abord, les verrouillés ensuite.
    .sort((a, b) => Number(b.possede) - Number(a.possede)),
  [cartes, filtreClasse, filtreRarete]);

  const possedees = cartes.filter((c) => c.possede).length;

  return (
    <div style={{
      minHeight: '100%', backgroundColor: '#c9a267',
      backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,.1) 0 3px, transparent 3px 56px),'
        + 'repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 40px)',
    }}
    >
      <div style={{ padding: '22px 14px 4px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', background: '#5c3a1a', border: '3px solid #1a1208', borderRadius: 6,
          padding: '8px 20px 9px', boxShadow: '0 5px 0 rgba(0,0,0,.35)',
        }}
        >
          <div style={{ font: '400 20px/1 Bangers,Rubik', letterSpacing: 2, color: 'var(--or)', textShadow: '2px 2px 0 #1a1208' }}>COLLECTION</div>
          <div style={{ font: '800 9px Rubik,Arial', color: '#e9d9b0', marginTop: 3, letterSpacing: 0.5 }}>{possedees} / {cartes.length} pirates</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', alignItems: 'stretch' }}>
        <button
          onClick={() => setOngletEquip(false)}
          style={{
            flex: 1, font: '400 13px Bangers,Rubik', letterSpacing: 1, padding: 9, borderRadius: 10,
            background: !ongletEquip ? 'var(--or)' : 'rgba(20,48,60,.95)', color: !ongletEquip ? '#1a1208' : '#e9d9b0',
            border: '2px solid #1a1208', boxShadow: '0 3px 0 rgba(0,0,0,.3)',
          }}
        >
          PIRATES
        </button>
        <button
          onClick={() => setOngletEquip(true)}
          style={{
            flex: 1, font: '400 13px Bangers,Rubik', letterSpacing: 1, padding: 9, borderRadius: 10,
            background: ongletEquip ? 'var(--or)' : 'rgba(20,48,60,.95)', color: ongletEquip ? '#1a1208' : '#e9d9b0',
            border: '2px solid #1a1208', boxShadow: '0 3px 0 rgba(0,0,0,.3)',
          }}
        >
          ÉQUIPEMENT
        </button>
        <button
          onClick={() => { setModeRecyclage((v) => !v); setAConfirmer(null); setMessage(null); }}
          title="Recycler"
          style={{
            flex: 'none', minWidth: 42, font: '800 13px Rubik,Arial', borderRadius: 10,
            background: modeRecyclage ? 'var(--rose)' : 'rgba(20,48,60,.95)', color: '#e9d9b0',
            border: '2px solid #1a1208', boxShadow: '0 3px 0 rgba(0,0,0,.3)', padding: '0 8px',
          }}
        >
          ♻️
        </button>
      </div>
      {modeRecyclage && !ongletEquip && (
        <div style={{ margin: '8px 16px 0', font: '700 10px Rubik,Arial', color: '#fff', background: 'var(--rose)', border: '2px solid #1a1208', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          Mode recyclage — touche un pirate pour l'échanger contre des Berrys.
        </div>
      )}
      {message && (
        <div style={{ margin: '8px 16px 0', font: '700 10px Rubik,Arial', color: '#5c3a1a', background: '#e9d9b0', border: '2px solid #1a1208', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          {message}
        </div>
      )}
      {aConfirmer && (
        <div style={{ margin: '8px 16px 0', background: '#14303c', border: '2px solid var(--or)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ font: '800 11px Rubik,Arial', color: '#e9d9b0', marginBottom: 8 }}>
            Recycler <b style={{ color: 'var(--or)' }}>{aConfirmer.nom}</b> ({aConfirmer.rarete}) ? C'est définitif.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setAConfirmer(null)} style={{ font: '800 11px Rubik,Arial', background: 'transparent', color: '#e9d9b0', border: '2px solid #e9d9b0', borderRadius: 8, padding: '7px 14px' }}>
              ANNULER
            </button>
            <button onClick={confirmerRecyclage} style={{ font: '800 11px Rubik,Arial', background: 'var(--rose)', color: '#fff', border: '2px solid #000', borderRadius: 8, padding: '7px 14px', boxShadow: '0 3px 0 #000' }}>
              ♻️ RECYCLER
            </button>
          </div>
        </div>
      )}

      {ongletEquip ? (
        <InventaireEquipement etat={equipement} cartes={cartes} onChange={onRecyclage} />
      ) : (
        <>
          <div className="chip-row" style={{ padding: '12px 16px 4px' }}>
            <button onClick={() => setFiltreClasse(null)} style={chipStyle(filtreClasse === null, 'var(--or)')}>TOUS</button>
            {CLASSES.map((c) => (
              <button key={c} onClick={() => setFiltreClasse(c)} style={chipStyle(filtreClasse === c, COULEUR_CLASSE[c])}>{c}</button>
            ))}
          </div>
          <div className="chip-row" style={{ padding: '2px 16px 8px' }}>
            <button onClick={() => setFiltreRarete(null)} style={chipStyle(filtreRarete === null, 'var(--or)')}>TOUTES</button>
            {RARETES.map((r) => (
              <button key={r} onClick={() => setFiltreRarete(r)} style={chipStyle(filtreRarete === r, COULEUR_RARETE[r])}>{r}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 16px 20px' }}>
            {filtrees.map((c) => (
              <div
                key={c.character_id}
                onClick={() => auClicCarte(c)}
                style={{
                  cursor: c.possede ? 'pointer' : 'default', background: c.possede ? '#e9d9b0' : '#d9c49a',
                  // En mode recyclage, le perso actif est visiblement hors-jeu : il ne peut pas
                  // être recyclé, autant que ça se voie avant le tap.
                  opacity: modeRecyclage && c.possede && c.actif ? 0.45 : 1,
                  borderRadius: 3, padding: '5px 5px 6px', display: 'flex', flexDirection: 'column', gap: 3,
                  border: '2px solid #1a1208', outline: `2px solid ${c.possede ? COULEUR_RARETE[c.rarete] : 'rgba(26,18,8,.35)'}`,
                  outlineOffset: -5, boxShadow: '2px 3px 0 rgba(0,0,0,.3)', position: 'relative',
                }}
              >
                {c.actif && (
                  <div style={{ position: 'absolute', top: -7, left: -7, background: 'var(--or)', color: '#1a1208', font: '800 9px Rubik,Arial', padding: '2px 5px', borderRadius: 6, border: '2px solid #1a1208', zIndex: 2 }}>★</div>
                )}
                {c.possede ? (
                  <>
                    <div style={{ position: 'relative', height: 74 }}>
                      {/* Cadre interne avec son propre overflow:hidden — le badge de niveau (à cheval
                          sur le bord) est un frère de ce cadre, jamais rogné par lui (même bug qu'Accueil). */}
                      <div style={{ position: 'absolute', inset: 0, background: '#123540', border: '1.5px solid #1a1208', overflow: 'hidden' }}>
                        {c.image_menu_url
                          ? <img src={c.image_menu_url} alt={c.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(42,26,13,.45)', font: "700 8px 'Courier New',monospace" }}>SPRITE</div>}
                      </div>
                      <div style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: '50%', background: '#14303c', border: `2.5px solid ${COULEUR_RARETE[c.rarete]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 10px Rubik,Arial', color: '#efe7d6', zIndex: 1 }}>
                        {c.niveau}
                      </div>
                    </div>
                    <div style={{ font: '400 12px Bangers,Rubik', letterSpacing: 0.5, color: '#1a1208', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', textTransform: 'uppercase' }}>
                      {c.nom}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ background: COULEUR_CLASSE[c.classe], color: '#fff', font: '800 7.5px Rubik,Arial', padding: '2px 7px', borderRadius: 10 }}>{c.classe}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ font: '400 9px/1 Bangers,Rubik', letterSpacing: 1, color: '#8a2f1f', textAlign: 'center', borderBottom: '1.5px solid rgba(26,18,8,.5)', paddingBottom: 2 }}>
                      DEAD OR ALIVE
                    </div>
                    <SilhouetteVerrouillee />
                    <div style={{ font: '400 12px Bangers,Rubik', letterSpacing: 0.5, color: '#1a1208', textAlign: 'center' }}>???</div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ background: 'rgba(26,18,8,.14)', color: 'rgba(26,18,8,.55)', font: '800 7px Rubik,Arial', padding: '2px 8px', borderRadius: 10, letterSpacing: 0.5 }}>À CAPTURER</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
