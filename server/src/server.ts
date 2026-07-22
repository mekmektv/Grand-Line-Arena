// GRAND LINE ARENA — serveur HTTP. Brique 3 : uniquement la connexion Twitch.
//
// Volontairement sans framework (Express, Fastify...) : `node:http` suffit pour 4 routes,
// et ça garde le projet "zéro npm install" comme le reste (voir README).
//
// Routes :
//   GET  /auth/twitch/login     → redirige vers l'écran d'autorisation Twitch
//   GET  /auth/twitch/streamer/login → autorisation DU STREAMER, scopes élevés (Brique 6, ?cle=...)
//   GET  /auth/twitch/callback  → échange le code ; joueur (cookie) OU streamer (jeton stocké)
//   POST /webhooks/twitch/eventsub → notifications Twitch (redemption, stream online/offline)
//   GET  /cron/presence         → appelée par un cron externe toutes les 1 min (?cle=...)
//   POST /tirage/premium        → ouvre un coffre premium (consomme le stock, meilleurs taux)
//   POST /presence/encaisser    → encaisse les Berrys de présence en attente
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
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { env, verifierEnvAuDemarrage } from './env.ts';
import {
  creerCookieSession, lireCookieSession, parserCookies,
  NOM_COOKIE_SESSION, NOM_COOKIE_STATE, NOM_COOKIE_STATE_STREAMER,
} from './session.ts';
import { enregistrerTokenBroadcaster } from './twitch-broadcaster.ts';
import { verifierSignatureEventsub } from './twitch-eventsub.ts';
import {
  crediterCoffrePremium, marquerLiveDemarre, marquerLiveTermine, NOM_RECOMPENSE_TIRAGE_PREMIUM,
} from './twitch-live-api.ts';
import { crediterPresenceTousLesChatters, encaisserPresence } from './twitch-presence-api.ts';
import { ouvrirCoffrePremium } from './tirage-premium-api.ts';
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

async function lireCorpsBrut(req: IncomingMessage): Promise<string> {
  const morceaux: Buffer[] = [];
  for await (const morceau of req) morceaux.push(morceau as Buffer);
  return Buffer.concat(morceaux).toString('utf8');
}

async function lireCorpsJSON<T>(req: IncomingMessage): Promise<T> {
  const texte = await lireCorpsBrut(req);
  return texte ? JSON.parse(texte) : ({} as T);
}

const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';

function cookieAttributs(maxAgeSecondes: number): string {
  // Front et API sont servis par le MÊME domaine Vercel (le front à la racine, l'API sous
  // /api) : SameSite=Lax suffirait donc en production. On garde quand même None+Secure, qui
  // fonctionne dans les deux cas, pour que déplacer un jour l'API sur un autre domaine ne
  // rouvre pas le piège suivant — découvert en préparant le déploiement :
  //
  //   entre deux domaines, SameSite=Lax interdit au navigateur d'envoyer le cookie. Le joueur
  //   passait par Twitch avec succès, revenait… et restait « non connecté », en boucle et sans
  //   la moindre erreur pour l'expliquer.
  //
  // Les navigateurs exigent Secure dès qu'on met None : les deux vont ensemble, jamais l'un
  // sans l'autre. En local (http://localhost) Secure est refusé, d'où le Lax de repli.
  const enProduction = env.frontendUrl.startsWith('https://');
  const politique = enProduction ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `Path=/; HttpOnly; ${politique}; Max-Age=${maxAgeSecondes}`;
}

/**
 * Le routeur complet, extrait de createServer pour pouvoir servir DEUX contextes avec
 * exactement le même code (aucune duplication, donc aucune dérive possible entre les deux) :
 *   · en local, un vrai serveur node:http — voir le bas de ce fichier ;
 *   · en production, une fonction Vercel — voir api/[...chemin].ts.
 *
 * La signature (req, res) de node:http est précisément celle qu'attend une fonction Vercel :
 * il n'y a rien à réécrire, juste à exporter.
 */
