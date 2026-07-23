// GRAND LINE ARENA — Supabase Auth (GoTrue), via son API REST brute (`fetch`, pas de SDK —
// même philosophie que supabase.ts pour PostgREST). Sert UNIQUEMENT aux comptes créés sans
// Twitch : vérifie le mot de passe et envoie l'email de réinitialisation. La session du jeu
// reste notre propre cookie (session.ts) — Supabase Auth n'intervient qu'à l'inscription, la
// connexion et le mot de passe oublié, jamais pour les requêtes normales de l'app.

import { env } from './env.ts';

async function auth<T>(chemin: string, corps: unknown, accessToken?: string): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1${chemin}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Supabase Auth renvoie soit {error_description}, soit {msg} selon l'endpoint — jamais
    // le détail technique au joueur, un message générique suffit dans tous les cas.
    const message = (data as { error_description?: string; msg?: string }).error_description
      ?? (data as { msg?: string }).msg ?? `${res.status}`;
    throw new Error(traduireErreur(message));
  }
  return data as T;
}

/** Les messages Supabase Auth sont en anglais — traduits ici plutôt que montrés bruts. */
function traduireErreur(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists')) return 'Cet email est déjà utilisé.';
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('password') && m.includes('character')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Adresse email invalide.';
  return message;
}

interface SessionAuth {
  access_token: string;
  user: { id: string; email: string };
}

export async function inscrireSupabaseAuth(email: string, motDePasse: string): Promise<SessionAuth> {
  return auth<SessionAuth>('/signup', { email, password: motDePasse });
}

export async function connecterSupabaseAuth(email: string, motDePasse: string): Promise<SessionAuth> {
  return auth<SessionAuth>('/token?grant_type=password', { email, password: motDePasse });
}

/** Envoie l'email de réinitialisation. Ne révèle jamais si l'email existe ou non côté appelant
 *  (Supabase répond 200 dans les deux cas — comportement voulu, anti-énumération de comptes). */
export async function demanderReinitialisation(email: string): Promise<void> {
  await auth('/recover', { email });
}

/** Pose le nouveau mot de passe — `accessToken` vient du lien reçu par email (fragment
 *  #access_token=... de la redirection Supabase, capturé côté front). Renvoie l'utilisateur
 *  concerné, pour que server.ts puisse retrouver le joueur et ouvrir sa session directement
 *  (pas de raison de le refaire taper son nouveau mot de passe juste après l'avoir posé). */
export async function reinitialiserMotDePasse(
  accessToken: string, nouveauMotDePasse: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: nouveauMotDePasse }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(traduireErreur((data as { msg?: string }).msg ?? `${res.status}`));
  }
  return data as { id: string; email: string };
}
