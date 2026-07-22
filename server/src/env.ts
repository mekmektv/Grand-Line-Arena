// ONE PIECE ARENA — variables d'environnement du serveur HTTP.
//
// Même philosophie que config.ts : une variable manquante plante IMMÉDIATEMENT avec un
// message clair, plutôt que de démarrer un serveur à moitié configuré.

function lire(nom: string): string {
  const v = process.env[nom];
  if (!v) {
    throw new Error(
      `env : la variable "${nom}" est absente. Copie server/.env.example vers server/.env ` +
      `et remplis-la (voir server/README.md, section "Brique 3 — Twitch").`,
    );
  }
  return v;
}

export const env = {
  get port() { return Number(process.env.PORT ?? 8787); },
  // Twitch : lu à la demande (uniquement par les routes /auth/twitch/*), PAS au démarrage.
  // Le vrai compte Twitch arrive en dernier (voir DEV_AUTH_ENABLED) — pas de raison de bloquer
  // tout le reste du serveur tant qu'on ne s'en sert pas.
  get twitchClientId() { return lire('TWITCH_CLIENT_ID'); },
  get twitchClientSecret() { return lire('TWITCH_CLIENT_SECRET'); },
  get twitchRedirectUri() { return lire('TWITCH_REDIRECT_URI'); },
  get supabaseUrl() { return lire('SUPABASE_URL').replace(/\/$/, ''); },
  get supabaseServiceRoleKey() { return lire('SUPABASE_SERVICE_ROLE_KEY'); },
  get sessionSecret() { return lire('SESSION_SECRET'); },
  get frontendUrl() { return process.env.FRONTEND_URL ?? 'http://localhost:5173'; },
  /** Active `/auth/dev/login` (connexion sans Twitch, pour développer avant d'avoir l'app Twitch). */
  get devAuthEnabled() { return process.env.DEV_AUTH_ENABLED === 'true'; },
};

/**
 * Vérifie que le socle est présent AU DÉMARRAGE plutôt qu'à la 1ère requête.
 * Ne vérifie PAS les clés Twitch : tant que DEV_AUTH_ENABLED=true, on peut développer sans elles.
 * Les routes /auth/twitch/* les liront (et planteront proprement) le jour où on s'en sert.
 */
export function verifierEnvAuDemarrage(): void {
  void env.supabaseUrl;
  void env.supabaseServiceRoleKey;
  void env.sessionSecret;
}
