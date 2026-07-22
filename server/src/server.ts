// ONE PIECE ARENA — serveur HTTP. Brique 3 : uniquement la connexion Twitch.
//
// Volontairement sans framework (Express, Fastify...) : `node:http` suffit pour 4 routes,
// et ça garde le projet "zéro npm install" comme le reste (voir README).
//
// Routes :
//   GET  /auth/twitch/login     → redirige vers l'écran d'autorisation Twitch
//   GET  /auth/twitch/callback  → échange le code, crée/retrouve le joueur, pose le cookie
//   GET  /me                    → l'état du joueur connecté (lit le cookie de session)
//   GET  /etat                  → l'écran Accueil (perso actif, Berrys, énergie)
//   GET  /collection            → le catalogue complet (possédés + verrouillés)
//   POST /perso-actif           → change de perso actif { collection_id }
//   POST /tirage                → tire un perso (§3bis/§4)
//   POST /recycler              → recycle un perso possédé contre des Berrys { collection_id }
//   GET  /classement            → classement des joueurs
//   GET  /quetes                → l'état des quêtes du joueur (jour, semaine, collection) (§8)
//   POST /quetes/reclamer       → réclame la récompense d'une quête accomplie { cle }
//   GET  /equipement            → inventaire, objets portés, pièces, échanges (§4ter)
//   POST /coffre                → ouvre un coffre : {} en Berrys, { sacrifier:[ids] } par sacrifice
//   POST /equipement/equiper    → soude un objet sur un perso { equipement_id, collection_id }
//   POST /equipement/recycler   → détruit un objet contre des Berrys { equipement_id }
//   POST /combat                → lance un combat réel (§6/§7/§8)
//   POST /logout                → efface le cookie
//
// Lancer :  node server/src/server.ts   (après avoir rempli server/.env, voir README)

import './load-env.ts';
import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes } from 'node:crypto';
import { env, verifierEnvAuDemarrage } from './env.ts';
import {
  creerCookieSession, lireCookieSession, parserCookies, NOM_COOKIE_SESSION, NOM_COOKIE_STATE,
} from './session.ts';
import { supabaseSelectUn } from './supabase.ts';
import { lireEtatJoueur } from './etat-joueur.ts';
import { listerCollection } from './collection.ts';
import { changerPersoActif } from './perso-actif.ts';
import { effectuerTirage, effectuerPremierTirage } from './tirage-api.ts';
import {
  connecterOuCreerJoueur, avancerOnboarding, ETAPE_COFFRE_OFFERT, ETAPE_TERMINE,
} from './onboarding.ts';
import { lireClassement } from './classement.ts';
import { lancerCombat } from './combat-api.ts';
import { recyclerPerso } from './recyclage.ts';
import { lireQuetes, reclamerQuete } from './quetes-api.ts';
import {
  lireEquipement, ouvrirCoffreJoueur, equiperObjet, recyclerEquipement,
} from './equipement-api.ts';
import type { PaiementRequete } from './equipement-api.ts';

verifierEnvAuDemarrage();

async function lireCorpsJSON<T>(req: IncomingMessage): Promise<T> {
  const morceaux: Buffer[] = [];
  for await (const morceau of req) morceaux.push(morceau as Buffer);
  const texte = Buffer.concat(morceaux).toString('utf8');
  return texte ? JSON.parse(texte) : ({} as T);
}

const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';