export async function gererRequete(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

    if (url.pathname === '/auth/twitch/streamer/login' && req.method === 'GET') {
      // Route d'auto-autorisation DU STREAMER (Brique 6) : scopes élevés que seul le
      // propriétaire de la chaîne peut accorder, jamais demandés au login joueur normal.
      // Protégée par un secret en query string — sans ça, n'importe qui pourrait écraser le
      // jeton broadcaster avec le sien.
      if (url.searchParams.get('cle') !== env.twitchStreamerSecret) {
        res.writeHead(403).end('Accès refusé.');
        return;
      }
      const state = randomBytes(16).toString('hex');
      const params = new URLSearchParams({
        client_id: env.twitchClientId,
        redirect_uri: env.twitchRedirectUri,
        response_type: 'code',
        scope: 'moderator:read:chatters channel:read:redemptions channel:manage:redemptions',
        state,
      });
      res.setHeader('Set-Cookie', `${NOM_COOKIE_STATE_STREAMER}=${state}; ${cookieAttributs(600)}`);
      res.writeHead(302, { Location: `${TWITCH_AUTHORIZE_URL}?${params}` }).end();
      return;
    }

    if (url.pathname === '/auth/twitch/callback' && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const erreur = url.searchParams.get('error');

      // Même route de retour pour les deux flux (login joueur / autorisation streamer) : ça
      // évite d'enregistrer une 2e URL de redirection sur dev.twitch.tv. On les distingue par
      // le cookie state qui correspond, chacun posé par sa propre route de départ.
      const estFluxStreamer = !!state && state === cookies[NOM_COOKIE_STATE_STREAMER];

      if (erreur) {
        const cible = estFluxStreamer ? 'streamer=refuse' : 'login=refuse';
        res.writeHead(302, { Location: `${env.frontendUrl}/?${cible}` }).end();
        return;
      }
      if (!code || !state || (state !== cookies[NOM_COOKIE_STATE] && !estFluxStreamer)) {
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
      const tokenData = await tokenRes.json() as {
        access_token: string; refresh_token: string; expires_in: number;
      };

      if (estFluxStreamer) {
        await enregistrerTokenBroadcaster(tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
        res.setHeader('Set-Cookie', `${NOM_COOKIE_STATE_STREAMER}=; ${cookieAttributs(0)}`);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
          .end('Autorisation streamer enregistrée avec succès. Tu peux fermer cette page.');
        return;
      }

      const { access_token } = tokenData;

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

    if (url.pathname === '/webhooks/twitch/eventsub' && req.method === 'POST') {
      // URL PUBLIQUE appelable par n'importe qui : la signature est la SEULE protection, elle
      // doit être vérifiée avant même de regarder le contenu (voir twitch-eventsub.ts).
      const messageId = req.headers['twitch-eventsub-message-id'];
      const timestamp = req.headers['twitch-eventsub-message-timestamp'];
      const signature = req.headers['twitch-eventsub-message-signature'];
      const typeMessage = req.headers['twitch-eventsub-message-type'];
      const corpsBrut = await lireCorpsBrut(req);

      if (typeof messageId !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string') {
        res.writeHead(400).end('En-têtes EventSub manquants.');
        return;
      }
      const signatureValide = verifierSignatureEventsub({
        secret: env.twitchEventsubSecret, messageId, timestamp, corpsBrut, signatureRecue: signature,
      });
      if (!signatureValide) { res.writeHead(403).end('Signature invalide.'); return; }

      const corps = JSON.parse(corpsBrut) as {
        challenge?: string;
        subscription: { type: string };
        event?: Record<string, unknown>;
      };

      // Twitch vérifie que le endpoint est bien vivant en demandant de renvoyer `challenge`
      // tel quel, une seule fois à la création de l'abonnement.
      if (typeMessage === 'webhook_callback_verification') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end(corps.challenge ?? '');
        return;
      }
      if (typeMessage === 'revocation') { res.writeHead(200).end(); return; }

      if (typeMessage === 'notification' && corps.event) {
        switch (corps.subscription.type) {
          case 'channel.channel_points_custom_reward_redemption.add': {
            const event = corps.event as { user_id: string; reward: { title: string } };
            if (event.reward.title === NOM_RECOMPENSE_TIRAGE_PREMIUM) {
              await crediterCoffrePremium(event.user_id);
            }
            break;
          }
          case 'stream.online': {
            const event = corps.event as { broadcaster_user_id: string };
            await marquerLiveDemarre(event.broadcaster_user_id);
            break;
          }
          case 'stream.offline':
            await marquerLiveTermine();
            break;
        }
      }

      res.writeHead(200).end();
      return;
    }

    if (url.pathname === '/cron/presence' && req.method === 'GET') {
      // Appelée par un service externe (cron-job.org) toutes les 1 min — Vercel Cron ne permet
      // qu'un déclenchement par jour sur le plan gratuit, insuffisant ici (Brique 6).
      if (url.searchParams.get('cle') !== env.cronSecret) { res.writeHead(403).end('Accès refusé.'); return; }

      const resultat = await crediterPresenceTousLesChatters();
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(resultat));
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

    if (url.pathname === '/tirage/premium' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      try {
        const resultat = await ouvrirCoffrePremium(playerId);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200).end(JSON.stringify(resultat));
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ erreur: (e as Error).message }));
      }
      return;
    }

    if (url.pathname === '/presence/encaisser' && req.method === 'POST') {
      const playerId = lireCookieSession(cookies[NOM_COOKIE_SESSION]);
      if (!playerId) { res.writeHead(401).end(JSON.stringify({ erreur: 'non connecté' })); return; }

      const resultat = await encaisserPresence(playerId);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200).end(JSON.stringify(resultat));
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
}

// Démarrage LOCAL uniquement. Sur Vercel, ce fichier n'est jamais exécuté directement :
// c'est api/[...chemin].ts qui importe `gererRequete` — donc rien n'écoute de port, et ce
// bloc est ignoré.
//
// ⚠️ La vérification des variables d'environnement est DANS ce bloc, et non au chargement du
// module comme avant. Sur Vercel, une erreur levée à l'import se produit avant le moindre code
// à nous : la plateforme ne peut alors afficher qu'un « FUNCTION_INVOCATION_FAILED » muet, qui
// ne dit pas quelle variable manque. Ici, une variable absente remonte à la première requête
// qui la lit, et le try/catch de gererRequete en renvoie le message en clair.
// En local, on garde l'échec immédiat au démarrage : c'est plus utile que de le découvrir
// à la première requête.
if (process.env.VERCEL === undefined) {
  verifierEnvAuDemarrage();
  createServer(gererRequete).listen(env.port, () => {
    console.log(`Grand Line Arena — serveur d'auth Twitch sur http://localhost:${env.port}`);
    console.log(`  → connexion : http://localhost:${env.port}/auth/twitch/login`);
  });
}
