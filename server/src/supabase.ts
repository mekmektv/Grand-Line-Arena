// ONE PIECE ARENA — accès à Supabase via son API REST (PostgREST), sans dépendance npm.
//
// On reste sur `fetch` natif (Node ≥ 18) exprès : tout le reste du projet tourne sans
// `npm install` (voir server/README.md), pas de raison de casser ça pour ajouter le SDK
// @supabase/supabase-js alors que la table `config`/`characters` etc. sont de simples tables.
//
// Ce fichier utilise la clé SERVICE ROLE : il ne tourne QUE côté serveur, jamais exposé au
// navigateur. Il ignore délibérément le Row Level Security (c'est le rôle du serveur de
// vérifier qui a le droit de faire quoi, pas de la base).

import { env } from './env.ts';

async function requete(path: string, init: RequestInit & { attendreLigne?: boolean } = {}) {
  const url = `${env.supabaseUrl}/rest/v1${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: init.method && init.method !== 'GET' ? 'return=representation' : '',
      ...init.headers,
    },
  });

  if (!res.ok) {
    const corps = await res.text().catch(() => '');
    throw new Error(`Supabase ${init.method ?? 'GET'} ${path} → ${res.status} ${res.statusText} : ${corps}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** `select` avec des query params PostgREST bruts (déjà encodés), ex: `eq.abc`, `select=*`. */
export async function supabaseSelect<T = any>(table: string, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  return requete(`/${table}?${qs}`) as Promise<T[]>;
}

export async function supabaseSelectUn<T = any>(table: string, params: Record<string, string>): Promise<T | null> {
  const lignes = await supabaseSelect<T>(table, { ...params, limit: '1' });
  return lignes[0] ?? null;
}

export async function supabaseInsert<T = any>(table: string, corps: Record<string, unknown>): Promise<T> {
  const lignes = await requete(`/${table}`, { method: 'POST', body: JSON.stringify(corps) });
  return (lignes as T[])[0];
}

/**
 * Insère, ou met à jour si la clé primaire existe déjà (`on conflict do update` de PostgREST).
 * `corps` DOIT contenir toutes les colonnes de la clé primaire, sinon PostgREST insère une
 * nouvelle ligne au lieu de fusionner.
 */
export async function supabaseUpsert<T = any>(table: string, corps: Record<string, unknown>): Promise<T> {
  const lignes = await requete(`/${table}`, {
    method: 'POST',
    body: JSON.stringify(corps),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return (lignes as T[])[0];
}

export async function supabaseUpdate<T = any>(
  table: string,
  filtre: Record<string, string>,
  corps: Record<string, unknown>,
): Promise<T> {
  const qs = new URLSearchParams(filtre).toString();
  const lignes = await requete(`/${table}?${qs}`, { method: 'PATCH', body: JSON.stringify(corps) });
  return (lignes as T[])[0];
}

/**
 * Supprime les lignes correspondant au filtre et REND celles qui ont réellement été supprimées.
 *
 * Ce retour n'est pas cosmétique : quand une suppression donne quelque chose au joueur
 * (recycler un équipement contre des Berrys, §4ter), il faut pouvoir vérifier qu'une ligne a
 * bien disparu avant de créditer. Sinon deux requêtes simultanées sur le même objet le
 * paieraient deux fois, alors qu'il n'a été détruit qu'une seule.
 *
 * ⚠️ Un filtre vide supprimerait TOUTE la table : PostgREST l'accepte sans broncher, donc on
 * le refuse ici plutôt que de découvrir le trou le jour où un appelant passe un objet vide.
 */
export async function supabaseDelete<T = any>(table: string, filtre: Record<string, string>): Promise<T[]> {
  if (Object.keys(filtre).length === 0) {
    throw new Error(`supabaseDelete("${table}") : filtre vide refusé — ça viderait la table entière.`);
  }
  const qs = new URLSearchParams(filtre).toString();
  const lignes = await requete(`/${table}?${qs}`, { method: 'DELETE' });
  return (lignes ?? []) as T[];
}
