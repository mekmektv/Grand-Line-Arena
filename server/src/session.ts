// ONE PIECE ARENA — session joueur : un cookie signé (HMAC), pas de table `sessions`.
//
// Le cookie contient `{ playerId, expire }` encodé en base64url, suivi d'une signature
// HMAC-SHA256. Le serveur est la seule autorité (clé secrète jamais envoyée au client) :
// falsifier le cookie change la signature, donc `verifierSession` le rejette.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.ts';

const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

interface PayloadSession {
  playerId: string;
  expire: number;
}

function signer(donnees: string): string {
  return createHmac('sha256', env.sessionSecret).update(donnees).digest('base64url');
}

export function creerCookieSession(playerId: string): string {
  const payload: PayloadSession = { playerId, expire: Date.now() + DUREE_SESSION_MS };
  const donnees = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signer(donnees);
  return `${donnees}.${signature}`;
}

export function lireCookieSession(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const [donnees, signature] = cookie.split('.');
  if (!donnees || !signature) return null;

  const signatureAttendue = signer(donnees);
  const a = Buffer.from(signature);
  const b = Buffer.from(signatureAttendue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(donnees, 'base64url').toString('utf8')) as PayloadSession;
    if (payload.expire < Date.now()) return null;
    return payload.playerId;
  } catch {
    return null;
  }
}

/** Parse l'en-tête `Cookie:` brut d'une requête HTTP en objet clé/valeur. */
export function parserCookies(enteteCookie: string | undefined): Record<string, string> {
  const resultat: Record<string, string> = {};
  if (!enteteCookie) return resultat;
  for (const morceau of enteteCookie.split(';')) {
    const idx = morceau.indexOf('=');
    if (idx === -1) continue;
    const cle = morceau.slice(0, idx).trim();
    const valeur = morceau.slice(idx + 1).trim();
    resultat[cle] = decodeURIComponent(valeur);
  }
  return resultat;
}

export const NOM_COOKIE_SESSION = 'opa_session';
export const NOM_COOKIE_STATE = 'opa_oauth_state';
