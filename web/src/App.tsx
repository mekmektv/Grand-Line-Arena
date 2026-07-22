import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  recupererEtat, recupererCollection, recupererClassement, changerPersoActif, lancerCombat,
  recupererQuetes, reclamerQuete, recupererEquipement, avancerOnboarding,
  ETAPE_PREMIER_TIRAGE, ETAPE_TUTO_ACCUEIL, ETAPE_COFFRE_OFFERT,
  ErreurAuth, type EtatJoueur, type CarteCollection, type Classement as ClassementData,
  type ResultatCombatComplet, type EtatQuetes, type EtatEquipement,
} from './api';
import { Login } from './screens/Login';
import { Accueil } from './screens/Accueil';
import { Collection } from './screens/Collection';
import { FichePerso } from './screens/FichePerso';
import { Tirage } from './screens/Tirage';
import { Classement } from './screens/Classement';
import { Combat } from './screens/Combat';
import { Quetes } from './screens/Quetes';
import { BottomNav, type Onglet } from './components/BottomNav';

type Statut =
  | { type: 'chargement' }
  | { type: 'deconnecte' }
  | { type: 'connecte'; etat: EtatJoueur }
  | { type: 'erreur'; message: string };

function App() {
  const [statut, setStatut] = useState<Statut>({ type: 'chargement' });
  const [onglet, setOnglet] = useState<Onglet>('accueil');
  const [collection, setCollection] = useState<CarteCollection[] | null>(null);
  const [classement, setClassement] = useState<ClassementData | null>(null);
  const [ficheOuverte, setFicheOuverte] = useState<CarteCollection | null>(null);
  const [combat, setCombat] = useState<ResultatCombatComplet | null>(null);
  const [quetes, setQuetes] = useState<EtatQuetes | null>(null);
  // §4ter : chargé dès la connexion, comme la collection — l'onglet Coffres et l'onglet
  // ÉQUIPEMENT le lisent tous les deux, et on ne veut pas d'un temps de chargement au tap.
  const [equipement, setEquipement] = useState<EtatEquipement | null>(null);
  const [quetesOuvertes, setQuetesOuvertes] = useState(false);
  const [lancementCombatEnCours, setLancementCombatEnCours] = useState(false);
  const [erreurCombat, setErreurCombat] = useState('');
  const [erreurIncarner, setErreurIncarner] = useState('');

  // L'avancement de l'arrivée (§4) vient du SERVEUR, pas d'un `?login=bienvenue` dans l'URL
  // comme avant : ce paramètre disparaissait au premier rechargement de page, et le joueur
  // perdait alors définitivement son tutoriel et son coffre offert en cours de route.

  const rafraichirEtat = useCallback(() => {
    recupererEtat().then((etat) => setStatut({ type: 'connecte', etat })).catch(() => {});
  }, []);

  useEffect(() => {
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
    recupererEtat()
      .then((etat) => setStatut({ type: 'connecte', etat }))
      .catch((e) => {
        if (e instanceof ErreurAuth) setStatut({ type: 'deconnecte' });
        else setStatut({ type: 'erreur', message: (e as Error).message });
      });
  }, []);

  // La collection est chargée dès la connexion, PAS seulement en ouvrant son onglet : la
  // roulette du tirage a besoin du catalogue complet pour peupler son ruban. Sans ça, un
  // joueur qui va droit sur COFFRES voyait 58 fois le même perso (chaque tuile retombant
  // sur le repli "perso gagnant").
  useEffect(() => {
    if (statut.type !== 'connecte') return;
    recupererCollection().then(setCollection).catch(() => {});
  }, [statut.type]);

  useEffect(() => {
    if (statut.type !== 'connecte') return;
    if (onglet === 'classement') recupererClassement().then(setClassement);
  }, [onglet, statut.type]);

  // Les quêtes sont chargées dès la connexion : l'encart de l'Accueil (§8) affiche la quête du
  // jour et sa progression, il ne doit pas attendre l'ouverture du panneau complet.
  const rafraichirQuetes = useCallback(() => {
    recupererQuetes().then(setQuetes).catch(() => {});
  }, []);

  useEffect(() => {
    if (statut.type !== 'connecte') return;
    rafraichirQuetes();
  }, [statut.type, rafraichirQuetes]);

  // Réclamer verse des Berrys (état) et fait basculer la quête en "réclamée" : les deux doivent
  // se resynchroniser. On recharge aussi la collection, car un succès de collection réclamé peut
  // rester affiché ailleurs.
  const reclamer = useCallback(async (cle: string) => {
    const resultat = await reclamerQuete(cle);
    if (resultat.ok) { rafraichirEtat(); rafraichirQuetes(); }
  }, [rafraichirEtat, rafraichirQuetes]);

  // Un tirage ou un recyclage change à la fois les Berrys (état) et la collection : les deux
  // écrans doivent se resynchroniser, sinon la carte recyclée reste affichée jusqu'au prochain
  // changement d'onglet.
  const rafraichirEquipement = useCallback(() => {
    recupererEquipement().then(setEquipement).catch(() => {});
  }, []);

  useEffect(() => {
    if (statut.type !== 'connecte') return;
    rafraichirEquipement();
  }, [statut.type, rafraichirEquipement]);

  const rafraichirTout = useCallback(() => {
    rafraichirEtat();
    recupererCollection().then(setCollection).catch(() => {});
    rafraichirEquipement();
  }, [rafraichirEtat, rafraichirEquipement]);

  const incarner = async (collectionId: number) => {
    const resultat = await changerPersoActif(collectionId);
    // Un changement peut être refusé (Berrys insuffisants depuis que les changements au-delà
    // du quota sont payants). Avant, l'échec était silencieux : la fiche se fermait et rien
    // ne se passait, sans que le joueur comprenne pourquoi.
    if (!resultat.ok) { setErreurIncarner(resultat.erreur); return; }
    setErreurIncarner('');
    rafraichirEtat();
    recupererCollection().then(setCollection);
    setFicheOuverte(null);
  };

  const combattre = async () => {
    setErreurCombat(''); setLancementCombatEnCours(true);
    try {
      const resultat = await lancerCombat();
      setCombat(resultat);
    } catch (e) {
      setErreurCombat((e as Error).message);
    } finally {
      setLancementCombatEnCours(false);
    }
  };

  // Un combat change la progression des quêtes (combats joués / gagnés) : on rafraîchit aussi.
  const quitterCombat = async () => {
    setCombat(null);

    // Dernière marche de l'arrivée (§4) : le premier combat vient d'être joué, on emmène le
    // joueur récupérer son coffre de bienvenue. Le changement d'onglet est volontaire — c'est
    // aussi ce qui lui fait découvrir que l'onglet Coffres existe.
    if (statut.type === 'connecte' && statut.etat.onboarding_etape === ETAPE_TUTO_ACCUEIL) {
      await avancerOnboarding(ETAPE_COFFRE_OFFERT);
      setOnglet('tirage');
    }

    rafraichirEtat();
    rafraichirQuetes();
  };

  // §8 : le combat est plein écran, en dehors de la nav du bas — priorité d'affichage absolue.
  if (combat) {
    return (
      <div className="pc-stage">
        <div className="pc-frame">
          <Combat combat={combat} onRetour={quitterCombat} onRejouer={() => { setCombat(null); combattre(); }} />
        </div>
      </div>
    );
  }

  // §4 : tant que le joueur n'a pas tiré son pirate de départ, il n'y a rien à lui montrer —
  // pas d'Accueil (aucun perso actif), pas de collection, pas de nav du bas. Plein écran,
  // avant tout le reste, exactement comme le combat.
  if (statut.type === 'connecte' && statut.etat.onboarding_etape === ETAPE_PREMIER_TIRAGE) {
    return (
      <div className="pc-stage">
        <div className="pc-frame">
          <Tirage
            berrys={0}
            catalogue={collection ?? []}
            equipement={null}
            persoActifId={null}
            persoActifNom={null}
            onIncarnerDepuisTirage={incarner}
            onEtatChange={rafraichirTout}
            onboarding={{
              variante: 'premier',
              titre: 'DÉBLOQUE TON PREMIER PIRATE',
              sousTitre: 'Tout équipage commence quelque part. Ouvre ce coffre pour découvrir qui tu incarnes.',
              onTermine: rafraichirTout,
            }}
          />
        </div>
      </div>
    );
  }

  let contenu: ReactNode;
  let afficherNav = false;

  if (statut.type === 'chargement') {
    contenu = <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texte)' }}>Chargement…</div>;
  } else if (statut.type === 'deconnecte') {
    contenu = <Login />;
  } else if (statut.type === 'erreur') {
    contenu = (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--texte)' }}>
        Erreur de connexion au serveur : {statut.message}
        <br />
        (le serveur (`node server/src/server.ts`) tourne-t-il bien ?)
      </div>
    );
  } else {
    afficherNav = true;
    const etat = statut.etat;

    if (quetesOuvertes) {
      contenu = quetes
        ? <Quetes quetes={quetes} onRetour={() => setQuetesOuvertes(false)} onReclamer={reclamer} />
        : <div style={{ padding: 40, textAlign: 'center', color: 'var(--texte)' }}>Chargement…</div>;
    } else if (ficheOuverte) {
      contenu = (
        <FichePerso
          carte={ficheOuverte}
          changementsRestants={etat.changements_restants}
          prochainChangementCout={etat.prochain_changement_cout}
          erreur={erreurIncarner}
          onRetour={() => { setErreurIncarner(''); setFicheOuverte(null); }}
          onIncarner={() => incarner(ficheOuverte.collection_id!)}
        />
      );
    } else if (onglet === 'accueil') {
      contenu = (
        <>
          <Accueil
            etat={etat}
            queteJour={quetes?.jour ?? null}
            queteSemaine={quetes?.semaine ?? null}
            montrerTuto={etat.onboarding_etape === ETAPE_TUTO_ACCUEIL}
            onCombattre={combattre}
            onOuvrirQuetes={() => setQuetesOuvertes(true)}
            onReclamer={reclamer}
          />
          {lancementCombatEnCours && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 20 }}>
              Préparation du combat…
            </div>
          )}
          {erreurCombat && (
            <div style={{ position: 'absolute', bottom: 90, left: 16, right: 16, background: '#1a1208', border: '2px solid var(--rose)', borderRadius: 10, padding: 10, color: 'var(--texte)', fontSize: 12, textAlign: 'center', zIndex: 20 }}>
              {erreurCombat}
            </div>
          )}
        </>
      );
    } else if (onglet === 'collection') {
      contenu = collection
        ? (
          <Collection
            cartes={collection}
            equipement={equipement}
            onOuvrirFiche={setFicheOuverte}
            onRecyclage={rafraichirTout}
          />
        )
        : <div style={{ padding: 40, textAlign: 'center', color: 'var(--texte)' }}>Chargement…</div>;
    } else if (onglet === 'tirage') {
      // Le catalogue complet alimente la roulette du tirage (portraits de tous les persos,
      // possédés ou non). Il est déjà chargé au démarrage, donc rien de plus à attendre.
      contenu = (
        <Tirage
          berrys={etat.berrys}
          catalogue={collection ?? []}
          equipement={equipement}
          persoActifId={etat.perso_actif?.collection_id ?? null}
          persoActifNom={etat.perso_actif?.nom ?? null}
          onIncarnerDepuisTirage={incarner}
          onEtatChange={rafraichirTout}
          onboarding={etat.onboarding_etape === ETAPE_COFFRE_OFFERT
            ? {
              variante: 'coffre-offert',
              titre: 'UN COFFRE T\'ATTEND',
              sousTitre: 'Pour fêter ton arrivée en mer, l\'équipage t\'offre un coffre. Bon vent, pirate !',
              onTermine: rafraichirTout,
            }
            : null}
        />
      );
    } else {
      contenu = classement
        ? <Classement classement={classement} />
        : <div style={{ padding: 40, textAlign: 'center', color: 'var(--texte)' }}>Chargement…</div>;
    }
  }

  return (
    <div className="pc-stage">
      <div className="pc-frame">
        <div className="op-noscroll">{contenu}</div>
        {/* La nav reste HORS de la zone de scroll (comme le prototype), sinon elle défile avec le contenu. */}
        {afficherNav && !ficheOuverte && !quetesOuvertes && <BottomNav actif={onglet} onChange={setOnglet} />}
      </div>
    </div>
  );
}

export default App;