function cookieAttributs(maxAgeSecondes: number): string {
  // ⚠️ En production, le front (Vercel) et l'API (Railway) sont sur deux domaines DIFFÉRENTS :
  // toute requête du front vers l'API est donc "cross-site". Or SameSite=Lax interdit au
  // navigateur d'envoyer le cookie dans ce cas — le joueur se connectait via Twitch avec
  // succès, puis restait "non connecté" en boucle, sans la moindre erreur pour l'expliquer.
  // SameSite=None lève l'interdiction, mais les navigateurs l'exigent accompagné de Secure
  // (donc https) : les deux vont ensemble, jamais l'un sans l'autre.
  //
  // En local, front et API sont tous deux en http://localhost : même site, et Secure y est
  // refusé faute d'https. On garde donc Lax, qui est aussi le choix le plus sûr.
  const enProduction = env.frontendUrl.startsWith('https://');
  const politique = enProduction ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `Path=/; HttpOnly; ${politique}; Max-Age=${maxAgeSecondes}`;
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const cookies = parserCookies(req.headers.cookie);

  // CORS : le frontend (autre origine en dev) doit pouvoir envoyer le cookie de session.
  res.setHeader('Access-Control-Allow-Origin', env.frontendUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  try {
    if (url.pathname === '/auth/dev/login' && req.method === 'GET') {
      // Connexion SANS Twitch, pour développer/tester avant d'avoir créé l'app sur
      // dev.twitch.tv. Même chemin d'onboarding que le vrai login (connecterOuCreerJoueur ne
      // sait même pas que ce twitch_id est faux) — brancher le vrai Twitch plus tard ne
      // changera rien à cette logique. Doit être explicitement activé (DEV_AUTH_ENABLED=true)
      // pour ne jamais se retrouver ouvert par erreur une fois Twitch branché.
      if (!env.devAuthEnabled) { res.writeHead(404).end('Not found'); return; }

      const pseudo = (url.searchParams.get('pseudo') ?? 'Testeur').trim() || 'Testeur';
      // twitch_id déterministe à partir du pseudo : se reconnecter avec le même pseudo
      // retrouve le même joueur (comme un vrai retour sur Twitch), au lieu d'en recréer un.
      const twitchIdFactice = `dev-${pseudo.toLowerCase()}`;

      const joueur = await connecterOuCreerJoueur(twitchIdFactice, pseudo);
      const cookieSession = creerCookieSession(joueur.id);
      res.setHeader('Set-Cookie', `${NOM_COOKIE_SESSION}=${cookieSession}; ${cookieAttributs(30 * 24 * 3600)}`);
      const suffixe = joueur.nouveau_joueur ? 'bienvenue' : 'ok';
      res.writeHead(302, { Location: `${env.frontendUrl}/?login=${suffixe}` }).end();
      return;
    }

    if (url.pathname === '/auth/twitch/login' && req.method === 'GET') {
      const state = randomBytes(16).toString('hex');
      const params = new URLSearchParams({
        client_id: env.twitchClientId,
        redirect_uri: env.twitchRedirectUri,
        response_type: 'code',
        scope: '', // Brique 3 : identité seule. La présence live (Brique 6) ajoutera un scope.
        state,
      });
      res.setHeader('Set-Cookie', `${NOM_COOKIE_STATE}=${state}; ${cookieAttributs(600)}`);
      res.writeHead(302, { Location: `${TWITCH_AUTHORIZE_URL}?${params}` }).end();
      return;
    }

    if (url.pathname === '/auth/twitch/callback' && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const erreur = url.searchParams.get('error');

      if (erreur) {
        res.writeHead(302, { Location: `${env.frontendUrl}/?login=refuse` }).end();
        return;
      }
      if (!code || !state || state !== cookies[NOM_COOKIE_STATE]) {
        res.writeHead(400).end('État OAuth invalide ou expiré (rejoue /auth/twitch/login).');
        return;
      }

      const tokenRes = await fetch(TWITCH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.twitchClientId,
          client_secret: env.twitchClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: env.twitchRedirectUri,
        }),
      });
      if (!tokenRes.ok) {
        res.writeHead(502).end(`Échange de token Twitch échoué : ${tokenRes.status} ${await tokenRes.text()}`);
        return;
      }
      const { access_token } = (await tokenRes.json()) as { access_token: string };

      const userRes = await fetch(TWITCH_USERS_URL, {
        headers: { Authorization: `Bearer ${access_token}`, 'Client-Id': env.twitchClientId },
      });
      if (!userRes.ok) {
        res.writeHead(502).end(`Lecture du profil Twitch échouée : ${userRes.status} ${await userRes.text()}`);
        return;
      }
      const { data } = (await userRes.json()) as {
        data: { id: string; login: string; display_name: string; profile_image_url?: string }[];
      };
      const twitchUser = data[0];
      if (!twitchUser) { res.writeHead(502).end('Twitch n\'a renvoyé aucun profil.'); return; }

      // profile_image_url est renvoyé sans scope particulier (c'est une donnée publique).
      // Optionnel malgré tout : un compte sans photo n'a pas ce champ.
      const joueur = await connecterOuCreerJoueur(
        twitchUser.id, twitchUser.display_name, twitchUser.profile_image_url ?? null,
      );

      const cookieSession = creerCookieSession(joueur.id);
      res.setHeader('Set-Cookie', [
        `${NOM_COOKIE_SESSION}=${cookieSession}; ${cookieAttributs(30 * 24 * 3600)}`,
        `${NOM_COOKIE_STATE}=; ${cookieAttributs(0)}`, // efface le cookie state, il ne sert plus
      ]);
      const suffixe = joueur.nouveau_joueur ? 'bienvenue' : 'ok';
      res.writeHead(302, { Location: `${env.frontendUrl}/?login=${suffixe}` }).end();
      return;
    }

    if (url.pathname === '/me' && req.method === 'GET') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const joueur = await supabaseSelectUn('players', { id: `eq.${playerId}`, select: '*' });
      if (!joueur) { res.writeHead(401).end(JSON.stringify({ erreur: 'session invalide' })); return; }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(joueur));
      return;
    }

    if (url.pathname === '/etat' && req.method === 'GET') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const etat = await lireEtatJoueur(playerId);
      if (!etat) { res.writeHead(401).end(JSON.stringify({ erreur: 'session invalide' })); return; }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(etat));
      return;
    }

    if (url.pathname === '/collection' && req.method === 'GET') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const cartes = await listerCollection(playerId);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(cartes));
      return;
    }

    if (url.pathname === '/perso-actif' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const { collection_id } = await lireCorpsJSON<{ collection_id: number }>(req);
      const resultat = await changerPersoActif(playerId, collection_id);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resultat.ok ? 200 : 400).end(JSON.stringify(resultat));
      return;
    }

    if (url.pathname === '/tirage' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      try {
        const resultat = await effectuerTirage(playerId);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        // Le message de tirer() (ex: Berrys insuffisants) est déjà clair pour l'utilisateur.
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    // ── Onboarding (§4) ────────────────────────────────────────────────────
    // Le tirage de départ, forcé Commun et gratuit. C'est le serveur qui décide du perso :
    // le front ne fait que rejouer l'animation, comme pour le combat.
    if (url.pathname === '/onboarding/premier-tirage' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      try {
        const resultat = await effectuerPremierTirage(playerId);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    // Le coffre offert "pour fêter ton arrivée en mer", à la toute fin de l'onboarding :
    // un tirage aux taux NORMAUX, simplement gratuit.
    if (url.pathname === '/onboarding/tirage-offert' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const joueur = await supabaseSelectUn<{ onboarding_etape: number }>(
        'players', { id: `eq.${playerId}`, select: 'onboarding_etape' },
      );
      // Vérifié côté serveur et pas seulement côté front : sans ça, n'importe qui pourrait
      // rappeler cette route pour s'offrir des tirages gratuits à volonté.
      if (!joueur || joueur.onboarding_etape !== ETAPE_COFFRE_OFFERT) {
        res.writeHead(400).end(JSON.stringify({ erreur: 'Aucun coffre offert en attente.' }));
        return;
      }

      try {
        const resultat = await effectuerTirage(playerId, { gratuit: true });
        await avancerOnboarding(playerId, ETAPE_TERMINE);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    if (url.pathname === '/onboarding/etape' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const { etape } = await lireCorpsJSON<{ etape: number }>(req);
      if (typeof etape !== 'number' || etape < 0 || etape > ETAPE_TERMINE) {
        res.writeHead(400).end(JSON.stringify({ erreur: 'Étape invalide.' }));
        return;
      }

      const nouvelle = await avancerOnboarding(playerId, etape);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify({ onboarding_etape: nouvelle }));
      return;
    }

    if (url.pathname === '/recycler' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const { collection_id } = await lireCorpsJSON<{ collection_id: number }>(req);
      const resultat = await recyclerPerso(playerId, collection_id);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resultat.ok ? 200 : 400).end(JSON.stringify(resultat));
      return;
    }

    // ---------------------------------------------------------------------
    // §4ter : l'équipement
    // ---------------------------------------------------------------------
    if (url.pathname === '/equipement' && req.method === 'GET') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const etat = await lireEquipement(playerId);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(etat));
      return;
    }

    if (url.pathname === '/coffre' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      // Corps vide = coffre payé en Berrys. `{ sacrifier: [ids] }` = destruction de N objets
      // de l'inventaire contre un coffre garanti de la rareté au-dessus (§4ter).
      // `cible` = le perso auquel comparer le résultat (le perso actif si absent).
      const corps = await lireCorpsJSON<{ sacrifier?: number[]; cible?: number }>(req)
        .catch(() => ({} as { sacrifier?: number[]; cible?: number }));
      const paiement: PaiementRequete = corps.sacrifier?.length
        ? { mode: 'sacrifice', ids: corps.sacrifier }
        : { mode: 'berrys' };

      try {
        const resultat = await ouvrirCoffreJoueur(playerId, paiement, corps.cible ?? null);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        // Les messages d'ouvrirCoffre() (Berrys ou pièces insuffisants) sont déjà lisibles.
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    if (url.pathname === '/equipement/equiper' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const { equipement_id, collection_id } = await lireCorpsJSON<{ equipement_id: number; collection_id: number }>(req);
      try {
        const resultat = await equiperObjet(playerId, equipement_id, collection_id);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        // Cas le plus courant : le slot est déjà occupé. Le message dit quoi recycler.
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    if (url.pathname === '/equipement/recycler' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const { equipement_id } = await lireCorpsJSON<{ equipement_id: number }>(req);
      try {
        const resultat = await recyclerEquipement(playerId, equipement_id);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    if (url.pathname === '/quetes' && req.method === 'GET') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const quetes = await lireQuetes(playerId);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(quetes));
      return;
    }

    if (url.pathname === '/quetes/reclamer' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const { cle } = await lireCorpsJSON<{ cle: string }>(req);
      const resultat = await reclamerQuete(playerId, cle);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resultat.ok ? 200 : 400).end(JSON.stringify(resultat));
      return;
    }

    if (url.pathname === '/classement' && req.method === 'GET') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const classement = await lireClassement(playerId);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(classement));
      return;
    }

    if (url.pathname === '/combat' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      try {
        const resultat = await lancerCombat(playerId);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    if (url.pathname === '/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', `${NOM_COOKIE_SESSION}=; ${cookieAttributs(0)}`);
      res.writeHead(204).end();
      return;
    }

    res.writeHead(404).end('Not found');
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(`Erreur serveur : ${(e as Error).message}`);
  }
});

serveur.listen(env.port, () => {
  console.log(`One Piece Arena — serveur d'auth Twitch sur http://localhost:${env.port}`);
  console.log(`  → connexion : http://localhost:${env.port}/auth/twitch/login`);
});
